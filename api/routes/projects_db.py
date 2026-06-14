"""DB-backed project + build CRUD — internal routes called by Next.js.

All routes are under /internal/db/ and secured by INTERNAL_API_KEY.
The user_id comes from the x-user-id header (set by Next.js after Clerk auth).
Falls back gracefully when DB is unavailable (returns 503).
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import api.db as db

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/internal/db", tags=["DB"])

_INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "")
_GANTRY_FILES_BASE = os.getenv("GANTRY_FILES_BASE", str(Path.home() / ".gantry" / "projects"))


def _check(key: str | None) -> None:
    if not _INTERNAL_KEY:
        return
    if key != _INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal key")


def _require_db() -> None:
    if not db.is_available():
        raise HTTPException(status_code=503, detail="Database not configured")


def _to_slug(name: str) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", name.lower().strip()))


def _parse_github_url(url: str) -> dict[str, str]:
    m = re.search(r"github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/.*)?$", url)
    if not m:
        return {}
    return {"github_owner": m.group(1), "github_repo": m.group(2)}


def _row_to_project(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "user_id": row["user_id"],
        "name": row["name"],
        "slug": row["slug"],
        "repo_path": row["repo_path"],
        "github_url": row.get("github_url"),
        "github_owner": row.get("github_owner"),
        "github_repo": row.get("github_repo"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


# ── Project CRUD ──────────────────────────────────────────────────────────────

class CreateProjectBody(BaseModel):
    name: str
    github_url: str | None = None


class UpdateProjectBody(BaseModel):
    name: str | None = None
    github_url: str | None = None


@router.get("/projects")
async def list_projects(
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    rows = await db.fetch_all(
        "SELECT * FROM projects WHERE user_id = %s ORDER BY created_at DESC",
        (x_user_id,),
    )
    return {"projects": [_row_to_project(r) for r in rows]}


@router.post("/projects", status_code=201)
async def create_project(
    body: CreateProjectBody,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    slug = _to_slug(name)
    # ensure slug uniqueness per user
    existing = await db.fetch_all(
        "SELECT slug FROM projects WHERE user_id = %s AND slug LIKE %s",
        (x_user_id, f"{slug}%"),
    )
    taken = {r["slug"] for r in existing}
    candidate, n = slug, 2
    while candidate in taken:
        candidate = f"{slug}-{n}"
        n += 1
    slug = candidate

    repo_path = str(Path(_GANTRY_FILES_BASE) / slug)
    if not body.github_url:
        Path(repo_path).mkdir(parents=True, exist_ok=True)

    gh = _parse_github_url(body.github_url) if body.github_url else {}

    row = await db.fetch_one(
        """
        INSERT INTO projects (id, user_id, name, slug, repo_path, github_url, github_owner, github_repo)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            str(uuid4()), x_user_id, name, slug, repo_path,
            body.github_url or None,
            gh.get("github_owner"), gh.get("github_repo"),
        ),
    )
    return {"project": _row_to_project(row)}


@router.patch("/projects/{project_id}")
async def update_project(
    project_id: str,
    body: UpdateProjectBody,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    row = await db.fetch_one(
        "SELECT * FROM projects WHERE id = %s AND user_id = %s",
        (project_id, x_user_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="project not found")

    updates: dict[str, Any] = {"updated_at": "now()"}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.github_url is not None:
        updates["github_url"] = body.github_url
        gh = _parse_github_url(body.github_url)
        updates["github_owner"] = gh.get("github_owner")
        updates["github_repo"] = gh.get("github_repo")

    set_clauses = [f"{k} = %s" for k in updates if k != "updated_at"]
    set_clauses.append("updated_at = now()")
    values = [v for k, v in updates.items() if k != "updated_at"]

    updated = await db.fetch_one(
        f"UPDATE projects SET {', '.join(set_clauses)} WHERE id = %s RETURNING *",
        (*values, project_id),
    )
    return {"project": _row_to_project(updated)}


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    row = await db.fetch_one(
        "SELECT * FROM projects WHERE id = %s AND user_id = %s",
        (project_id, x_user_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="project not found")

    await db.execute("DELETE FROM projects WHERE id = %s", (project_id,))
    return {"deleted": project_id}


# ── Build records ──────────────────────────────────────────────────────────────

class UpsertBuildBody(BaseModel):
    task_id: str
    project_id: str
    user_id: str = "system"
    branch: str | None = None
    pr_url: str | None = None
    quality_score: float | None = None
    status: str | None = None


@router.post("/builds", status_code=201)
async def upsert_build(
    body: UpsertBuildBody,
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    row = await db.fetch_one(
        """
        INSERT INTO builds (id, task_id, project_id, user_id, branch, pr_url, quality_score, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (task_id) DO UPDATE SET
            branch = EXCLUDED.branch,
            pr_url = EXCLUDED.pr_url,
            quality_score = EXCLUDED.quality_score,
            status = EXCLUDED.status,
            updated_at = now()
        RETURNING *
        """,
        (
            str(uuid4()), body.task_id, body.project_id, body.user_id,
            body.branch, body.pr_url, body.quality_score, body.status,
        ),
    )
    return {
        "build": {
            "id": str(row["id"]),
            "task_id": row["task_id"],
            "project_id": str(row["project_id"]),
            "branch": row["branch"],
            "pr_url": row["pr_url"],
            "quality_score": float(row["quality_score"]) if row.get("quality_score") else None,
            "status": row["status"],
        }
    }


@router.get("/projects/{project_id}/builds")
async def list_builds(
    project_id: str,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()
    rows = await db.fetch_all(
        "SELECT * FROM builds WHERE project_id = %s ORDER BY created_at DESC LIMIT 50",
        (project_id,),
    )
    return {
        "builds": [
            {
                "id": str(r["id"]),
                "task_id": r["task_id"],
                "branch": r["branch"],
                "pr_url": r["pr_url"],
                "quality_score": float(r["quality_score"]) if r.get("quality_score") else None,
                "status": r["status"],
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            }
            for r in rows
        ]
    }


@router.get("/tasks/{task_id}/build")
async def get_build_for_task(
    task_id: str,
    x_internal_key: str | None = Header(default=None),
):
    """Return the build record for a task — used by UI to get branch for GitHub file API."""
    _check(x_internal_key)
    _require_db()
    row = await db.fetch_one("SELECT * FROM builds WHERE task_id = %s", (task_id,))
    if not row:
        raise HTTPException(status_code=404, detail="build not found")
    return {
        "build": {
            "task_id": row["task_id"],
            "branch": row["branch"],
            "pr_url": row["pr_url"],
            "status": row["status"],
        }
    }
