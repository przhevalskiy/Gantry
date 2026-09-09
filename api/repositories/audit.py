"""Immutable audit trail for org API activity.

Postgres when DATABASE_URL is set; JSONL file fallback so local dev has the
same HITL/API audit surface (I6).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from api import db


def _audit_path():
    """Resolve at call time so tests can isolate GANTRY_HOME (I6)."""
    import os
    from pathlib import Path
    home = Path(os.getenv("GANTRY_HOME", str(Path.home() / ".gantry")))
    return home / "audit.jsonl"


def _parse_meta(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _row_to_entry(r: dict) -> dict:
    created = r.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    return {
        "id": str(r["id"]),
        "org_id": str(r["org_id"]),
        "key_id": str(r["key_id"]) if r.get("key_id") else None,
        "action": r["action"],
        "resource_type": r.get("resource_type"),
        "resource_id": r.get("resource_id"),
        "metadata": _parse_meta(r.get("metadata")),
        "ip_address": r.get("ip_address"),
        "created_at": created,
    }


def _load_file() -> list[dict]:
    path = _audit_path()
    if not path.exists():
        return []
    entries: list[dict] = []
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except Exception:
                continue
    except Exception:
        return []
    return entries


def _append_file(entry: dict) -> None:
    path = _audit_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as fh:
        fh.write(json.dumps(entry) + "\n")


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
    entry = {
        "id": str(uuid4()),
        "org_id": org_id,
        "key_id": key_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "metadata": metadata or {},
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if db.is_available():
        await db.execute(
            """
            INSERT INTO audit_log (id, org_id, key_id, action, resource_type, resource_id, metadata, ip_address)
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            """,
            (
                entry["id"], org_id, key_id, action, resource_type, resource_id,
                json.dumps(metadata or {}), ip_address,
            ),
        )
        return
    _append_file(entry)


async def list_entries(
    *,
    org_id: str,
    limit: int = 100,
    action: str | None = None,
    key_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
) -> list[dict]:
    if db.is_available():
        clauses = ["org_id = %s"]
        params: list[Any] = [org_id]

        if action:
            clauses.append("action = %s")
            params.append(action)
        if key_id:
            clauses.append("key_id = %s")
            params.append(key_id)
        if resource_type:
            clauses.append("resource_type = %s")
            params.append(resource_type)
        if resource_id:
            clauses.append("resource_id = %s")
            params.append(resource_id)

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
        return [_row_to_entry(r) for r in rows]

    entries = [e for e in _load_file() if e.get("org_id") == org_id]
    if action:
        entries = [e for e in entries if e.get("action") == action]
    if key_id:
        entries = [e for e in entries if e.get("key_id") == key_id]
    if resource_type:
        entries = [e for e in entries if e.get("resource_type") == resource_type]
    if resource_id:
        entries = [e for e in entries if e.get("resource_id") == resource_id]
    entries.sort(key=lambda e: e.get("created_at") or "", reverse=True)
    return entries[:limit]
