"""
Sub-agent planner activity — like plan_next_step but uses SUBAGENT_TOOLS
(report_chunk instead of finish).
All LLM I/O must happen in activities, not workflows. (I1)
"""
from temporalio import activity

from project.planner import next_step, PlannerStep, FinalAnswer
from project.subagent_tools import SUBAGENT_TOOLS


@activity.defn(name="plan_subagent_step")
async def plan_subagent_step(task_prompt: str, context: list[dict]) -> dict:
    """
    Execute one Claude planning step for a sub-agent using sub-agent tool schemas.

    Returns the same dict shape as plan_next_step so the sub-agent workflow
    can use identical dispatch logic.

    report_chunk tool calls come back as type "final" with the findings as answer,
    so the sub-agent workflow loop terminates naturally on report_chunk.
    """
    result, new_context = await next_step(task_prompt, context, tools=SUBAGENT_TOOLS)

    if isinstance(result, FinalAnswer):
        return {"type": "final", "answer": result.answer, "context": new_context}

    if isinstance(result, PlannerStep):
        # report_chunk is the sub-agent's finish signal — surface it as final
        if result.tool_name == "report_chunk":
            findings = result.tool_input.get("findings", "No findings provided.")
            return {"type": "final", "answer": findings, "context": new_context}

        return {
            "type": "step",
            "tool_name": result.tool_name,
            "tool_use_id": result.tool_use_id,
            "tool_input": result.tool_input,
            "context": new_context,
        }

    return {"type": "error", "message": getattr(result, "message", "Unknown error"), "context": new_context}
