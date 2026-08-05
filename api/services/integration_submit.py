"""Shared task submission for ticketing integrations."""
from __future__ import annotations

import structlog

from api.clients import agentex as agentex_client
from api.repositories import tasks as tasks_repo
from api.schemas.llm import LlmConfig
from api.services import github_tokens
from api.services import llm_config as llm_config_service
from api.services import task_events

log = structlog.get_logger(__name__)


async def submit_integration_task(
    *,
    goal: str,
    project: dict,
    source: str,
    meta: dict | None = None,
    branch_prefix: str = "swarm",
    pipeline_params: dict | None = None,
    github_token: str | None = None,
    llm: LlmConfig | None = None,
) -> str:
    token = github_token
    if token is None:
        token = await github_tokens.resolve_token(
            org_id=project.get("org_id"),
            project=project,
        )

    extra = dict(pipeline_params or {})
    llm_params = await llm_config_service.resolve_llm_agentex_params(
        project.get("org_id"),
        llm,
    )
    extra.update(llm_params)

    task_id = await agentex_client.submit_task(
        goal=goal,
        project_id=project["id"],
        branch_prefix=branch_prefix,
        github_token=token or "",
        extra_params=extra or None,
    )
    await tasks_repo.save_task(
        task_id=task_id,
        org_id=project.get("org_id"),
        project_id=project["id"],
        webhook_url=None,
        source=source,
        meta=meta or {},
    )
    task_meta = await tasks_repo.get_task_meta(task_id) or {}
    await task_events.emit_task_event(task_id, task_meta, "task.queued", extra={"status": "queued"})
    log.info("integration_task_submitted", task_id=task_id, source=source, project_id=project["id"])
    return task_id
