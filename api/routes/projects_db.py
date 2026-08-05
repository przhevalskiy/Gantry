"""DB-backed project + build CRUD — internal routes called by Next.js.

All routes are under /internal/db/ and secured by INTERNAL_API_KEY.
The user_id comes from the x-user-id header (set by Next.js after Clerk auth).
Falls back gracefully when DB is unavailable (returns 503).
"""
from __future__ import annotations

import os
from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import api.db as db
from api.repositories import builds as builds_repo
from api.repositories import projects as projects_repo

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/internal/db", tags=["DB"])

_INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "")


def _check(key: str | None) -> None:
    if not _INTERNAL_KEY:
        return
    if key != _INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal key")


def _require_db() -> None:
    if not db.is_available():
        raise HTTPException(status_code=503, detail="Database not configured")


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
    projects = await projects_repo.list_projects(user_id=x_user_id)
    return {"projects": projects}


@router.post("/projects", status_code=201)
async def create_project(
    body: CreateProjectBody,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    try:
        project = await projects_repo.create_project(
            body.name,
            user_id=x_user_id or "system",
            github_url=body.github_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"project": project}


@router.patch("/projects/{project_id}")
async def update_project(
    project_id: str,
    body: UpdateProjectBody,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    project = await projects_repo.update_project(
        project_id,
        user_id=x_user_id,
        name=body.name,
        github_url=body.github_url,
    )
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    return {"project": project}


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    x_user_id: str | None = Header(default="system"),
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    if not await projects_repo.delete_project(project_id, user_id=x_user_id):
        raise HTTPException(status_code=404, detail="project not found")
    return {"deleted": project_id}


class UpsertBuildBody(BaseModel):
    task_id: str
    project_id: str
    user_id: str = "system"
    branch: str | None = None
    pr_url: str | None = None
    quality_score: float | None = None
    status: str | None = None
    tier: int | None = None
    heal_cycles: int | None = None
    files_changed: int | None = None


@router.post("/builds", status_code=201)
async def upsert_build(
    body: UpsertBuildBody,
    x_internal_key: str | None = Header(default=None),
):
    _check(x_internal_key)
    _require_db()

    project = await projects_repo.get_project(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")

    build = await builds_repo.upsert_build(
        task_id=body.task_id,
        project_id=body.project_id,
        org_id=project.get("org_id"),
        user_id=body.user_id,
        branch=body.branch,
        pr_url=body.pr_url,
        quality_score=body.quality_score,
        status=body.status,
        tier=body.tier,
        heal_cycles=body.heal_cycles,
        files_changed=body.files_changed,
    )
    return {"build": build}


@router.get("/projects/{project_id}/builds")
async def list_builds(
    project_id: str,
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
                "tier": r.get("tier"),
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
    _check(x_internal_key)
    build = await builds_repo.get_build(task_id)
    if not build:
        raise HTTPException(status_code=404, detail="build not found")
    return {"build": build}
