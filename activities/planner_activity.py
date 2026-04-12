"""
Planner activity — wraps the LLM next_step call as a Temporal activity.
All Anthropic API I/O must happen here, not in the workflow. (I1)
"""
from temporalio import activity

from project.planner import next_step, PlannerStep, FinalAnswer


@activity.defn(name="plan_next_step")
async def plan_next_step(task_prompt: str, context: list[dict]) -> dict:
    """
    Execute one Claude planning step and return a serializable dict.

    Returns:
        {"type": "final", "answer": str, "context": [...]}
        {"type": "step", "tool_name": str, "tool_use_id": str, "tool_input": dict, "context": [...]}
        {"type": "error", "message": str, "context": [...]}
    """
    result, new_context = await next_step(task_prompt, context)

    if isinstance(result, FinalAnswer):
        return {"type": "final", "answer": result.answer, "context": new_context}

    if isinstance(result, PlannerStep):
        return {
            "type": "step",
            "tool_name": result.tool_name,
            "tool_use_id": result.tool_use_id,
            "tool_input": result.tool_input,
            "context": new_context,
        }

    # PlannerError
    return {"type": "error", "message": getattr(result, "message", "Unknown error"), "context": new_context}
