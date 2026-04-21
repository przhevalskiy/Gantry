"""
PM planner activity — one LLM step for the Project Manager workflow.
"""
from temporalio import activity

from project.config import CLAUDE_SONNET_MODEL
from project.planner import next_step, PlannerStep, FinalAnswer, PlannerError
from project.pm_tools import PM_TOOLS

_PM_SYSTEM = (
    "You are the Project Manager in a software engineering swarm. "
    "Your job is to quickly assess the goal, scan the repo for relevant context, "
    "and either clarify ambiguities with the user or hand off a well-enriched goal directly to the Architect.\n\n"
    "RULES:\n"
    "1. Start by listing the root directory and reading key config files (README, package.json, pyproject.toml).\n"
    "2. Determine if the goal has critical ambiguities that would cause the build to fail or produce the wrong thing.\n"
    "3. If the goal is clear: call report_pm immediately with an enriched goal — do NOT ask unnecessary questions.\n"
    "4. If clarification is genuinely needed: call ask_clarification ONCE with 1-5 targeted questions.\n"
    "   - Only ask what you cannot determine from the repo, existing code, or a web search.\n"
    "   - DO NOT ask about: coding style, naming conventions, file structure, or implementation details.\n"
    "   - DO ask about: scope boundaries, business requirements, non-obvious tech choices, auth/data constraints.\n"
    "5. After receiving answers, call report_pm with the enriched goal.\n"
    "6. Use memory_write to store key findings (constraints, clarifications) for the Builder and Inspector.\n\n"
    "IMPORTANT: Call exactly ONE tool per response. Be efficient — the team is waiting."
)


@activity.defn(name="plan_pm_step")
async def plan_pm_step(task_prompt: str, context: list[dict]) -> dict:
    """Execute one Claude planning step for the PM agent."""
    try:
        result, new_context = await next_step(
            task_prompt,
            context,
            tools=PM_TOOLS,
            system_prompt=_PM_SYSTEM,
            model=CLAUDE_SONNET_MODEL,
        )
    except PlannerError as e:
        return {"type": "error", "message": str(e), "context": context}

    if isinstance(result, FinalAnswer):
        return {"type": "final", "answer": result.answer, "context": new_context}

    if isinstance(result, PlannerStep):
        if result.tool_name == "report_pm":
            return {
                "type": "report",
                "report_data": result.tool_input,
                "tool_use_id": result.tool_use_id,
                "context": new_context,
            }
        if result.tool_name == "ask_clarification":
            return {
                "type": "clarify",
                "clarify_data": result.tool_input,
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
