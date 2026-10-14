"""Database activities — upsert build records into Postgres via the Gantry API."""
from __future__ import annotations

import os
import json

import httpx
import structlog
from temporalio import activity

log = structlog.get_logger(__name__)

_GANTRY_API_URL = os.getenv("GANTRY_API_URL", "http://localhost:8001")
_INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "")


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if _INTERNAL_KEY:
        h["x-internal-key"] = _INTERNAL_KEY
    return h


@activity.defn(name="db_upsert_build")
async def db_upsert_build(
    task_id: str,
    project_id: str,
    user_id: str = "system",
    branch: str = "",
    pr_url: str = "",
    quality_score: float | None = None,
    status: str = "COMPLETED",
    tier: int | None = None,
    heal_cycles: int | None = None,
    files_changed: int | None = None,
    artifact_type: str = "pr",
) -> str:
    """Upsert a structured build record via the Gantry API (Invariant I3).

    This is the primary path for task results and terminal lifecycle events.
    The Agentex poller is only a slow safety net when this push fails.
    """
    artifact = (artifact_type or "pr").lower().strip() or "pr"
    structured_result = {
        k: v
        for k, v in {
            "artifact_type": artifact,
            "pr_url": pr_url or None if artifact == "pr" else None,
            "branch": branch or None if artifact != "report" else None,
            "quality_score": quality_score,
            "tier": tier,
            "heal_cycles": heal_cycles,
            "files_changed": files_changed,
        }.items()
        if v is not None
    }

    payload = {
        "task_id": task_id,
        "project_id": project_id,
        "user_id": user_id,
        "branch": branch or None,
        "pr_url": pr_url or None,
        "quality_score": quality_score,
        "status": status,
        "tier": tier,
        "heal_cycles": heal_cycles,
        "files_changed": files_changed,
        "result": structured_result or None,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_GANTRY_API_URL}/internal/db/builds",
                json=payload,
                headers=_headers(),
            )
        if resp.status_code == 503:
            log.warning("db_upsert_build_no_db", task_id=task_id)
            return json.dumps({"ok": False, "reason": "db not configured"})
        if resp.status_code not in (200, 201):
            log.warning("db_upsert_build_failed", task_id=task_id, status=resp.status_code)
            return json.dumps({"ok": False, "reason": f"status {resp.status_code}"})
        return json.dumps({"ok": True, "build": resp.json().get("build", {})})
    except Exception as exc:
        log.warning("db_upsert_build_error", task_id=task_id, error=str(exc))
        return json.dumps({"ok": False, "reason": str(exc)})


@activity.defn(name="db_notify_task_status")
async def db_notify_task_status(
    task_id: str,
    status: str,
    pr_url: str = "",
    branch: str = "",
) -> str:
    """Push lifecycle status to the Gantry API (running / waiting_approval / failed)."""
    payload: dict = {"status": status}
    if pr_url:
        payload["pr_url"] = pr_url
    if branch:
        payload["branch"] = branch
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{_GANTRY_API_URL}/internal/db/tasks/{task_id}/status",
                json=payload,
                headers=_headers(),
            )
        if resp.status_code == 404:
            log.warning("db_notify_task_status_not_found", task_id=task_id)
            return json.dumps({"ok": False, "reason": "task not found"})
        if resp.status_code not in (200, 201):
            log.warning(
                "db_notify_task_status_failed",
                task_id=task_id,
                status_code=resp.status_code,
            )
            return json.dumps({"ok": False, "reason": f"status {resp.status_code}"})
        return json.dumps({"ok": True})
    except Exception as exc:
        log.warning("db_notify_task_status_error", task_id=task_id, error=str(exc))
        return json.dumps({"ok": False, "reason": str(exc)})


@activity.defn(name="db_patch_task_meta")
async def db_patch_task_meta(task_id: str, patch_json: str) -> str:
    """Patch task metadata via the Gantry API (track_warnings, pending_hitl).

    Non-fatal — local dev works without the API reachable.
    """
    try:
        patch = json.loads(patch_json) if patch_json else {}
    except json.JSONDecodeError as exc:
        return json.dumps({"ok": False, "reason": f"invalid json: {exc}"})

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.patch(
                f"{_GANTRY_API_URL}/internal/db/tasks/{task_id}/meta",
                json=patch,
                headers=_headers(),
            )
        if resp.status_code == 404:
            log.warning("db_patch_task_meta_not_found", task_id=task_id)
            return json.dumps({"ok": False, "reason": "task not found"})
        if resp.status_code not in (200, 201):
            log.warning("db_patch_task_meta_failed", task_id=task_id, status=resp.status_code)
            return json.dumps({"ok": False, "reason": f"status {resp.status_code}"})
        return json.dumps({"ok": True})
    except Exception as exc:
        log.warning("db_patch_task_meta_error", task_id=task_id, error=str(exc))
        return json.dumps({"ok": False, "reason": str(exc)})
