"""Push-primary task status sync tests."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from api.services import poller
from api.services import task_sync


@pytest.fixture
def gantry_home(tmp_path, monkeypatch):
    home = tmp_path / ".gantry"
    home.mkdir()
    monkeypatch.setenv("GANTRY_HOME", str(home))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    return home


@pytest.mark.asyncio
async def test_apply_status_running_updates_file_store(gantry_home):
    from api.repositories import tasks as tasks_repo

    await tasks_repo.save_task(
        "task_run_1",
        org_id="org_a",
        project_id="proj_1",
        source="api",
    )

    with patch("api.services.task_sync.task_events.emit_for_agentex_status", new_callable=AsyncMock) as emit:
        meta = await task_sync.apply_status_update("task_run_1", "running")
        emit.assert_awaited_once()
        assert meta["status"] == "running"

    stored = await tasks_repo.get_task_meta("task_run_1")
    assert stored["status"] == "running"


@pytest.mark.asyncio
async def test_apply_status_completed_marks_webhook_and_emits(gantry_home):
    from api.repositories import tasks as tasks_repo

    await tasks_repo.save_task(
        "task_done_1",
        org_id="org_a",
        project_id="proj_1",
        webhook_url="https://example.com/hook",
        source="api",
    )

    with patch("api.services.task_sync.task_events.emit_for_agentex_status", new_callable=AsyncMock) as emit:
        with patch("api.services.task_sync.builds_repo.upsert_build", new_callable=AsyncMock) as upsert:
            upsert.return_value = {"task_id": "task_done_1"}
            meta = await task_sync.apply_status_update(
                "task_done_1",
                "completed",
                pr_url="https://github.com/acme/api/pull/1",
                branch="swarm/task_done_1",
                result={"pr_url": "https://github.com/acme/api/pull/1", "branch": "swarm/task_done_1"},
            )

    emit.assert_awaited_once()
    assert meta["status"] == "completed"
    assert meta["pr_url"].endswith("/pull/1")
    assert meta.get("webhook_fired") is True


def test_poller_default_is_fallback_not_legacy():
    assert poller.poller_mode() == "fallback"
    assert poller.poll_interval_seconds("fallback") == 60
    assert poller.poll_interval_seconds("legacy") == 10


def test_poller_off_modes(monkeypatch):
    monkeypatch.setenv("GANTRY_STATUS_POLLER", "off")
    assert poller.poller_mode() == "off"
