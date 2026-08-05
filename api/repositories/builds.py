from __future__ import annotations

import json
from typing import Any, Optional
from uuid import uuid4

from api import db
from api.repositories.organizations import DEFAULT_ORG_ID, ensure_default_org


async def upsert_build(
    *,
    task_id: str,
    project_id: str,
    org_id: str | None = None,
    user_id: str = "system",
    branch: str | None = None,
    pr_url: str | None = None,
    quality_score: float | None = None,
    status: str | None = None,
    tier: int | None = None,
    heal_cycles: int | None = None,
    files_changed: int | None = None,
    result: dict | None = None,
) -> dict | None:
    org = org_id or await ensure_default_org()

    if not db.is_available():
        return {
            "task_id": task_id,
            "project_id": project_id,
            "branch": branch,
            "pr_url": pr_url,
            "quality_score": quality_score,
            "status": status,
            "tier": tier,
        }

    row = await db.fetch_one(
        """
        INSERT INTO builds (
            id, task_id, project_id, org_id, user_id, branch, pr_url,
            quality_score, status, tier, heal_cycles, files_changed, result
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (task_id) DO UPDATE SET
            branch = COALESCE(EXCLUDED.branch, builds.branch),
            pr_url = COALESCE(EXCLUDED.pr_url, builds.pr_url),
            quality_score = COALESCE(EXCLUDED.quality_score, builds.quality_score),
            status = COALESCE(EXCLUDED.status, builds.status),
            tier = COALESCE(EXCLUDED.tier, builds.tier),
            heal_cycles = COALESCE(EXCLUDED.heal_cycles, builds.heal_cycles),
            files_changed = COALESCE(EXCLUDED.files_changed, builds.files_changed),
            result = COALESCE(EXCLUDED.result, builds.result),
            updated_at = now()
        RETURNING *
        """,
        (
            str(uuid4()), task_id, project_id, org, user_id,
            branch, pr_url, quality_score, status, tier,
            heal_cycles, files_changed,
            json.dumps(result) if result else None,
        ),
    )
    return _row_to_build(row) if row else None


async def get_build(task_id: str, *, org_id: str | None = None) -> dict | None:
    if not db.is_available():
        return None
    if org_id:
        row = await db.fetch_one(
            "SELECT * FROM builds WHERE task_id = %s AND org_id = %s",
            (task_id, org_id),
        )
    else:
        row = await db.fetch_one("SELECT * FROM builds WHERE task_id = %s", (task_id,))
    return _row_to_build(row) if row else None


def _row_to_build(row: dict) -> dict:
    result = row.get("result")
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except Exception:
            result = None
    return {
        "id": str(row["id"]),
        "task_id": row["task_id"],
        "project_id": str(row["project_id"]) if row.get("project_id") else None,
        "org_id": str(row.get("org_id", DEFAULT_ORG_ID)),
        "branch": row.get("branch"),
        "pr_url": row.get("pr_url"),
        "quality_score": float(row["quality_score"]) if row.get("quality_score") is not None else None,
        "status": row.get("status"),
        "tier": row.get("tier"),
        "heal_cycles": row.get("heal_cycles"),
        "files_changed": row.get("files_changed"),
        "result": result,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }
