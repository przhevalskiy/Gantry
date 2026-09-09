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
) -> str:
    """Upsert a build record into the Postgres builds table via the Gantry API.

    Non-fatal — if the API is unreachable or DATABASE_URL is not configured,
    logs a warning and returns a no-op result. This keeps the orchestrator
    working in local dev where Postgres is not set up.
    """
    payload = {
        "task_id": task_id,
        "project_id": project_id,
        "user_id": user_id,
        "branch": branch or None,
        "pr_url": pr_url or None,
        "quality_score": quality_score,
        "status": status,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
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
