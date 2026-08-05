"""Unit tests for Phase 0 platform refactor — no live server required."""
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from api.auth import generate_api_key, hash_key
from api.repositories import keys as keys_repo
from api.repositories import projects as projects_repo
from api.repositories import tasks as tasks_repo
from api.repositories.organizations import DEFAULT_ORG_ID


@pytest.fixture
def isolated_gantry_home(tmp_path, monkeypatch):
    gantry_home = tmp_path / ".gantry"
    projects_base = gantry_home / "projects"
    projects_base.mkdir(parents=True)
    monkeypatch.setenv("GANTRY_HOME", str(gantry_home))
    monkeypatch.setenv("GANTRY_FILES_BASE", str(projects_base))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    return gantry_home


@pytest.mark.asyncio
async def test_key_create_and_authenticate(isolated_gantry_home):
    plaintext = generate_api_key()
    record, _ = await keys_repo.create_key("test-key", plaintext)
    assert record["org_id"] == DEFAULT_ORG_ID
    assert record["scopes"] == ["admin"]

    authed = await keys_repo.authenticate(plaintext)
    assert authed is not None
    assert authed["id"] == record["id"]

    bad = await keys_repo.authenticate("gantry_invalid")
    assert bad is None


@pytest.mark.asyncio
async def test_project_crud_scoped_by_org(isolated_gantry_home):
    project = await projects_repo.create_project(
        "My App",
        org_id=DEFAULT_ORG_ID,
        user_id="api",
        github_url="https://github.com/acme/my-app",
    )
    assert project["github_owner"] == "acme"
    assert project["org_id"] == DEFAULT_ORG_ID

    listed = await projects_repo.list_projects(org_id=DEFAULT_ORG_ID)
    assert any(p["id"] == project["id"] for p in listed)

    other = await projects_repo.get_project(project["id"], org_id="00000000-0000-4000-8000-000000000099")
    assert other is None


@pytest.mark.asyncio
async def test_task_metadata_and_result(isolated_gantry_home):
    await tasks_repo.save_task(
        task_id="task_abc",
        org_id=DEFAULT_ORG_ID,
        project_id="proj_123",
        webhook_url="https://example.com/hook",
        source="api",
        key_id="key_1",
    )
    meta = await tasks_repo.get_task_meta("task_abc", org_id=DEFAULT_ORG_ID)
    assert meta["project_id"] == "proj_123"
    assert meta["webhook_url"] == "https://example.com/hook"

    await tasks_repo.update_task_status(
        "task_abc",
        status="completed",
        pr_url="https://github.com/acme/repo/pull/1",
        branch="swarm/task_abc",
    )
    result = await tasks_repo.get_task_result("task_abc", org_id=DEFAULT_ORG_ID)
    assert result["pr_url"] == "https://github.com/acme/repo/pull/1"


@pytest.mark.asyncio
async def test_find_project_by_github(isolated_gantry_home):
    await projects_repo.create_project(
        "Linked Repo",
        org_id=DEFAULT_ORG_ID,
        github_url="https://github.com/acme/service",
    )
    found = await projects_repo.find_by_github("acme", "service")
    assert found is not None
    assert found["github_repo"] == "service"


@pytest.mark.asyncio
async def test_event_dedup(isolated_gantry_home):
    await tasks_repo.save_task(
        task_id="task_evt",
        org_id=DEFAULT_ORG_ID,
        project_id="proj_1",
    )
    meta = await tasks_repo.get_task_meta("task_evt") or {}
    await tasks_repo.mark_event_fired("task_evt", "task.queued")
    meta = await tasks_repo.get_task_meta("task_evt") or {}
    assert "task.queued" in meta.get("events_fired", [])


def test_crypto_roundtrip():
    from api.crypto import decrypt, encrypt

    plaintext = "ghp_test_token_12345"
    assert decrypt(encrypt(plaintext)) == plaintext
