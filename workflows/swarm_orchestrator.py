"""
SwarmOrchestrator — the Foreman (L5 OrchestratorSkill).

Thin coordinator: repo setup, tier classification, follow-up loop, HITL signals.
Pipeline stages live in workflows/swarm/pipeline.py.
"""
from __future__ import annotations

import asyncio
import json
import re
import structlog
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.workflow import ParentClosePolicy

from agentex.lib import adk
from agentex.lib.types.acp import CreateTaskParams, SendEventParams
from agentex.lib.core.temporal.workflows.workflow import BaseWorkflow
from agentex.lib.core.temporal.types.workflow import SignalName
from agentex.lib.environment_variables import EnvironmentVariables
from agentex.types.text_content import TextContent

with workflow.unsafe.imports_passed_through():
    from project.planner import _extract_task_prompt
    from project.schema.complexity import classify_tier, params_for_tier, TIER_LABELS
    from project.llm_runtime import extract_agentex_llm_params
    from project.config import GH_TOKEN as _GH_TOKEN
    from workflows.child_workflow import ApprovalWorkflow
    from workflows.swarm.repo_setup import prepare_repository
    from workflows.swarm.hitl import (
        approval_workflow_id,
        build_approval_request_content,
        build_approval_resolved_content,
        build_hitl_meta_patch,
    )
    from workflows.swarm.pipeline import PipelineContext, run_swarm_pipeline

environment_variables = EnvironmentVariables.refresh()
logger = structlog.get_logger(__name__)


def _branch_name(task_id: str, prefix: str = "swarm") -> str:
    safe = re.sub(r"[^a-zA-Z0-9\-]", "-", task_id)[:40]
    return f"{prefix}/{safe}"


@workflow.defn(name="swarm-factory")
class SwarmOrchestrator(BaseWorkflow):
    """
    Durable Multi-Dimensional Software Engineering Factory.
    Orchestrates: Architect → Builders (parallel) → Inspector (heal loop) → Security → DevOps.
    Persistent: after each build the foreman waits up to 24h for follow-up prompts.
    """

    def __init__(self):
        super().__init__(display_name="swarm-factory")
        self._pending_followup: str | None = None
        self._conversation_history: list[dict] = []
        self._manifest: dict = {"version": 1, "tracks": [], "completed_edits": []}

    @workflow.signal(name=SignalName.RECEIVE_EVENT)
    async def on_task_event_send(self, params: SendEventParams) -> None:
        content = params.event.content
        if content and getattr(content, "type", None) == "text":
            text = (getattr(content, "content", None) or "").strip()
            if text:
                logger.info("followup_received", task_id=params.task.id, preview=text[:60])
                self._pending_followup = text
                return
        logger.info("received_event", task_id=params.task.id)

    @workflow.run
    async def on_task_create(self, params: CreateTaskParams) -> str:
        task_id = params.task.id
        goal = _extract_task_prompt(params.params)
        log = logger.bind(task_id=task_id)
        log.info("swarm_started", goal=goal[:80])

        llm_creds = extract_agentex_llm_params(params.params if params.params else {})
        if llm_creds:
            await workflow.execute_activity(
                "register_task_llm_config",
                args=[task_id, llm_creds],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )

        try:
            await workflow.execute_activity(
                "db_notify_task_status",
                args=[task_id, "running"],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )
        except Exception:
            pass

        task_queue = environment_variables.WORKFLOW_TASK_QUEUE or "gantry_queue"
        repo_path = params.params.get("repo_path", ".") if params.params else "."
        branch_prefix = params.params.get("branch_prefix", "swarm") if params.params else "swarm"
        playbook = (params.params or {}).get("playbook") or None

        github_url: str = params.params.get("github_url", "") if params.params else ""
        github_token: str = params.params.get("github_token", "") if params.params else ""
        project_id: str = params.params.get("project_id", "") if params.params else ""

        effective_token = github_token or _GH_TOKEN

        async def _run_repo_activity(name: str, args: list) -> str:
            return await workflow.execute_activity(
                name,
                args=args,
                start_to_close_timeout=timedelta(minutes=5 if name == "swarm_git_clone" else 1),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )

        async def _post_repo_message(text: str) -> None:
            await adk.messages.create(
                task_id=task_id,
                content=TextContent(author="agent", content=text),
            )

        repo_path, github_url, repo_error = await prepare_repository(
            task_id=task_id,
            repo_path=repo_path,
            github_url=github_url,
            github_token=effective_token,
            project_id=project_id,
            run_activity=_run_repo_activity,
            post_message=_post_repo_message,
        )
        if repo_error:
            try:
                await workflow.execute_activity(
                    "db_notify_task_status",
                    args=[task_id, "failed"],
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=RetryPolicy(maximum_attempts=2),
                )
            except Exception:
                pass
            return repo_error

        explicit_tier = int(params.params.get("tier", -1)) if params.params else -1
        if explicit_tier >= 0:
            tier = explicit_tier
            tier_meta: dict = {
                "tier": tier,
                "estimated_files": 0,
                "estimated_minutes": 0,
                "risk_flags": [],
                "reasoning": "explicit override",
                "source": "user",
            }
        else:
            try:
                tier_meta = await workflow.execute_activity(
                    "classify_tier_llm",
                    args=[goal, task_id],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=2),
                )
                tier = tier_meta["tier"]
            except Exception:
                tier = classify_tier(goal)
                tier_meta = {
                    "tier": tier,
                    "estimated_files": 0,
                    "estimated_minutes": 0,
                    "risk_flags": [],
                    "reasoning": "activity failed, used regex",
                    "source": "regex_fallback",
                }
        tp = params_for_tier(tier)

        lightweight_mode = bool(params.params.get("lightweight_mode", tp["lightweight_mode"])) if params.params else tp["lightweight_mode"]
        max_heal = int(params.params.get("max_heal_cycles", tp["max_heal_cycles"])) if params.params else tp["max_heal_cycles"]
        max_parallel_tracks = int(params.params.get("max_parallel_tracks", tp["max_parallel_tracks"])) if params.params else tp["max_parallel_tracks"]
        disable_agents = set(params.params.get("disable_agents") or []) if params.params else set()

        tier_label = TIER_LABELS.get(tier, f"Tier {tier}")
        tier_details = []
        if tier_meta.get("estimated_files"):
            tier_details.append(f"~{tier_meta['estimated_files']} files")
        if tier_meta.get("estimated_minutes"):
            tier_details.append(f"~{tier_meta['estimated_minutes']} min")
        if tier_meta.get("risk_flags"):
            tier_details.append("risks: " + ", ".join(tier_meta["risk_flags"][:3]))
        detail_str = f" ({', '.join(tier_details)})" if tier_details else ""
        await adk.messages.create(
            task_id=task_id,
            content=TextContent(
                author="agent",
                content=(
                    f"[Foreman] Complexity tier: {tier_label} (Tier {tier}){detail_str} — "
                    f"{'lightweight, ' if lightweight_mode else ''}"
                    f"{max_parallel_tracks} track(s), {max_heal} heal cycle(s)"
                ),
            ),
        )

        last_result = ""
        iteration = 0

        while True:
            branch = _branch_name(f"{task_id}-r{iteration}", branch_prefix)
            pipeline_ctx = PipelineContext(
                manifest=self._manifest,
                conversation_history=self._conversation_history,
            )
            last_result = await run_swarm_pipeline(
                pipeline_ctx,
                sync_task_meta=self._sync_task_meta,
                hitl_checkpoint=self._hitl_checkpoint,
                task_id=task_id,
                goal=goal,
                repo_path=repo_path,
                branch=branch,
                branch_prefix=branch_prefix,
                max_heal=max_heal,
                lightweight_mode=lightweight_mode,
                max_parallel_tracks=max_parallel_tracks,
                task_queue=task_queue,
                iteration=iteration,
                tier=tier,
                project_id=project_id,
                disable_agents=disable_agents,
                playbook=playbook,
                task_params=params.params if params.params else None,
            )
            self._manifest = pipeline_ctx.manifest

            self._conversation_history.append({
                "iteration": iteration,
                "goal": goal,
                "summary": last_result[:400],
            })

            await adk.messages.create(
                task_id=task_id,
                content=TextContent(
                    author="agent",
                    content="[Foreman] Build complete. Waiting for follow-up instructions (24h idle timeout).",
                ),
            )

            self._pending_followup = None
            try:
                await workflow.wait_condition(
                    lambda: self._pending_followup is not None,
                    timeout=timedelta(hours=24),
                )
            except asyncio.TimeoutError:
                log.info("followup_timeout", iteration=iteration)
                break

            goal = self._pending_followup  # type: ignore[assignment]
            self._pending_followup = None
            iteration += 1
            log.info("followup_accepted", iteration=iteration, goal=goal[:60])

            await adk.messages.create(
                task_id=task_id,
                content=TextContent(
                    author="agent",
                    content=f"[Foreman] Follow-up #{iteration} received: {goal[:120]}\nRestarting swarm on existing repo.",
                ),
            )

        return last_result

    async def _sync_task_meta(self, task_id: str, patch: dict) -> None:
        """Write task metadata for API/SSE consumers (non-fatal on failure)."""
        if not patch:
            return
        try:
            await workflow.execute_activity(
                "db_patch_task_meta",
                args=[task_id, json.dumps(patch)],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )
        except Exception:
            pass

    async def _hitl_checkpoint(
        self,
        task_id: str,
        task_queue: str,
        checkpoint: str,
        action: str,
        iteration: int,
    ) -> bool:
        """Emit an approval_request message then block until the user signals approve/reject."""
        approval_wf_id = approval_workflow_id(task_id, iteration, checkpoint)
        await self._sync_task_meta(
            task_id,
            build_hitl_meta_patch(checkpoint, action, approval_wf_id),
        )
        await adk.messages.create(
            task_id=task_id,
            content=TextContent(
                author="agent",
                content=build_approval_request_content(checkpoint, action, approval_wf_id),
            ),
        )
        try:
            await workflow.execute_activity(
                "db_notify_task_status",
                args=[task_id, "waiting_approval"],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )
        except Exception:
            pass

        result: str = await workflow.execute_child_workflow(
            ApprovalWorkflow.run,
            args=[action],
            id=approval_wf_id,
            task_queue=task_queue,
            execution_timeout=timedelta(hours=72),
            parent_close_policy=ParentClosePolicy.TERMINATE,
        )

        approved = result == "Approved"
        await self._sync_task_meta(task_id, {"pending_hitl_remove": approval_wf_id})
        try:
            await workflow.execute_activity(
                "db_notify_task_status",
                args=[task_id, "running" if approved else "failed"],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )
        except Exception:
            pass
        await adk.messages.create(
            task_id=task_id,
            content=TextContent(
                author="agent",
                content=build_approval_resolved_content(checkpoint, approved, approval_wf_id),
            ),
        )
        return approved
