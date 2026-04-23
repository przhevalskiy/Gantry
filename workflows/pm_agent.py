"""
PMAgent — Project Manager.
Sits before the Architect. Scans the repo, identifies critical ambiguities,
collects user clarifications via a durable HITL checkpoint, then returns
an enriched goal for the Architect to plan against.
"""
from __future__ import annotations

import json
import structlog
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.workflow import ParentClosePolicy

from agentex.lib import adk
from agentex.types.text_content import TextContent

with workflow.unsafe.imports_passed_through():
    from project.pm_tools import PM_VALID_TOOL_NAMES
    from project.child_workflow import ClarificationWorkflow

logger = structlog.get_logger(__name__)

MAX_PM_TURNS = 12

PLANNER_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=120),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}
IO_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=30),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}


@workflow.defn(name="PMAgent")
class PMAgent:
    """
    Project Manager agent. Returns a JSON object:
      { "enriched_goal": str, "notes": str, "clarifications": dict }
    """

    @workflow.run
    async def run(
        self,
        goal: str,
        repo_path: str,
        parent_task_id: str,
        task_queue: str,
        tier: int = 1,
        model: str | None = None,
    ) -> str:
        log = logger.bind(parent_task_id=parent_task_id, tier=tier)
        log.info("pm_started")

        await adk.messages.create(
            task_id=parent_task_id,
            content=TextContent(
                author="agent",
                content="[PM] Reviewing goal and scanning repository for context...",
            ),
        )

        task_prompt = (
            f"You are the Project Manager. The engineering team needs to accomplish this goal:\n\n"
            f"{goal}\n\n"
            f"Repository root: {repo_path}\n\n"
            f"Your job:\n"
            f"1. Call list_directory(path='{repo_path}') to check if the repo has any files.\n"
            f"2. If the directory is EMPTY (no files), you MUST call ask_clarification immediately.\n"
            f"   An empty repo = greenfield build = tech stack is unknown = clarification required.\n"
            f"   Ask these questions:\n"
            f"   - 'What framework/language? (e.g. React + TypeScript, Vue, Python/FastAPI, React Native, Flutter)'\n"
            f"   - 'Web app, mobile app, CLI tool, or API?'\n"
            f"   - 'Any specific libraries or constraints?'\n"
            f"   DO NOT skip this step for an empty repo. DO NOT call report_pm before asking.\n"
            f"3. If the repo has existing code, read key files and only ask if there are genuine "
            f"   ambiguities that would cause the build to fail.\n"
            f"4. After receiving answers (or if repo has code), call report_pm with the enriched goal "
            f"   that includes the tech stack and platform.\n"
            f"5. Use memory_write(repo_path='{repo_path}', key='pm.tech_stack', value=<stack>) to store "
            f"   the tech stack for the Architect.\n\n"
            f"IMPORTANT: For an empty repo, the sequence MUST be:\n"
            f"list_directory → ask_clarification → report_pm\n"
            f"NOT: list_directory → report_pm"
        )

        context: list[dict] = []
        clarifications: dict = {}
        asked_clarification = False

        from project.config import CLAUDE_SONNET_MODEL
        _model = model or CLAUDE_SONNET_MODEL
        for turn in range(MAX_PM_TURNS):
            raw = await workflow.execute_activity(
                "plan_pm_step",
                args=[task_prompt, context, _model],
                **PLANNER_OPTIONS,
            )
            context = raw["context"]

            # ── Terminal: report ─────────────────────────────────────────────
            if raw["type"] == "report":
                report_data = raw["report_data"]
                tool_use_id = raw["tool_use_id"]
                context = context + [{
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": "Handoff recorded."}],
                }]
                enriched_goal = report_data.get("enriched_goal", goal)
                notes = report_data.get("notes", "")
                log.info("pm_done", enriched=enriched_goal != goal, questions=len(clarifications))
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(
                        author="agent",
                        content=(
                            f"[PM] ✓ Ready for Architect."
                            + (f" {len(clarifications)} clarification(s) incorporated." if clarifications else " Goal was clear — no questions needed.")
                        ),
                    ),
                )
                return json.dumps({
                    "enriched_goal": enriched_goal,
                    "notes": notes,
                    "clarifications": clarifications,
                })

            # ── Terminal: final answer (no report_pm called) ─────────────────
            if raw["type"] == "final":
                log.warning("pm_no_report_tool", turn=turn)
                return json.dumps({"enriched_goal": goal, "notes": raw["answer"], "clarifications": {}})

            if raw["type"] == "error":
                log.warning("pm_planner_error", message=raw.get("message"))
                break

            # ── HITL: ask_clarification ──────────────────────────────────────
            if raw["type"] == "clarify" and not asked_clarification:
                asked_clarification = True
                clarify_data = raw["clarify_data"]
                tool_use_id = raw["tool_use_id"]
                questions: list[str] = clarify_data.get("questions", [])
                summary = clarify_data.get("context", "")

                clarification_wf_id = f"{parent_task_id}-clarification"
                payload = json.dumps({
                    "questions": questions,
                    "context": summary,
                    "workflow_id": clarification_wf_id,
                })
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(
                        author="agent",
                        content=f"__clarification_request__{payload}",
                    ),
                )

                log.info("pm_waiting_for_clarification", questions=len(questions))
                answers: dict = await workflow.execute_child_workflow(
                    ClarificationWorkflow.run,
                    args=[questions],
                    id=clarification_wf_id,
                    task_queue=task_queue,
                    execution_timeout=timedelta(hours=48),
                    parent_close_policy=ParentClosePolicy.TERMINATE,
                )
                clarifications = answers

                # Emit resolved message
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(
                        author="agent",
                        content=f"__clarification_resolved__{json.dumps({'workflow_id': clarification_wf_id, 'answered': bool(answers)})}",
                    ),
                )

                if answers:
                    answers_text = "\n".join(
                        f"Q: {q}\nA: {answers.get(q, '(no answer)')}"
                        for q in questions
                    )
                else:
                    answers_text = "(User skipped clarification — proceeding with original goal.)"

                context = context + [{
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": f"User answers:\n{answers_text}"}],
                }]
                continue

            # ── Guard: don't ask twice ────────────────────────────────────────
            if raw["type"] == "clarify" and asked_clarification:
                tool_use_id = raw["tool_use_id"]
                context = context + [{
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_use_id,
                                 "content": "You already asked for clarification. Call report_pm now."}],
                }]
                continue

            # ── Regular tool dispatch ─────────────────────────────────────────
            tool_name = raw["tool_name"]
            tool_use_id = raw["tool_use_id"]
            tool_input = raw["tool_input"]

            if tool_name not in PM_VALID_TOOL_NAMES:
                context = context + [{
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_use_id,
                                 "content": f"Unknown tool '{tool_name}'."}],
                }]
                continue

            tool_result = await self._dispatch(tool_name, tool_input)
            context = context + [{
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": str(tool_result)}],
            }]

        log.warning("pm_max_turns")
        return json.dumps({"enriched_goal": goal, "notes": "PM hit max turns.", "clarifications": {}})

    async def _dispatch(self, tool_name: str, tool_input: dict) -> str:
        if tool_name == "list_directory":
            return await workflow.execute_activity(
                "swarm_list_directory",
                args=[tool_input.get("path", "."), tool_input.get("max_depth", 2)],
                **IO_OPTIONS,
            )
        if tool_name == "read_file":
            return await workflow.execute_activity(
                "swarm_read_file", args=[tool_input.get("path", "")], **IO_OPTIONS
            )
        if tool_name == "search_files":
            return await workflow.execute_activity(
                "swarm_search_filesystem",
                args=[tool_input.get("pattern", ""), tool_input.get("path", "."), tool_input.get("type", "name")],
                **IO_OPTIONS,
            )
        if tool_name == "web_search":
            return await workflow.execute_activity(
                "swarm_web_search",
                args=[tool_input.get("query", ""), tool_input.get("num_results", 5)],
                **IO_OPTIONS,
            )
        if tool_name == "memory_write":
            return await workflow.execute_activity(
                "swarm_memory_write",
                args=[tool_input.get("key", ""), tool_input.get("value", ""), tool_input.get("repo_path", "."), "pm"],
                **IO_OPTIONS,
            )
        if tool_name == "memory_search_episodes":
            return await workflow.execute_activity(
                "memory_search_episodes",
                args=[tool_input.get("repo_path", "."), tool_input.get("query", ""), tool_input.get("top_k", 5)],
                **IO_OPTIONS,
            )
        return f"Error: tool '{tool_name}' not dispatched."
