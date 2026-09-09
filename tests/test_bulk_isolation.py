"""Bulk submit isolation — one failure must not block siblings (H-BULK)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.repositories import projects as projects_repo
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
async def test_bulk_partial_failure_isolated(isolated_gantry_home):
    project = await projects_repo.create_project(
        "Bulk Test",
        org_id=DEFAULT_ORG_ID,
        user_id="api",
    )

    calls: list[str] = []

    async def fake_submit(*, goal, project_id, branch_prefix, tier, github_token, extra_params):
        calls.append(goal)
        if "FAIL" in goal:
            raise RuntimeError("simulated agentex failure")
        return f"task_{len(calls)}"

    with (
        patch("api.routes.tasks.agentex_client.submit_task", new=AsyncMock(side_effect=fake_submit)),
        patch("api.routes.tasks.github_tokens.resolve_token", new=AsyncMock(return_value="tok")),
        patch("api.routes.tasks.llm_config_service.resolve_llm_agentex_params", new=AsyncMock(return_value={})),
        patch("api.routes.tasks.task_events.emit_task_event", new=AsyncMock()),
    ):
        from api.routes.tasks import _submit_one

        results = await __import__("asyncio").gather(
            _submit_one(
                goal="ok one",
                project_id=project["id"],
                org_id=DEFAULT_ORG_ID,
                branch_prefix="swarm",
                tier=-1,
                github_token="",
                github_token_secret=None,
                webhook_url=None,
                key_id="k1",
            ),
            _submit_one(
                goal="FAIL two",
                project_id=project["id"],
                org_id=DEFAULT_ORG_ID,
                branch_prefix="swarm",
                tier=-1,
                github_token="",
                github_token_secret=None,
                webhook_url=None,
                key_id="k1",
            ),
            _submit_one(
                goal="ok three",
                project_id=project["id"],
                org_id=DEFAULT_ORG_ID,
                branch_prefix="swarm",
                tier=-1,
                github_token="",
                github_token_secret=None,
                webhook_url=None,
                key_id="k1",
            ),
        )

    ok = [r for r in results if "task_id" in r]
    bad = [r for r in results if "error" in r]
    assert len(ok) == 2
    assert len(bad) == 1
    assert bad[0]["goal"] == "FAIL two"
