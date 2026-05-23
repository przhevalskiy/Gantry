"""
InspectorAgent — QASkill.
Runs tests, lints, and type checks. Produces an InspectorReport.
If checks fail, provides heal_instructions for the Builder's next cycle.
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
    from project.inspector_tools import INSPECTOR_VALID_TOOL_NAMES

logger = structlog.get_logger(__name__)

MAX_INSPECTOR_TURNS = 20

PLANNER_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=120),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}
IO_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=30),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}
CMD_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=300),
    "retry_policy": RetryPolicy(maximum_attempts=1),
}


@workflow.defn(name="InspectorAgent")
class InspectorAgent:
    """
    Runs QA checks and returns an InspectorReport JSON.
    """

    @workflow.run
    async def run(
        self,
        goal: str,
        repo_path: str,
        parent_task_id: str,
        pre_existing_tests: list[str] | None = None,
        model: str | None = None,
        test_spec: list[str] | None = None,
        qa_commands: dict | None = None,
    ) -> str:
        log = logger.bind(parent_task_id=parent_task_id)
        log.info("inspector_started", pre_existing_tests=len(pre_existing_tests or []), has_test_spec=bool(test_spec))

        await adk.messages.create(
            task_id=parent_task_id,
            content=TextContent(
                author="agent",
                content="[Inspector] Running tests, lint, and type checks...",
            ),
        )

        regression_note = ""
        if pre_existing_tests:
            tests_str = "\n".join(f"  - {t}" for t in pre_existing_tests[:20])
            regression_note = (
                f"\n\nPre-existing test files (regression check — these MUST still pass):\n{tests_str}\n"
                "If any of these tests now fail, that is a regression — list it as a HIGH priority heal instruction."
            )

        tdd_note = ""
        if test_spec:
            spec_lines = "\n".join(f"  - {tc}" for tc in test_spec[:12])
            tdd_note = (
                f"\n\nTDD VERIFICATION — the Builder was asked to write these tests first:\n{spec_lines}\n"
                "Verify:\n"
                "1. Each test case above has a corresponding test in the test files.\n"
                "2. All tests pass.\n"
                "3. Run run_coverage to measure coverage on the new code.\n"
                "If any test case is missing, add it to heal_instructions: "
                "'Write test for: <description>'.\n"
                "If coverage on new files is below 60%, add to heal_instructions: "
                "'Increase test coverage for <file> — currently at X%'."
            )

        # Build QA instructions — use exact commands from Architect when available
        _qa = qa_commands or {}
        _test_cmd  = _qa.get("test")
        _lint_cmd  = _qa.get("lint")
        _type_cmd  = _qa.get("type_check")

        if _test_cmd or _lint_cmd or _type_cmd:
            _step_test = f"3. Run the test suite: `{_test_cmd}`" if _test_cmd else "3. No test command provided — skip tests and set tests_skipped=True."
            _step_lint = f"4. Run the linter: `{_lint_cmd}`" if _lint_cmd else "4. No lint command provided — skip lint."
            _step_type = f"5. Run type checking: `{_type_cmd}`" if _type_cmd else "5. No type-check command provided — skip type check."
            _discovery_note = ""
        else:
            _step_test = "3. Discover and run the test suite (e.g. 'pytest tests/ --tb=short -q' or 'npm test -- --run'). Check pyproject.toml or package.json for the configured test command."
            _step_lint = "4. Run the linter (e.g. 'ruff check .' or 'eslint src/')."
            _step_type = "5. Run type checking if applicable (e.g. 'mypy .' or 'npx tsc --noEmit')."
            _discovery_note = "   Look at pyproject.toml, package.json, or Makefile to determine the correct commands. Only scan the project root — do NOT recurse into vendored or submodule directories.\n"

        task_prompt = (
            f"You are the Inspector agent. Your goal:\n{goal}\n\n"
            f"Repository root: {repo_path}\n"
            f"{regression_note}"
            f"{tdd_note}\n"
            "Instructions:\n"
            "1. Check if dependencies are installed BEFORE running tests:\n"
            "   - For Node.js: check if node_modules/ exists. If NOT, call report_inspection with\n"
            "     passed=True, tests_skipped=True,\n"
            "     summary='⚠ Tests skipped — node_modules not installed. Reviewer must run npm install before testing.'\n"
            "   - For Python: check if .venv/ exists. If NOT, call report_inspection with\n"
            "     passed=True, tests_skipped=True,\n"
            "     summary='⚠ Tests skipped — virtualenv not installed. Reviewer must run pip install before testing.'\n"
            "   - NEVER try to install dependencies — that is not your job.\n"
            "2. Run all checks from the repo root directory.\n"
            f"{_discovery_note}"
            f"{_step_test}\n"
            f"{_step_lint}\n"
            f"{_step_type}\n"
            "6. Read failing files for context, then call report_inspection.\n"
            "   - Populate heal_items with one entry per error: {file (absolute path), line, issue, fix, severity}.\n"
            "   - heal_items are used first by the heal Builder — precise file+line+fix entries produce surgical edits.\n"
            "7. If you cannot determine pass/fail after 3 tool calls, call report_inspection with your best assessment.\n"
            "   Do NOT burn all turns trying to get a perfect result — a partial report is better than max_turns."
        )

        context: list[dict] = []

        from project.config import CLAUDE_SONNET_MODEL
        _model = model or CLAUDE_SONNET_MODEL
        for turn in range(MAX_INSPECTOR_TURNS):
            raw = await workflow.execute_activity(
                "plan_inspector_step",
                args=[task_prompt, context, _model],
                **PLANNER_OPTIONS,
            )
            context = raw["context"]

            if raw["type"] == "report":
                report_data = raw["report_data"]
                tool_use_id = raw["tool_use_id"]
                context = context + [{
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": "Report recorded."}],
                }]
                passed = report_data.get("passed", False)
                log.info("inspector_done", passed=passed)
                await adk.messages.create(
                    task_id=parent_task_id,
                    content=TextContent(
                        author="agent",
                        content=(
                            f"[Inspector] {'✓ All checks passed' if passed else '✗ Checks failed'} — "
                            f"{report_data.get('summary', '')}"
                        ),
                    ),
                )
                return json.dumps(report_data)

            if raw["type"] == "final":
                log.warning("inspector_no_report_tool", turn=turn)
                return json.dumps({"passed": False, "summary": raw["answer"], "heal_instructions": []})

            if raw["type"] == "error":
                log.warning("inspector_planner_error", message=raw.get("message"))
                break

            tool_name = raw["tool_name"]
            tool_use_id = raw["tool_use_id"]
            tool_input = raw["tool_input"]

            if tool_name not in INSPECTOR_VALID_TOOL_NAMES:
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
                    content=f"[Inspector] {tool_name}: {tool_input.get('command', tool_input.get('path', ''))}",
                ),
            )

            tool_result = await self._dispatch(tool_name, tool_input)

            tool_result_str = str(tool_result)

            # Warn early so the Inspector calls report_inspection before hitting the limit
            turns_left = MAX_INSPECTOR_TURNS - turn - 1
            if turns_left <= 3:
                tool_result_str += (
                    "\n\n⚠ WARNING: Only 3 turns remaining. Call report_inspection NOW with your "
                    "current findings — do not run more checks. A partial report is better than hitting max turns."
                )

            context = context + [{
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": tool_result_str}],
            }]

        log.warning("inspector_max_turns")
        return json.dumps({"passed": False, "summary": "Inspector hit max turns.", "heal_instructions": []})

    async def _dispatch(self, tool_name: str, tool_input: dict) -> str:
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
        if tool_name == "read_file":
            return await workflow.execute_activity(
                "swarm_read_file", args=[tool_input.get("path", "")], **IO_OPTIONS
            )
        if tool_name in ("run_tests", "run_lint", "run_type_check", "run_coverage"):
            return await workflow.execute_activity(
                "swarm_run_command",
                args=[tool_input.get("command", ""), tool_input.get("cwd")],
                **CMD_OPTIONS,
            )
        if tool_name == "run_application":
            return await workflow.execute_activity(
                "swarm_run_application_feedback",
                args=[
                    tool_input.get("start_command", ""),
                    tool_input.get("url", "http://localhost:3000"),
                    min(tool_input.get("wait_seconds", 5), 30),
                    tool_input.get("cwd"),
                ],
                start_to_close_timeout=timedelta(seconds=90),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        if tool_name == "check_secrets":
            return await workflow.execute_activity(
                "swarm_check_secrets",
                args=[tool_input.get("names", [])],
                **IO_OPTIONS,
            )
        if tool_name == "list_ports":
            return await workflow.execute_activity(
                "swarm_list_ports",
                args=[tool_input.get("ports")],
                **IO_OPTIONS,
            )
        if tool_name == "memory_read":
            return await workflow.execute_activity(
                "swarm_memory_read",
                args=[tool_input.get("repo_path", "."), tool_input.get("keys")],
                **IO_OPTIONS,
            )
        if tool_name == "memory_write":
            return await workflow.execute_activity(
                "swarm_memory_write",
                args=[tool_input.get("key", ""), tool_input.get("value", ""), tool_input.get("repo_path", "."), "inspector"],
                **IO_OPTIONS,
            )
        if tool_name == "memory_search_episodes":
            return await workflow.execute_activity(
                "memory_search_episodes",
                args=[tool_input.get("repo_path", "."), tool_input.get("query", ""), tool_input.get("top_k", 5)],
                **IO_OPTIONS,
            )
        return f"Error: tool '{tool_name}' not dispatched."
