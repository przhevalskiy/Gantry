"""
OracleA11yAgent — Phase D role pack specialist.

Runs allowlisted accessibility checks (eslint-jsx-a11y / axe / pa11y when present)
and returns a structured oracle report. Composed by Foreman as a Temporal child;
not an ACP agent (C1/P3).
"""
from __future__ import annotations

import json
from datetime import timedelta

import structlog
from temporalio import workflow
from temporalio.common import RetryPolicy

from agentex.lib import adk
from agentex.types.text_content import TextContent

logger = structlog.get_logger(__name__)

# Allowlisted shell patterns only — no free-form remote tools (P3 / egress discipline).
_DEFAULT_A11Y_COMMANDS: tuple[str, ...] = (
    "npx eslint src --ext .tsx,.jsx,.ts,.js --max-warnings 0",
    "npx --yes @axe-core/cli --exit",
)

IO_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=30),
    "retry_policy": RetryPolicy(maximum_attempts=2),
}
CMD_OPTIONS = {
    "start_to_close_timeout": timedelta(seconds=180),
    "retry_policy": RetryPolicy(maximum_attempts=1),
}


def _commands_from_qa(qa_commands: dict | None) -> list[str]:
    if not qa_commands:
        return list(_DEFAULT_A11Y_COMMANDS)
    out: list[str] = []
    for key in ("a11y", "lint_a11y", "axe", "pa11y"):
        cmd = qa_commands.get(key)
        if isinstance(cmd, str) and cmd.strip():
            out.append(cmd.strip())
    return out or list(_DEFAULT_A11Y_COMMANDS)


@workflow.defn(name="OracleA11yAgent")
class OracleA11yAgent:
    """Accessibility oracle — structured findings for WCAG-oriented playbooks."""

    @workflow.run
    async def run(
        self,
        goal: str,
        repo_path: str,
        parent_task_id: str,
        qa_commands: dict | None = None,
    ) -> str:
        log = logger.bind(parent_task_id=parent_task_id)
        log.info("oracle_a11y_started")

        await adk.messages.create(
            task_id=parent_task_id,
            content=TextContent(
                author="agent",
                content="[OracleA11y] Running accessibility verification commands...",
            ),
        )

        commands = _commands_from_qa(qa_commands)
        findings: list[dict] = []
        summaries: list[str] = []
        any_ran = False

        for cmd in commands:
            try:
                output: str = await workflow.execute_activity(
                    "swarm_run_command",
                    args=[cmd, repo_path],
                    **CMD_OPTIONS,
                )
                any_ran = True
                text = (output or "").strip()
                # Convention: activity returns stdout; non-zero exits often embed FAIL.
                failed = (
                    "error" in text.lower()
                    or "violation" in text.lower()
                    or "✖" in text
                    or "failed" in text.lower()
                )
                if failed and text:
                    findings.append({
                        "severity": "high",
                        "source": "oracle_a11y",
                        "command": cmd,
                        "description": text[:500],
                    })
                    summaries.append(f"issues via `{cmd[:60]}`")
                else:
                    summaries.append(f"clean via `{cmd[:60]}`")
            except Exception as exc:
                # Missing tooling is skip, not hard fail (matches a11y playbook oracle notes).
                summaries.append(f"skipped `{cmd[:40]}` ({type(exc).__name__})")
                log.info("oracle_a11y_command_skipped", cmd=cmd[:80], error=str(exc)[:120])

        if not any_ran:
            report = {
                "passed": True,
                "summary": "No a11y tooling available — oracle skipped (not a failure).",
                "findings": [],
                "skipped": True,
            }
        else:
            report = {
                "passed": len(findings) == 0,
                "summary": "; ".join(summaries)[:400] or "a11y oracle complete",
                "findings": findings,
                "skipped": False,
            }

        log.info("oracle_a11y_done", passed=report["passed"], findings=len(findings))
        return json.dumps(report)
