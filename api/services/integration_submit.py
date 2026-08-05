"""Shared task submission for ticketing integrations."""
from __future__ import annotations

import structlog

from api.clients import agentex as agentex_client
from api.repositories import tasks as tasks_repo
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
) -> str:
    task_id = await agentex_client.submit_task(
        goal=goal,
        project_id=project["id"],
        branch_prefix=branch_prefix,
        extra_params=pipeline_params or {},
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
