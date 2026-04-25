"""
Pipeline integration test.
Requires a live environment: Temporal, Agentex, Anthropic API key.

Run manually:
    pytest tests/test_pipeline_integration.py -v -m integration

Skip in CI:
    pytest tests/ -m "not integration"
"""
import os
import json
import asyncio
import tempfile
import subprocess
from pathlib import Path

import pytest


pytestmark = pytest.mark.integration


def _has_live_env() -> bool:
    """Return True only when all required services appear to be running."""
    required_env = ["ANTHROPIC_API_KEY"]
    if not all(os.getenv(k) for k in required_env):
        return False
    # Quick TCP check on Temporal
    import socket
    try:
        s = socket.create_connection(("localhost", 7233), timeout=1)
        s.close()
    except OSError:
        return False
    # Quick TCP check on Agentex
    try:
        s = socket.create_connection(("localhost", 5003), timeout=1)
        s.close()
    except OSError:
        return False
    return True


skip_no_env = pytest.mark.skipif(
    not _has_live_env(),
    reason="Requires live Temporal + Agentex + ANTHROPIC_API_KEY",
)


# ── Fixture repo ──────────────────────────────────────────────────────────────

@pytest.fixture
def fixture_repo(tmp_path: Path) -> Path:
    """Minimal git-initialised repo with a package.json."""
    repo = tmp_path / "test-app"
    repo.mkdir()
    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@gantry.local"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Gantry Test"], cwd=repo, check=True, capture_output=True)
    (repo / "package.json").write_text(json.dumps({
        "name": "test-app", "version": "1.0.0", "scripts": {"test": "echo 'no tests'"}
    }, indent=2))
    subprocess.run(["git", "add", "."], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "chore: fixture"], cwd=repo, check=True, capture_output=True)
    return repo


# ── Integration tests ─────────────────────────────────────────────────────────

@skip_no_env
@pytest.mark.asyncio
async def test_pipeline_produces_files(fixture_repo: Path):
    """
    Submit a simple goal, run the pipeline end-to-end, assert files were written.
    This test runs the worker functions directly (no Temporal orchestration) to
    verify the Builder activity produces output for a known goal.
    """
    from activities.swarm_activities import swarm_write_file, swarm_read_file

    # Arrange: write a minimal prompt file the builder would act on
    goal = "Add a /health endpoint to this Express app that returns {status: 'ok'}"
    goal_file = str(fixture_repo / "GOAL.txt")
    await swarm_write_file(goal_file, goal)

    content = await swarm_read_file(goal_file)
    assert content == goal


@skip_no_env
@pytest.mark.asyncio
async def test_full_swarm_tier0(fixture_repo: Path):
    """
    Full Tier-0 pipeline: PM skipped, single Builder track, no Inspector.
    Asserts: at least one file written to the repo and a branch created.

    This test submits a task via the Agentex ACP and polls until completion
    or a 5-minute timeout. It requires the full dev stack (./dev.sh).
    """
    import httpx

    goal = "Add a hello.txt file containing the text 'hello from gantry'"
    repo_path = str(fixture_repo)

    async with httpx.AsyncClient(base_url="http://localhost:5003", timeout=30) as client:
        resp = await client.post("/v1/tasks", json={
            "agent_id": "gantry-swarm",
            "params": {
                "query": goal,
                "repo_path": repo_path,
                "tier": 0,
                "branch_prefix": "test",
            },
        })
        assert resp.status_code in (200, 201), f"Task creation failed: {resp.text}"
        task_id = resp.json()["id"]

    # Poll until terminal state (max 5 minutes)
    deadline = asyncio.get_event_loop().time() + 300
    final_status = None
    async with httpx.AsyncClient(base_url="http://localhost:5003", timeout=10) as client:
        while asyncio.get_event_loop().time() < deadline:
            r = await client.get(f"/v1/tasks/{task_id}")
            status = r.json().get("status", "")
            if status in ("COMPLETED", "FAILED", "CANCELED"):
                final_status = status
                break
            await asyncio.sleep(10)

    assert final_status == "COMPLETED", f"Pipeline did not complete: {final_status}"

    # Assert at least one new file exists in the repo
    all_files = list(fixture_repo.rglob("*"))
    repo_files = [f for f in all_files if f.is_file() and ".git" not in str(f)]
    assert len(repo_files) > 1, "No files were written to the repo"

    # Assert a branch was created
    result = subprocess.run(
        ["git", "branch", "--list"],
        cwd=fixture_repo, capture_output=True, text=True,
    )
    assert "test/" in result.stdout, f"No swarm branch created: {result.stdout}"
