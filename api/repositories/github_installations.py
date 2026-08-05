"""GitHub App installation records — org-scoped, DB + file fallback."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from api import db


def _store_path() -> Path:
    import os

    return Path(os.getenv("GANTRY_HOME", str(Path.home() / ".gantry"))) / "github_installations.json"


def _load_file() -> list[dict]:
    path = _store_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except Exception:
        return []


def _save_file(records: list[dict]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(records, indent=2))


def _row_to_record(row: dict) -> dict:
    repos = row.get("repos") or []
    if isinstance(repos, str):
        repos = json.loads(repos)
    return {
        "installation_id": int(row["installation_id"]),
        "org_id": str(row["org_id"]),
        "account_login": row["account_login"],
        "account_type": row.get("account_type", "Organization"),
        "repository_selection": row.get("repository_selection", "selected"),
        "repos": repos,
        "suspended_at": row.get("suspended_at"),
        "created_at": row["created_at"].isoformat() if hasattr(row.get("created_at"), "isoformat") else row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _repo_key(owner: str, name: str) -> str:
    return f"{owner.lower()}/{name.lower()}"


def _covers_repo(record: dict, owner: str, repo: str) -> bool:
    if record.get("suspended_at"):
        return False
    if record.get("repository_selection") == "all":
        return owner.lower() == record["account_login"].lower()
    repos = record.get("repos") or []
    target = _repo_key(owner, repo)
    return any(_repo_key(r.get("owner", ""), r.get("name", "")) == target for r in repos)


async def upsert_installation(
    *,
    installation_id: int,
    org_id: str,
    account_login: str,
    account_type: str = "Organization",
    repository_selection: str = "selected",
    repos: list[dict] | None = None,
    suspended_at: str | None = None,
) -> dict:
    repo_list = repos or []

    if db.is_available():
        row = await db.fetch_one(
            """
            INSERT INTO github_installations (
                installation_id, org_id, account_login, account_type,
                repository_selection, repos, suspended_at
            )
            VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)
            ON CONFLICT (installation_id) DO UPDATE SET
                org_id = EXCLUDED.org_id,
                account_login = EXCLUDED.account_login,
                account_type = EXCLUDED.account_type,
                repository_selection = EXCLUDED.repository_selection,
                repos = CASE
                    WHEN EXCLUDED.repos != '[]'::jsonb THEN EXCLUDED.repos
                    ELSE github_installations.repos
                END,
                suspended_at = EXCLUDED.suspended_at,
                updated_at = now()
            RETURNING *
            """,
            (
                installation_id,
                org_id,
                account_login,
                account_type,
                repository_selection,
                json.dumps(repo_list),
                suspended_at,
            ),
        )
        return _row_to_record(row)

    records = _load_file()
    now = datetime.now(timezone.utc).isoformat()
    updated = False
    for i, rec in enumerate(records):
        if rec["installation_id"] == installation_id:
            records[i] = {
                **rec,
                "org_id": org_id,
                "account_login": account_login,
                "account_type": account_type,
                "repository_selection": repository_selection,
                "repos": repo_list or rec.get("repos", []),
                "suspended_at": suspended_at,
                "updated_at": now,
            }
            updated = True
            break
    if not updated:
        records.append(
            {
                "installation_id": installation_id,
                "org_id": org_id,
                "account_login": account_login,
                "account_type": account_type,
                "repository_selection": repository_selection,
                "repos": repo_list,
                "suspended_at": suspended_at,
                "created_at": now,
                "updated_at": now,
            }
        )
    _save_file(records)
    return next(r for r in records if r["installation_id"] == installation_id)


async def add_repositories(installation_id: int, repos: list[dict]) -> dict | None:
    record = await get_installation(installation_id)
    if not record:
        return None

    existing = {_repo_key(r["owner"], r["name"]) for r in record.get("repos", [])}
    merged = list(record.get("repos", []))
    for repo in repos:
        key = _repo_key(repo.get("owner", ""), repo.get("name", ""))
        if key not in existing:
            merged.append({"owner": repo.get("owner", ""), "name": repo.get("name", "")})
            existing.add(key)

    return await upsert_installation(
        installation_id=installation_id,
        org_id=record["org_id"],
        account_login=record["account_login"],
        account_type=record["account_type"],
        repository_selection=record["repository_selection"],
        repos=merged,
        suspended_at=record.get("suspended_at"),
    )


async def remove_repositories(installation_id: int, repos: list[dict]) -> dict | None:
    record = await get_installation(installation_id)
    if not record:
        return None

    remove_keys = {_repo_key(r.get("owner", ""), r.get("name", "")) for r in repos}
    merged = [
        r for r in record.get("repos", [])
        if _repo_key(r.get("owner", ""), r.get("name", "")) not in remove_keys
    ]

    return await upsert_installation(
        installation_id=installation_id,
        org_id=record["org_id"],
        account_login=record["account_login"],
        account_type=record["account_type"],
        repository_selection=record["repository_selection"],
        repos=merged,
        suspended_at=record.get("suspended_at"),
    )


async def delete_installation(installation_id: int) -> bool:
    if db.is_available():
        await db.execute(
            "DELETE FROM github_installations WHERE installation_id = %s",
            (installation_id,),
        )
        return True

    records = [r for r in _load_file() if r["installation_id"] != installation_id]
    _save_file(records)
    return True


async def get_installation(installation_id: int) -> dict | None:
    if db.is_available():
        row = await db.fetch_one(
            "SELECT * FROM github_installations WHERE installation_id = %s",
            (installation_id,),
        )
        return _row_to_record(row) if row else None

    return next((r for r in _load_file() if r["installation_id"] == installation_id), None)


async def list_by_org(org_id: str) -> list[dict]:
    if db.is_available():
        rows = await db.fetch_all(
            "SELECT * FROM github_installations WHERE org_id = %s ORDER BY created_at DESC",
            (org_id,),
        )
        return [_row_to_record(r) for r in rows]

    return [r for r in _load_file() if r.get("org_id") == org_id]


async def find_for_repo(org_id: str, owner: str, repo: str) -> dict | None:
    installations = await list_by_org(org_id)
    for record in installations:
        if _covers_repo(record, owner, repo):
            return record
    return None
