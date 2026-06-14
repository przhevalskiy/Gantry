"""DB-backed UI state — open tabs + active project preference."""
from __future__ import annotations

import os
import json

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import api.db as db

router = APIRouter(prefix="/internal/db", tags=["UI State"])

_INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "")


def _check(key: str | None) -> None:
    if not _INTERNAL_KEY:
        return
    if key != _INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal key")


def _require_db() -> None:
    if not db.is_available():
        raise HTTPException(status_code=503, detail="Database not configured")


# ── UI State (open tabs per task) ─────────────────────────────────────────────

class UpsertUIStateBody(BaseModel):
    task_id: str
    open_tabs: list[str]
    active_tab: str | None = None


@router.get("/ui-state")
async def get_ui_state(
    task_id: str,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    row = await db.fetch_one(
        "SELECT * FROM ui_state WHERE user_id = %s AND task_id = %s",
        (x_user_id, task_id),
    )
    if not row:
        return {"open_tabs": [], "active_tab": None}
    tabs = row["open_tabs"] if isinstance(row["open_tabs"], list) else json.loads(row["open_tabs"])
    return {"open_tabs": tabs, "active_tab": row["active_tab"]}


@router.put("/ui-state")
async def upsert_ui_state(
    body: UpsertUIStateBody,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    await db.execute(
        """
        INSERT INTO ui_state (user_id, task_id, open_tabs, active_tab, updated_at)
        VALUES (%s, %s, %s, %s, now())
        ON CONFLICT (user_id, task_id) DO UPDATE SET
            open_tabs = EXCLUDED.open_tabs,
            active_tab = EXCLUDED.active_tab,
            updated_at = now()
        """,
        (x_user_id, body.task_id, json.dumps(body.open_tabs), body.active_tab),
    )
    return {"ok": True}


# ── User Preferences (active project + last task) ─────────────────────────────

class UpsertPreferencesBody(BaseModel):
    active_project_id: str | None = None
    last_task_id: str | None = None


@router.get("/preferences")
async def get_preferences(
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    row = await db.fetch_one(
        "SELECT * FROM user_preferences WHERE user_id = %s",
        (x_user_id,),
    )
    if not row:
        return {"active_project_id": None, "last_task_id": None}
    return {
        "active_project_id": str(row["active_project_id"]) if row.get("active_project_id") else None,
        "last_task_id": row.get("last_task_id"),
    }


@router.put("/preferences")
async def upsert_preferences(
    body: UpsertPreferencesBody,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    await db.execute(
        """
        INSERT INTO user_preferences (user_id, active_project_id, last_task_id, updated_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT (user_id) DO UPDATE SET
            active_project_id = COALESCE(EXCLUDED.active_project_id, user_preferences.active_project_id),
            last_task_id = COALESCE(EXCLUDED.last_task_id, user_preferences.last_task_id),
            updated_at = now()
        """,
        (x_user_id, body.active_project_id or None, body.last_task_id or None),
    )
    return {"ok": True}
