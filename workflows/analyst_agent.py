"""
AnalystAgent — deep reading worker.
Receives a batch of assigned URLs from the Scout, reads each deeply,
and extracts structured claims via report_claim tool calls.

No searching. Pure navigation and claim extraction.
"""
from __future__ import annotations

import json
import structlog
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

from agentex.lib import adk
from agentex.types.text_content import TextContent

with workflow.unsafe.imports_passed_through():
    from project.analyst_tools import ANALYST_VALID_TOOL_NAMES
    from project.claim_schema import Claim

logger = structlog.get_logger(__name__)

MAX_ANALYST_TURNS = 20

IO_ACTIVITY_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=60),
    "retry_policy": RetryPolicy(maximum_attempts=3),
}

PLANNER_ACTIVITY_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=120),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}


def _tag(agent_index: int, text: str) -> str:
    return f"[Agent {agent_index}] {text}"


@workflow.defn(name="AnalystAgent")
class AnalystAgent:
    """
    Deep reading worker. Reads assigned URLs and extracts structured claims.
    Returns a JSON list of Claim objects.
    """

    @workflow.run
    async def run(
        self,
        assigned_urls: list[str],
        original_query: str,
        parent_task_id: str,
        agent_index: int,
    ) -> str:
        """
        Returns JSON string: list of Claim dicts.
        """
        log = logger.bind(
            parent_task_id=parent_task_id,
            agent_index=agent_index,
            url_count=len(assigned_urls),
        )
        log.info("analyst_started")

        await adk.messages.create(
            task_id=parent_task_id,
            content=TextContent(
                author="agent",
                content=_tag(agent_index, f"Starting: reading {len(assigned_urls)} sources"),
            ),
        )

        url_list = "\n".join(f"  {i+1}. {u}" for i, u in enumerate(assigned_urls))
        task_prompt = (
            f"You are an Analyst agent. Your mission: deeply read these specific URLs and "
            f"extract structured claims relevant to this research question:\n"
            f"{original_query}\n\n"
            f"Your assigned URLs to read:\n{url_list}\n\n"
            "Instructions:\n"
            "- Navigate to each URL in order\n"
            "- After reading each page, call report_claim for EACH distinct factual claim you find\n"
            "- Include the exact quote that supports each claim\n"
            "- Read ALL assigned URLs before calling finish_reading\n"
            "- Do NOT search the web — only navigate to the URLs above"
        )

        context: list[dict] = []
        claims: list[dict] = []
        spawn_requests: list[dict] = []
        pages_visited = 0

        for turn in range(MAX_ANALYST_TURNS):
            raw = await workflow.execute_activity(
                "plan_analyst_step",
                args=[task_prompt, context],
                **PLANNER_ACTIVITY_OPTIONS,
            )
            context = raw["context"]

            if raw["type"] == "final":
                log.info("analyst_finished", turn=turn, claim_count=len(claims), spawns=len(spawn_requests))
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(
                        author="agent",
                        content=_tag(agent_index, f"done — extracted {len(claims)} claims"),
                    ),
                )
                await workflow.execute_activity(
                    "close_browser",
                    start_to_close_timeout=timedelta(seconds=15),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
                return json.dumps({"claims": claims, "spawn_requests": spawn_requests})

            if raw["type"] == "claim":
                claim_data = raw["claim_data"]
                claim_data["agent_index"] = agent_index
                claims.append(claim_data)
                tool_use_id = raw["tool_use_id"]
                context = context + [{
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": "Claim recorded.",
                    }],
                }]
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(
                        author="agent",
                        content=_tag(agent_index, f"claim: {claim_data.get('claim', '')[:80]}"),
                    ),
                )
                continue

            if raw["type"] == "spawn_request":
                spawn_data = raw["spawn_data"]
                spawn_requests.append(spawn_data)
                tool_use_id = raw["tool_use_id"]
                context = context + [{
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": "Spawn request queued.",
                    }],
                }]
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(
                        author="agent",
                        content=_tag(agent_index, f"flagged for deeper investigation: {spawn_data.get('url', '')[:80]}"),
                    ),
                )
                continue

            if raw["type"] == "error":
                log.warning("analyst_planner_error", message=raw.get("message"))
                break

            tool_name = raw["tool_name"]
            tool_use_id = raw["tool_use_id"]
            tool_input = raw["tool_input"]

            if tool_name not in ANALYST_VALID_TOOL_NAMES:
                context = context + [{
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": f"Unknown tool '{tool_name}'. Use: navigate, click_element, report_claim, finish_reading.",
                    }],
                }]
                continue

            # Dispatch browser activity
            await adk.messages.create(
                task_id=parent_task_id,
                content=TextContent(
                    author="agent",
                    content=_tag(agent_index, f"{tool_name}: {tool_input.get('url') or tool_input.get('selector', '')}"),
                ),
            )

            tool_result = await self._dispatch(tool_name, tool_use_id, tool_input)

            if tool_name in ("navigate", "click_element"):
                pages_visited += 1

            context = context + [{
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": str(tool_result),
                }],
            }]

        log.warning("analyst_max_turns", turns=MAX_ANALYST_TURNS, claims_so_far=len(claims))
        await workflow.execute_activity(
            "close_browser",
            start_to_close_timeout=timedelta(seconds=15),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )
        return json.dumps({"claims": claims, "spawn_requests": spawn_requests})

    async def _dispatch(self, tool_name: str, tool_use_id: str, tool_input: dict) -> str:
        if tool_name == "navigate":
            html = await workflow.execute_activity(
                "navigate",
                tool_input.get("url", ""),
                **IO_ACTIVITY_OPTIONS,
            )
            return await workflow.execute_activity(
                "extract_page_content",
                html,
                start_to_close_timeout=timedelta(seconds=30),
            )

        if tool_name == "click_element":
            return await workflow.execute_activity(
                "click_element",
                tool_input.get("selector", ""),
                **IO_ACTIVITY_OPTIONS,
            )

        return f"Error: tool '{tool_name}' not dispatched."
