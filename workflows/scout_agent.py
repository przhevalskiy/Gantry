"""
ScoutAgent — fast, wide-coverage search worker.
Runs multiple searches across different angles, collects all relevant URLs,
then calls report_sources to return a ranked list to the orchestrator.

No navigation. No deep reading. Search only.
Target: complete in under 90 seconds.
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
    from project.scout_tools import SCOUT_VALID_TOOL_NAMES

logger = structlog.get_logger(__name__)

MAX_SCOUT_TURNS = 16

IO_ACTIVITY_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=60),
    "retry_policy": RetryPolicy(maximum_attempts=3),
}

PLANNER_ACTIVITY_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=90),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}


@workflow.defn(name="ScoutAgent")
class ScoutAgent:
    """
    Broad search worker. Receives a list of scout queries, runs them all,
    and returns a JSON list of {url, relevance_note, source_type} objects.
    """

    @workflow.run
    async def run(self, scout_queries: list[str], original_query: str, parent_task_id: str) -> str:
        """
        Returns JSON string: list of {url, relevance_note, source_type}.
        Falls back to empty list on failure.
        """
        log = logger.bind(parent_task_id=parent_task_id, query_count=len(scout_queries))
        log.info("scout_started")

        await adk.messages.create(
            task_id=parent_task_id,
            content=TextContent(author="agent", content="[Scout] Scanning the web for relevant sources..."),
        )

        query_list = "\n".join(f"  {i+1}. {q}" for i, q in enumerate(scout_queries))
        task_prompt = (
            f"You are a Scout agent. Your mission: discover the best source URLs for this research question:\n"
            f"{original_query}\n\n"
            f"Run ALL of these searches (one at a time):\n{query_list}\n\n"
            "Instructions:\n"
            "- Call search_web once for EACH query listed above\n"
            "- After all searches are done, call report_sources with all unique URLs you found\n"
            "- Rank sources by relevance — most relevant first\n"
            "- Include a brief relevance note for each URL\n"
            "- Do NOT navigate to any URLs — search only"
        )

        context: list[dict] = []

        for turn in range(MAX_SCOUT_TURNS):
            raw = await workflow.execute_activity(
                "plan_scout_step",
                args=[task_prompt, context],
                **PLANNER_ACTIVITY_OPTIONS,
            )
            context = raw["context"]

            if raw["type"] == "final":
                sources_json = raw["answer"]
                log.info("scout_finished", turn=turn, answer_len=len(sources_json))
                try:
                    sources = json.loads(sources_json)
                    if isinstance(sources, list):
                        await adk.messages.create(
                            task_id=parent_task_id,
                            content=TextContent(
                                author="agent",
                                content=f"[Scout] Found {len(sources)} relevant sources.",
                            ),
                        )
                        return sources_json
                except (json.JSONDecodeError, ValueError):
                    pass
                return sources_json

            if raw["type"] == "error":
                log.warning("scout_planner_error", message=raw.get("message"))
                break

            tool_name = raw["tool_name"]
            tool_use_id = raw["tool_use_id"]
            tool_input = raw["tool_input"]

            if tool_name not in SCOUT_VALID_TOOL_NAMES:
                context = context + [{
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": f"Unknown tool '{tool_name}'. Use: search_web, report_sources.",
                    }],
                }]
                continue

            # Only search_web reaches here
            if tool_name == "search_web":
                query = tool_input.get("query", "")
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(author="agent", content=f'[Scout] Searching: "{query}"'),
                )
                result = await workflow.execute_activity(
                    "search_web",
                    args=[query, tool_input.get("max_results", 7)],
                    **IO_ACTIVITY_OPTIONS,
                )
            else:
                result = f"Tool '{tool_name}' not available to Scout."

            context = context + [{
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": str(result),
                }],
            }]

        log.warning("scout_max_turns", max_turns=MAX_SCOUT_TURNS)
        return "[]"
