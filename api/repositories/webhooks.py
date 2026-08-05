from __future__ import annotations

import json
import secrets
from typing import Optional
from uuid import uuid4

from api import db
from api.repositories.organizations import ensure_default_org


async def register_webhook(
    *,
    org_id: str,
    url: str,
    events: list[str] | None = None,
) -> dict:
    org = org_id or await ensure_default_org()
    secret = secrets.token_hex(32)
    ev = events or [
        "task.queued",
        "task.started",
        "task.waiting_approval",
        "task.completed",
        "task.failed",
    ]

    if not db.is_available():
        return {
            "id": str(uuid4()),
            "org_id": org,
            "url": url,
            "events": ev,
            "secret": secret,
            "active": True,
        }

    row = await db.fetch_one(
        """
        INSERT INTO org_webhooks (id, org_id, url, events, secret, active)
        VALUES (%s, %s, %s, %s, %s, true)
        RETURNING *
        """,
        (str(uuid4()), org, url, ev, secret),
    )
    return _row_to_webhook(row, include_secret=True)


async def list_webhooks(*, org_id: str) -> list[dict]:
    if not db.is_available():
        return []
    rows = await db.fetch_all(
        "SELECT * FROM org_webhooks WHERE org_id = %s AND active = true ORDER BY created_at DESC",
        (org_id,),
    )
    return [_row_to_webhook(r) for r in rows]


async def revoke_webhook(webhook_id: str, *, org_id: str) -> bool:
    if not db.is_available():
        return False
    row = await db.fetch_one(
        "SELECT id FROM org_webhooks WHERE id = %s AND org_id = %s",
        (webhook_id, org_id),
    )
    if not row:
        return False
    await db.execute("UPDATE org_webhooks SET active = false WHERE id = %s", (webhook_id,))
    return True


async def webhooks_for_event(org_id: str, event: str) -> list[dict]:
    if not db.is_available():
        return []
    rows = await db.fetch_all(
        """
        SELECT * FROM org_webhooks
        WHERE org_id = %s AND active = true AND %s = ANY(events)
        """,
        (org_id, event),
    )
    return [_row_to_webhook(r, include_secret=True) for r in rows]


def _row_to_webhook(row: dict, include_secret: bool = False) -> dict:
    out = {
        "id": str(row["id"]),
        "org_id": str(row["org_id"]),
        "url": row["url"],
        "events": row.get("events") or [],
        "active": row.get("active", True),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }
    if include_secret:
        out["secret"] = row["secret"]
    return out
