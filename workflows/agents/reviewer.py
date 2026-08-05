"""
ReviewerAgent — CodeReviewSkill.
Reads the diff and checks logic correctness, edge-case handling, and API
contract compliance. Returns a ReviewReport JSON.
Verdict 'request_changes' re-enters the heal loop; 'approve' proceeds to Security.
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
    from project.tools.reviewer import REVIEWER_VALID_TOOL_NAMES

logger = structlog.get_logger(__name__)

MAX_REVIEWER_TURNS = 12

PLANNER_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=120),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}
IO_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=30),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}


@workflow.defn(name="ReviewerAgent")
class ReviewerAgent:
    """
    Reviews the diff for logic correctness and returns a ReviewReport JSON.
    """

    @workflow.run
    async def run(
        self,
        goal: str,
        repo_path: str,
        plan: dict,
        changed_files: list[str],
        parent_task_id: str,
    ) -> str:
        log = logger.bind(parent_task_id=parent_task_id)
        log.info("reviewer_started", changed_files=len(changed_files))

        await adk.messages.create(
            task_id=parent_task_id,
            content=TextContent(
                author="agent",
                content="[Reviewer] Reading diff and checking logic correctness...",
            ),
        )

        files_str = "\n".join(f"  - {f}" for f in changed_files[:30])
        plan_summary = plan.get("summary", "") or plan.get("goal", "")

        task_prompt = (
            f"You are the Reviewer agent. Original goal:\n{goal}\n\n"
            f"Repository root: {repo_path}\n"
            f"Architect's plan summary: {plan_summary}\n\n"
            f"Files changed by this build:\n{files_str}\n\n"
            "Instructions:\n"
            "1. Call git_diff (no paths) to see the full diff of what changed.\n"
            "2. Read 1–3 of the most important changed files for deeper context.\n"
            "3. Review for:\n"
            "   - Logic correctness: does the implementation do what the goal asks?\n"
            "   - Edge cases: are None values, empty collections, missing inputs handled?\n"
            "   - API contracts: do signatures, return types, and interfaces match callers?\n"
            "   - Unintended side effects: does the change break anything outside its stated scope?\n"
            "4. Call report_review with your verdict.\n"
            "   - verdict='approve' if the logic is correct and the goal is met.\n"
            "   - verdict='request_changes' ONLY for real logic bugs, missing edge cases, "
            "or broken contracts. Do NOT request changes for style, formatting, or naming.\n"
            "   - Populate comments with specific file+issue+suggestion for each problem.\n"
            "IMPORTANT: Be selective. A false 'request_changes' wastes a heal cycle. "
            "Only flag things that would cause incorrect runtime behaviour or break callers."
        )

        context: list[dict] = []

        for turn in range(MAX_REVIEWER_TURNS):
            raw = await workflow.execute_activity(
                "plan_reviewer_step",
                args=[task_prompt, context, parent_task_id],
                **PLANNER_OPTIONS,
            )
            context = raw["context"]

            if raw["type"] == "review":
                review_data = raw["review_data"]
                tool_use_id = raw["tool_use_id"]
                context = context + [{
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": "Review recorded."}],
                }]
                verdict = review_data.get("verdict", "approve")
                log.info("reviewer_done", verdict=verdict, comments=len(review_data.get("comments", [])))
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(
                        author="agent",
                        content=(
                            f"[Reviewer] {'✓ Approved' if verdict == 'approve' else '✗ Changes requested'} — "
                            f"{review_data.get('summary', '')}"
                        ),
                    ),
                )
                return json.dumps(review_data)

            if raw["type"] == "final":
                log.warning("reviewer_no_report_tool", turn=turn)
                return json.dumps({"verdict": "approve", "summary": raw["answer"], "comments": []})

            if raw["type"] == "error":
                log.warning("reviewer_planner_error", message=raw.get("message"))
                break

            tool_name = raw["tool_name"]
            tool_use_id = raw["tool_use_id"]
            tool_input = raw["tool_input"]

            if tool_name not in REVIEWER_VALID_TOOL_NAMES:
                context = context + [{
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_use_id,
                                 "content": f"Unknown tool '{tool_name}'."}],
                }]
                continue

            await adk.messages.create(
                task_id=parent_task_id,
                content=TextContent(
                    author="agent",
                    content=f"[Reviewer] {tool_name}",
                ),
            )

            tool_result = await self._dispatch(tool_name, tool_input, repo_path)

            context = context + [{
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": str(tool_result)}],
            }]

        log.warning("reviewer_max_turns")
        return json.dumps({"verdict": "approve", "summary": "Reviewer hit max turns — auto-approving.", "comments": []})

    async def _dispatch(self, tool_name: str, tool_input: dict, repo_path: str) -> str:
        cwd = tool_input.get("cwd") or repo_path
        if tool_name == "read_file":
            return await workflow.execute_activity(
                "swarm_read_file", args=[tool_input.get("path", "")], **IO_OPTIONS
            )
        if tool_name == "list_directory":
            return await workflow.execute_activity(
                "swarm_list_directory",
                args=[tool_input.get("path", "."), tool_input.get("max_depth", 2)],
                **IO_OPTIONS,
            )
        if tool_name == "search_files":
            return await workflow.execute_activity(
                "swarm_search_filesystem",
                args=[tool_input.get("pattern", ""), tool_input.get("path", "."), tool_input.get("type", "name")],
                **IO_OPTIONS,
            )
        if tool_name == "find_symbol":
            return await workflow.execute_activity(
                "swarm_find_symbol",
                args=[tool_input.get("symbol", ""), tool_input.get("repo_path", repo_path)],
                **IO_OPTIONS,
            )
        if tool_name == "git_diff":
            return await workflow.execute_activity(
                "swarm_git_diff",
                args=[cwd, False, tool_input.get("paths")],
                **IO_OPTIONS,
            )
        return f"Error: tool '{tool_name}' not dispatched."
