from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from api import db
from api.repositories.organizations import DEFAULT_ORG_ID, ensure_default_org

_GANTRY_FILES_BASE = Path(__file__).resolve().parents[2] / ".gantry" / "projects"


def _files_base() -> Path:
    import os
    return Path(os.getenv("GANTRY_FILES_BASE", str(Path.home() / ".gantry" / "projects")))


def _registry_path() -> Path:
    return _files_base() / "registry.json"


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
        "org_id": str(row.get("org_id", DEFAULT_ORG_ID)),
        "user_id": row.get("user_id", "system"),
        "name": row["name"],
        "slug": row["slug"],
        "repo_path": row["repo_path"],
        "github_url": row.get("github_url"),
        "github_owner": row.get("github_owner"),
        "github_repo": row.get("github_repo"),
        "linear_team_id": row.get("linear_team_id"),
        "jira_project_key": row.get("jira_project_key"),
        "created_at": row["created_at"].isoformat() if hasattr(row.get("created_at"), "isoformat") else row.get("created_at"),
    }


def _load_registry() -> list[dict]:
    path = _registry_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except Exception:
        return []


def _save_registry(projects: list[dict]) -> None:
    base = _files_base()
    base.mkdir(parents=True, exist_ok=True)
    _registry_path().write_text(json.dumps(projects, indent=2))


async def list_projects(*, org_id: str | None = None, user_id: str | None = None) -> list[dict]:
    if db.is_available():
        if org_id:
            rows = await db.fetch_all(
                "SELECT * FROM projects WHERE org_id = %s ORDER BY created_at DESC",
                (org_id,),
            )
        elif user_id:
            rows = await db.fetch_all(
                "SELECT * FROM projects WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,),
            )
        else:
            rows = await db.fetch_all("SELECT * FROM projects ORDER BY created_at DESC")
        return [_row_to_project(r) for r in rows]

    projects = _load_registry()
    if org_id:
        projects = [p for p in projects if p.get("org_id", DEFAULT_ORG_ID) == org_id]
    return projects


async def get_project(project_id: str, *, org_id: str | None = None, user_id: str | None = None) -> dict | None:
    if db.is_available():
        if org_id:
            row = await db.fetch_one(
                "SELECT * FROM projects WHERE id = %s AND org_id = %s",
                (project_id, org_id),
            )
        elif user_id:
            row = await db.fetch_one(
                "SELECT * FROM projects WHERE id = %s AND user_id = %s",
                (project_id, user_id),
            )
        else:
            row = await db.fetch_one("SELECT * FROM projects WHERE id = %s", (project_id,))
        return _row_to_project(row) if row else None

    for p in _load_registry():
        if p["id"] == project_id and (not org_id or p.get("org_id", DEFAULT_ORG_ID) == org_id):
            return p
    return None


async def find_by_github(owner: str, repo: str) -> dict | None:
    if db.is_available():
        row = await db.fetch_one(
            "SELECT * FROM projects WHERE github_owner = %s AND github_repo = %s LIMIT 1",
            (owner, repo),
        )
        return _row_to_project(row) if row else None
    return next(
        (p for p in _load_registry() if p.get("github_owner") == owner and p.get("github_repo") == repo),
        None,
    )


async def find_by_linear_team(team_id: str) -> dict | None:
    if db.is_available():
        row = await db.fetch_one(
            "SELECT * FROM projects WHERE linear_team_id = %s LIMIT 1",
            (team_id,),
        )
        return _row_to_project(row) if row else None
    return next((p for p in _load_registry() if p.get("linear_team_id") == team_id), None)


async def find_by_jira_key(project_key: str) -> dict | None:
    if db.is_available():
        row = await db.fetch_one(
            "SELECT * FROM projects WHERE jira_project_key = %s LIMIT 1",
            (project_key.upper(),),
        )
        return _row_to_project(row) if row else None
    return next(
        (p for p in _load_registry() if (p.get("jira_project_key") or "").upper() == project_key.upper()),
        None,
    )


async def create_project(
    name: str,
    *,
    org_id: str | None = None,
    user_id: str = "system",
    github_url: str | None = None,
    linear_team_id: str | None = None,
    jira_project_key: str | None = None,
) -> dict:
    name = name.strip()
    if not name:
        raise ValueError("name is required")

    org = org_id or await ensure_default_org()
    slug = _to_slug(name)
    gh = _parse_github_url(github_url) if github_url else {}

    if db.is_available():
        existing = await db.fetch_all(
            "SELECT slug FROM projects WHERE org_id = %s AND slug LIKE %s",
            (org, f"{slug}%"),
        )
        taken = {r["slug"] for r in existing}
        candidate, n = slug, 2
        while candidate in taken:
            candidate = f"{slug}-{n}"
            n += 1
        slug = candidate
        repo_path = str(_files_base() / slug)
        if not github_url:
            Path(repo_path).mkdir(parents=True, exist_ok=True)

        row = await db.fetch_one(
            """
            INSERT INTO projects (
                id, org_id, user_id, name, slug, repo_path,
                github_url, github_owner, github_repo,
                linear_team_id, jira_project_key
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                str(uuid4()), org, user_id, name, slug, repo_path,
                github_url or None, gh.get("github_owner"), gh.get("github_repo"),
                linear_team_id, jira_project_key.upper() if jira_project_key else None,
            ),
        )
        return _row_to_project(row)

    projects = _load_registry()
    taken = {p["slug"] for p in projects}
    candidate, n = slug, 2
    while candidate in taken:
        candidate = f"{slug}-{n}"
        n += 1
    slug = candidate
    repo_path = str(_files_base() / slug)
    if not github_url:
        Path(repo_path).mkdir(parents=True, exist_ok=True)
    project = {
        "id": str(uuid4()),
        "org_id": org,
        "user_id": user_id,
        "name": name,
        "slug": slug,
        "repo_path": repo_path,
        "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        **({"github_url": github_url, **gh} if github_url else {}),
        **({"linear_team_id": linear_team_id} if linear_team_id else {}),
        **({"jira_project_key": jira_project_key.upper()} if jira_project_key else {}),
    }
    projects.append(project)
    _save_registry(projects)
    return project


async def update_project(
    project_id: str,
    *,
    org_id: str | None = None,
    user_id: str | None = None,
    name: str | None = None,
    github_url: str | None = None,
    linear_team_id: str | None = None,
    jira_project_key: str | None = None,
) -> dict | None:
    project = await get_project(project_id, org_id=org_id, user_id=user_id)
    if not project:
        return None

    updates: dict[str, Any] = {}
    if name is not None:
        updates["name"] = name.strip()
    if github_url is not None:
        updates["github_url"] = github_url
        gh = _parse_github_url(github_url)
        updates["github_owner"] = gh.get("github_owner")
        updates["github_repo"] = gh.get("github_repo")
    if linear_team_id is not None:
        updates["linear_team_id"] = linear_team_id
    if jira_project_key is not None:
        updates["jira_project_key"] = jira_project_key.upper()

    if not updates:
        return project

    if db.is_available():
        set_clauses = [f"{k} = %s" for k in updates]
        set_clauses.append("updated_at = now()")
        row = await db.fetch_one(
            f"UPDATE projects SET {', '.join(set_clauses)} WHERE id = %s RETURNING *",
            (*updates.values(), project_id),
        )
        return _row_to_project(row) if row else None

    projects = _load_registry()
    for i, p in enumerate(projects):
        if p["id"] == project_id:
            projects[i] = {**p, **updates}
            _save_registry(projects)
            return projects[i]
    return None


async def delete_project(project_id: str, *, org_id: str | None = None, user_id: str | None = None) -> bool:
    project = await get_project(project_id, org_id=org_id, user_id=user_id)
    if not project:
        return False

    if db.is_available():
        await db.execute("DELETE FROM projects WHERE id = %s", (project_id,))
        return True

    projects = [p for p in _load_registry() if p["id"] != project_id]
    _save_registry(projects)
    return True
