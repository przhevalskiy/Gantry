"""Immutable audit trail for org API activity."""
from __future__ import annotations

import json
from typing import Any, Optional
from uuid import uuid4

from api import db


async def record(
    *,
    org_id: str,
    action: str,
    key_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
) -> None:
    if not db.is_available():
        return
    await db.execute(
        """
        INSERT INTO audit_log (id, org_id, key_id, action, resource_type, resource_id, metadata, ip_address)
        VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s)
        """,
        (
            str(uuid4()), org_id, key_id, action, resource_type, resource_id,
            json.dumps(metadata or {}), ip_address,
        ),
    )


async def list_entries(
    *,
    org_id: str,
    limit: int = 100,
    action: str | None = None,
    key_id: str | None = None,
) -> list[dict]:
    if not db.is_available():
        return []

    clauses = ["org_id = %s"]
    params: list[Any] = [org_id]

    if action:
        clauses.append("action = %s")
        params.append(action)
    if key_id:
        clauses.append("key_id = %s")
        params.append(key_id)

    params.append(limit)
    rows = await db.fetch_all(
        f"""
        SELECT id, org_id, key_id, action, resource_type, resource_id, metadata, ip_address, created_at
        FROM audit_log
        WHERE {' AND '.join(clauses)}
        ORDER BY created_at DESC
        LIMIT %s
        """,
        tuple(params),
    )
    return [
        {
            "id": str(r["id"]),
            "org_id": str(r["org_id"]),
            "key_id": str(r["key_id"]) if r.get("key_id") else None,
            "action": r["action"],
            "resource_type": r.get("resource_type"),
            "resource_id": r.get("resource_id"),
            "metadata": r.get("metadata") or {},
            "ip_address": r.get("ip_address"),
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        }
        for r in rows
    ]
