"""Fallback Agentex status sync — push from the worker is primary.

Enable modes via ``GANTRY_STATUS_POLLER``:
  - ``fallback`` (default): slow safety net for tasks that never received a push
  - ``off``: do not start the poller
  - ``legacy``: previous 10s aggressive poll (debug only)
"""
from __future__ import annotations

import asyncio
import os

import structlog

from api.clients import agentex as agentex_client
from api.repositories import tasks as tasks_repo
from api.services import task_sync

log = structlog.get_logger(__name__)

# Re-export for existing tests
_handle_github_callback = task_sync.handle_github_callback

TERMINAL_STATUSES = task_sync.TERMINAL_STATUSES
INTERMEDIATE_STATUSES = task_sync.INTERMEDIATE_STATUSES


def poller_mode() -> str:
    raw = os.getenv("GANTRY_STATUS_POLLER", "fallback").strip().lower()
    if raw in {"0", "false", "no", "off", "disabled"}:
        return "off"
    if raw in {"legacy", "aggressive", "10s"}:
        return "legacy"
    return "fallback"


def poll_interval_seconds(mode: str | None = None) -> int:
    mode = mode or poller_mode()
    if mode == "legacy":
        return int(os.getenv("GANTRY_STATUS_POLL_INTERVAL", "10"))
    return int(os.getenv("GANTRY_STATUS_POLL_INTERVAL", "60"))


async def _poll_task(task_id: str, meta: dict) -> None:
    try:
        task = await agentex_client.get_task(task_id)
    except Exception as exc:
        log.warning("poller_get_task_failed", task_id=task_id, error=str(exc))
        return

    status = (task.get("status") or "").lower()
    if not status:
        return

    messages: list[dict] = []
    scrape = status in TERMINAL_STATUSES
    if scrape:
        try:
            messages = await agentex_client.get_messages(task_id)
        except Exception:
            messages = []

    await task_sync.apply_status_update(
        task_id,
        status,
        meta=meta,
        messages=messages,
        scrape_messages=scrape,
    )


async def run_poller() -> None:
    mode = poller_mode()
    if mode == "off":
        log.info("poller_disabled", mode=mode)
        return

    interval = poll_interval_seconds(mode)
    log.info("poller_started", mode=mode, interval=interval, role="fallback")
    while True:
        try:
            pending = await tasks_repo.pending_tasks()
            for task_id, meta in pending:
                current = (meta.get("status") or "").lower()
                if current in TERMINAL_STATUSES:
                    continue
                await _poll_task(task_id, meta)
        except Exception as exc:
            log.error("poller_loop_error", error=str(exc))
        await asyncio.sleep(interval)
