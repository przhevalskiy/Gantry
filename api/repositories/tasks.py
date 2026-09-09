from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from api import db
from api.repositories.organizations import DEFAULT_ORG_ID, ensure_default_org


def _tasks_path():
    """Resolve at call time so tests can isolate GANTRY_HOME (I6)."""
    import os
    from pathlib import Path
    home = Path(os.getenv("GANTRY_HOME", str(Path.home() / ".gantry")))
    return home / "api_tasks.json"


def _load_file() -> dict:
    path = _tasks_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def _save_file(store: dict) -> None:
    path = _tasks_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(store, indent=2))


def _row_to_meta(row: dict) -> dict:
    meta = row.get("meta") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}
    return {
        "org_id": str(row.get("org_id", DEFAULT_ORG_ID)),
        "project_id": str(row["project_id"]) if row.get("project_id") else None,
        "key_id": str(row["key_id"]) if row.get("key_id") else None,
        "webhook_url": row.get("webhook_url"),
        "source": row.get("source", "api"),
        "status": row.get("status"),
        "pr_url": row.get("pr_url"),
        "branch": row.get("branch"),
        "tier": row.get("tier"),
        "webhook_fired": row.get("webhook_fired", False),
        "events_fired": list(row.get("events_fired") or []),
        "created_at": row["created_at"].isoformat() if hasattr(row.get("created_at"), "isoformat") else row.get("created_at"),
        **meta,
    }


async def save_task(
    task_id: str,
    *,
    org_id: str,
    project_id: str,
    webhook_url: str | None = None,
    source: str = "api",
    key_id: str | None = None,
    tier: int | None = None,
    idempotency_key: str | None = None,
    meta: dict | None = None,
) -> None:
    org = org_id or await ensure_default_org()
    now = datetime.now(timezone.utc).isoformat()
    extra = meta or {}

    if db.is_available():
        await db.execute(
            """
            INSERT INTO api_tasks (
                task_id, org_id, project_id, key_id, webhook_url, source, tier,
                idempotency_key, meta, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, now(), now())
            ON CONFLICT (task_id) DO UPDATE SET
                webhook_url = COALESCE(EXCLUDED.webhook_url, api_tasks.webhook_url),
                meta = api_tasks.meta || EXCLUDED.meta,
                updated_at = now()
            """,
            (
                task_id, org, project_id, key_id, webhook_url, source,
                tier, idempotency_key, json.dumps(extra),
            ),
        )
        return

    store = _load_file()
    store[task_id] = {
        "org_id": org,
        "project_id": project_id,
        "key_id": key_id,
        "webhook_url": webhook_url,
        "source": source,
        "tier": tier,
        "created_at": now,
        "webhook_fired": False,
        "events_fired": [],
        **extra,
    }
    _save_file(store)


async def get_task_meta(task_id: str, *, org_id: str | None = None) -> Optional[dict]:
    if db.is_available():
        if org_id:
            row = await db.fetch_one(
                "SELECT * FROM api_tasks WHERE task_id = %s AND org_id = %s",
                (task_id, org_id),
            )
        else:
            row = await db.fetch_one("SELECT * FROM api_tasks WHERE task_id = %s", (task_id,))
        return _row_to_meta(row) if row else None

    meta = _load_file().get(task_id)
    if not meta:
        return None
    if org_id and meta.get("org_id", DEFAULT_ORG_ID) != org_id:
        return None
    return meta


async def list_tasks(*, org_id: str, limit: int = 50) -> list[tuple[str, dict]]:
    if db.is_available():
        rows = await db.fetch_all(
            """
            SELECT * FROM api_tasks
            WHERE org_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (org_id, limit),
        )
        return [(r["task_id"], _row_to_meta(r)) for r in rows]

    items = [
        (tid, meta)
        for tid, meta in _load_file().items()
        if meta.get("org_id", DEFAULT_ORG_ID) == org_id
    ]
    items.sort(key=lambda x: x[1].get("created_at") or "", reverse=True)
    return items[:limit]


async def patch_task_meta(
    task_id: str,
    *,
    track_warnings: list[str] | None = None,
    pending_hitl_add: dict | None = None,
    pending_hitl_remove: str | None = None,
) -> bool:
    """Merge worker-written fields into task metadata (file store or Postgres meta JSONB)."""
    current = await get_task_meta(task_id)
    if not current:
        return False

    patch: dict[str, Any] = {}
    if track_warnings is not None:
        patch["track_warnings"] = track_warnings

    if pending_hitl_add or pending_hitl_remove:
        pending = list(current.get("pending_hitl") or [])
        if pending_hitl_add:
            wf = pending_hitl_add.get("workflow_id")
            pending = [p for p in pending if p.get("workflow_id") != wf]
            pending.append(pending_hitl_add)
        if pending_hitl_remove:
            pending = [p for p in pending if p.get("workflow_id") != pending_hitl_remove]
        patch["pending_hitl"] = pending

    if not patch:
        return True

    if db.is_available():
        await db.execute(
            """
            UPDATE api_tasks
            SET meta = COALESCE(meta, '{}'::jsonb) || %s::jsonb,
                updated_at = now()
            WHERE task_id = %s
            """,
            (json.dumps(patch), task_id),
        )
        return True

    store = _load_file()
    if task_id not in store:
        return False
    store[task_id].update(patch)
    _save_file(store)
    return True


async def update_task_status(
    task_id: str,
    *,
    status: str,
    pr_url: str | None = None,
    branch: str | None = None,
) -> None:
    if db.is_available():
        await db.execute(
            """
            UPDATE api_tasks
            SET status = %s,
                pr_url = COALESCE(%s, pr_url),
                branch = COALESCE(%s, branch),
                updated_at = now()
            WHERE task_id = %s
            """,
            (status, pr_url, branch, task_id),
        )
        return

    store = _load_file()
    if task_id in store:
        store[task_id]["status"] = status
        if pr_url:
            store[task_id]["pr_url"] = pr_url
        if branch:
            store[task_id]["branch"] = branch
        _save_file(store)


async def mark_event_fired(task_id: str, event: str) -> None:
    if db.is_available():
        await db.execute(
            """
            UPDATE api_tasks
            SET events_fired = array_append(events_fired, %s),
                updated_at = now()
            WHERE task_id = %s AND NOT (%s = ANY(events_fired))
            """,
            (event, task_id, event),
        )
        return

    store = _load_file()
    if task_id in store:
        fired = store[task_id].setdefault("events_fired", [])
        if event not in fired:
            fired.append(event)
        _save_file(store)


async def mark_webhook_fired(task_id: str) -> None:
    if db.is_available():
        await db.execute(
            "UPDATE api_tasks SET webhook_fired = true, updated_at = now() WHERE task_id = %s",
            (task_id,),
        )
        return

    store = _load_file()
    if task_id in store:
        store[task_id]["webhook_fired"] = True
        _save_file(store)


async def pending_tasks() -> list[tuple[str, dict]]:
    if db.is_available():
        rows = await db.fetch_all(
            "SELECT * FROM api_tasks WHERE webhook_fired = false"
        )
        return [(r["task_id"], _row_to_meta(r)) for r in rows]

    return [
        (tid, meta)
        for tid, meta in _load_file().items()
        if not meta.get("webhook_fired")
    ]


async def get_task_result(task_id: str, *, org_id: str | None = None) -> dict | None:
    """Structured result from builds + api_tasks."""
    from api.repositories import builds as builds_repo

    build = await builds_repo.get_build(task_id, org_id=org_id)
    meta = await get_task_meta(task_id, org_id=org_id)
    if not build and not meta:
        return None

    result: dict[str, Any] = {}
    if build:
        result.update({
            "pr_url": build.get("pr_url"),
            "branch": build.get("branch"),
            "quality_score": build.get("quality_score"),
            "tier": build.get("tier"),
            "heal_cycles": build.get("heal_cycles"),
            "files_changed": build.get("files_changed"),
            "status": build.get("status"),
        })
        if build.get("result"):
            result.update(build["result"])

    if meta:
        result.setdefault("pr_url", meta.get("pr_url"))
        result.setdefault("branch", meta.get("branch"))
        result.setdefault("source", meta.get("source"))

    return {k: v for k, v in result.items() if v is not None} or None
