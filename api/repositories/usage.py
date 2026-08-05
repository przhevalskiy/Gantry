from __future__ import annotations

import json
from typing import Any, Optional
from uuid import uuid4

from api import db


async def record_event(
    *,
    org_id: str,
    event_type: str,
    key_id: str | None = None,
    task_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    if not db.is_available():
        return
    await db.execute(
        """
        INSERT INTO usage_events (id, org_id, key_id, event_type, task_id, metadata)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        """,
        (
            str(uuid4()), org_id, key_id, event_type, task_id,
            json.dumps(metadata or {}),
        ),
    )


async def get_usage(*, org_id: str, limit: int = 100) -> dict:
    if not db.is_available():
        return {"org_id": org_id, "events": [], "summary": {"tasks_submitted": 0}}

    rows = await db.fetch_all(
        """
        SELECT event_type, COUNT(*) AS count
        FROM usage_events
        WHERE org_id = %s
        GROUP BY event_type
        """,
        (org_id,),
    )
    summary = {r["event_type"]: r["count"] for r in rows}

    recent = await db.fetch_all(
        """
        SELECT event_type, task_id, metadata, created_at
        FROM usage_events
        WHERE org_id = %s
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (org_id, limit),
    )
    events = [
        {
            "event_type": r["event_type"],
            "task_id": r["task_id"],
            "metadata": r.get("metadata") or {},
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        }
        for r in recent
    ]
    return {
        "org_id": org_id,
        "summary": summary,
        "events": events,
    }


async def find_task_by_idempotency(org_id: str, idempotency_key: str) -> Optional[str]:
    if not db.is_available():
        return None
    row = await db.fetch_one(
        "SELECT task_id FROM api_tasks WHERE org_id = %s AND idempotency_key = %s",
        (org_id, idempotency_key),
    )
    return row["task_id"] if row else None


async def save_idempotency(org_id: str, idempotency_key: str, task_id: str) -> None:
    if not db.is_available():
        return
    await db.execute(
        "UPDATE api_tasks SET idempotency_key = %s WHERE task_id = %s AND org_id = %s",
        (idempotency_key, task_id, org_id),
    )
