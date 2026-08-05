"""Centralized task lifecycle webhook delivery."""
from __future__ import annotations

import structlog

from api.repositories import tasks as tasks_repo
from api.repositories import usage as usage_repo
from api.repositories import webhooks as webhooks_repo
from api.services import webhooks

log = structlog.get_logger(__name__)

LIFECYCLE_EVENTS = {
    "queued": "task.queued",
    "running": "task.started",
    "waiting_approval": "task.waiting_approval",
    "completed": "task.completed",
    "failed": "task.failed",
    "cancelled": "task.failed",
    "terminated": "task.failed",
    "timeout": "task.failed",
}


async def emit_task_event(
    task_id: str,
    meta: dict,
    event: str,
    *,
    extra: dict | None = None,
) -> None:
    """Fire a lifecycle event to per-task and org webhooks (once per event)."""
    fresh = await tasks_repo.get_task_meta(task_id) or meta
    fired = set(fresh.get("events_fired") or [])
    if event in fired:
        return

    org_id = fresh.get("org_id")
    project_id = fresh.get("project_id")
    payload = {
        "task_id": task_id,
        "project_id": project_id,
        "org_id": org_id,
        "source": fresh.get("source", "api"),
        **(extra or {}),
    }

    webhook_url = fresh.get("webhook_url")
    if webhook_url:
        await webhooks.fire_webhook(webhook_url, event, payload)

    if org_id:
        for hook in await webhooks_repo.webhooks_for_event(org_id, event):
            await webhooks.fire_webhook(hook["url"], event, payload, secret=hook.get("secret"))
        await usage_repo.record_event(
            org_id=org_id,
            event_type=event,
            task_id=task_id,
            metadata=extra or {},
        )

    await tasks_repo.mark_event_fired(task_id, event)
    log.info("task_event_emitted", task_id=task_id, event=event)


async def emit_for_agentex_status(
    task_id: str,
    meta: dict,
    status: str,
    *,
    result: dict | None = None,
) -> None:
    """Map Agentex status to lifecycle webhook events."""
    event = LIFECYCLE_EVENTS.get(status)
    if not event:
        return

    extra: dict = {"status": status}
    if result:
        extra["result"] = result
    elif status == "completed" and (meta.get("pr_url") or meta.get("branch")):
        extra["result"] = {
            "pr_url": meta.get("pr_url"),
            "branch": meta.get("branch"),
        }

    await emit_task_event(task_id, meta, event, extra=extra)
