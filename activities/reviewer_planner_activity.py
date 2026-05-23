"""
Reviewer planner activity — one LLM step for the ReviewerAgent workflow.
Uses REVIEWER_TOOLS (read_file, list_directory, git_diff, report_review).
"""
from temporalio import activity

from project.config import CLAUDE_SONNET_MODEL
from project.planner import next_step, PlannerStep, FinalAnswer, PlannerError
from project.reviewer_tools import REVIEWER_TOOLS

_REVIEWER_SYSTEM = (
    "You are the Reviewer agent in a software engineering swarm. "
    "Your job is to verify that the implementation is logically correct — "
    "not that it passes tests, but that it does what was asked. "
    "RULES:\n"
    "1. Use git_diff first to see what changed, then read key files for context.\n"
    "2. Focus on: logic correctness, missing edge cases, broken API contracts, unintended side effects.\n"
    "3. Do NOT flag style, formatting, variable naming, or subjective preferences.\n"
    "4. Call report_review with verdict='approve' or 'request_changes'.\n"
    "5. If requesting changes, every comment must include a specific file, clear issue, and actionable suggestion.\n"
    "IMPORTANT: Call exactly ONE tool per response."
)


@activity.defn(name="plan_reviewer_step")
async def plan_reviewer_step(
    task_prompt: str,
    context: list[dict],
) -> dict:
    """Execute one Claude planning step for the Reviewer agent."""
    try:
        result, new_context = await next_step(
            task_prompt,
            context,
            tools=REVIEWER_TOOLS,
            system_prompt=_REVIEWER_SYSTEM,
            model=CLAUDE_SONNET_MODEL,
        )
    except PlannerError as e:
        return {"type": "error", "message": str(e), "context": context}

    if isinstance(result, FinalAnswer):
        return {"type": "final", "answer": result.answer, "context": new_context}

    if isinstance(result, PlannerStep):
        if result.tool_name == "report_review":
            return {
                "type": "review",
                "review_data": result.tool_input,
                "tool_use_id": result.tool_use_id,
                "context": new_context,
            }
        return {
            "type": "step",
            "tool_name": result.tool_name,
            "tool_use_id": result.tool_use_id,
            "tool_input": result.tool_input,
            "context": new_context,
        }

    return {"type": "error", "message": "Unknown planner result", "context": new_context}
