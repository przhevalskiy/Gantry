"""Task metadata patching — track_warnings and pending_hitl for API/SSE."""
from __future__ import annotations

import pytest

from api.repositories import tasks as tasks_repo


@pytest.fixture
def isolated_tasks(tmp_path, monkeypatch):
    monkeypatch.setenv("GANTRY_HOME", str(tmp_path))
    yield tmp_path


@pytest.mark.asyncio
async def test_patch_track_warnings(isolated_tasks):
    await tasks_repo.save_task(
        "task-1",
        org_id="org-default",
        project_id="proj-1",
        meta={"playbook": "platform-backlog"},
    )
    ok = await tasks_repo.patch_task_meta(
        "task-1",
        track_warnings=["file x claimed by track-a and track-b"],
    )
    assert ok
    meta = await tasks_repo.get_task_meta("task-1")
    assert meta["track_warnings"] == ["file x claimed by track-a and track-b"]


@pytest.mark.asyncio
async def test_pending_hitl_add_and_remove(isolated_tasks):
    await tasks_repo.save_task("task-2", org_id="org-default", project_id="proj-1")
    wf = "task-2-r0-approval-architect_plan"
    ok = await tasks_repo.patch_task_meta(
        "task-2",
        pending_hitl_add={
            "checkpoint": "architect_plan",
            "workflow_id": wf,
            "action": "Approve plan?",
        },
    )
    assert ok
    meta = await tasks_repo.get_task_meta("task-2")
    assert len(meta["pending_hitl"]) == 1
    assert meta["pending_hitl"][0]["workflow_id"] == wf

    ok = await tasks_repo.patch_task_meta("task-2", pending_hitl_remove=wf)
    assert ok
    meta = await tasks_repo.get_task_meta("task-2")
    assert meta["pending_hitl"] == []


@pytest.mark.asyncio
async def test_patch_unknown_task_returns_false(isolated_tasks):
    ok = await tasks_repo.patch_task_meta("missing", track_warnings=["x"])
    assert ok is False
