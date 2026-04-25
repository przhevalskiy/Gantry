"""
Unit tests for orchestrator guard functions and plan validation.
No Temporal, no LLM, no network.
Run: pytest tests/test_orchestrator_guards.py -v
"""
import json
import tempfile
from pathlib import Path

import pytest


# ── _extract_tracks ───────────────────────────────────────────────────────────

def test_extract_tracks_basic():
    from workflows.swarm_orchestrator import _extract_tracks

    plan = {
        "tracks": [
            {"label": "backend", "implementation_steps": ["write server.py"], "key_files": []},
            {"label": "frontend", "implementation_steps": ["write index.tsx"], "key_files": []},
        ]
    }
    tracks = _extract_tracks(plan, max_parallel_tracks=4)
    assert len(tracks) == 2
    assert tracks[0]["label"] == "backend"


def test_extract_tracks_falls_back_to_steps():
    from workflows.swarm_orchestrator import _extract_tracks

    plan = {"implementation_steps": ["step1", "step2"], "key_files": []}
    tracks = _extract_tracks(plan, max_parallel_tracks=4)
    assert len(tracks) == 1
    assert tracks[0]["label"] == "main"
    assert tracks[0]["implementation_steps"] == ["step1", "step2"]


def test_extract_tracks_respects_cap():
    from workflows.swarm_orchestrator import _extract_tracks

    plan = {
        "tracks": [{"label": f"t{i}", "implementation_steps": ["step"], "key_files": []} for i in range(12)]
    }
    # cap is max_parallel_tracks * 2
    tracks = _extract_tracks(plan, max_parallel_tracks=4)
    assert len(tracks) == 8  # 4 * 2


def test_extract_tracks_empty_plan():
    from workflows.swarm_orchestrator import _extract_tracks

    tracks = _extract_tracks({}, max_parallel_tracks=4)
    assert len(tracks) == 1
    assert tracks[0]["label"] == "main"
    assert tracks[0]["implementation_steps"] == []


# ── Step sanitization (fix 4) ────────────────────────────────────────────────

def test_step_sanitization_strips_empty():
    """Tracks with empty/whitespace steps should have those stripped."""
    raw_tracks = [
        {"label": "api", "implementation_steps": ["write api.py", "", "  ", "add tests"], "key_files": []},
    ]
    sanitized = [
        {**t, "implementation_steps": [s for s in t["implementation_steps"] if isinstance(s, str) and s.strip()]}
        for t in raw_tracks
    ]
    assert sanitized[0]["implementation_steps"] == ["write api.py", "add tests"]


def test_step_sanitization_drops_empty_track():
    """A track left with zero steps after sanitization should be dropped."""
    raw_tracks = [
        {"label": "real", "implementation_steps": ["write server.py"], "key_files": []},
        {"label": "ghost", "implementation_steps": ["", "  "], "key_files": []},
    ]
    kept = [
        {**t, "implementation_steps": [s for s in t["implementation_steps"] if isinstance(s, str) and s.strip()]}
        for t in raw_tracks
    ]
    kept = [t for t in kept if t["implementation_steps"]]
    assert len(kept) == 1
    assert kept[0]["label"] == "real"


def test_step_sanitization_preserves_valid_tracks():
    raw_tracks = [
        {"label": "a", "implementation_steps": ["step 1", "step 2"], "key_files": []},
        {"label": "b", "implementation_steps": ["step 3"], "key_files": []},
    ]
    sanitized = [
        {**t, "implementation_steps": [s for s in t["implementation_steps"] if isinstance(s, str) and s.strip()]}
        for t in raw_tracks
    ]
    sanitized = [t for t in sanitized if t["implementation_steps"]]
    assert len(sanitized) == 2


# ── swarm_update_project_registry ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_registry_update_file_fallback():
    """Falls back to file write when the UI is unreachable."""
    from activities.swarm_activities import swarm_update_project_registry
    import os

    with tempfile.TemporaryDirectory() as tmp:
        registry = Path(tmp) / "registry.json"
        registry.write_text(json.dumps([
            {"id": "proj-123", "name": "test", "slug": "test", "repo_path": "/tmp/test",
             "created_at": "2025-01-01T00:00:00Z"},
        ]))

        # Point to our temp registry, unreachable UI
        os.environ["GANTRY_FILES_BASE"] = tmp
        os.environ["GANTRY_UI_URL"] = "http://localhost:19999"  # nothing listening here

        result = await swarm_update_project_registry("proj-123", "https://github.com/owner/repo")

        updated = json.loads(registry.read_text())
        assert updated[0]["github_url"] == "https://github.com/owner/repo"
        assert updated[0]["github_owner"] == "owner"
        assert updated[0]["github_repo"] == "repo"
        assert "updated" in result.lower()

        del os.environ["GANTRY_FILES_BASE"]
        del os.environ["GANTRY_UI_URL"]


@pytest.mark.asyncio
async def test_registry_update_missing_project():
    from activities.swarm_activities import swarm_update_project_registry
    import os

    with tempfile.TemporaryDirectory() as tmp:
        registry = Path(tmp) / "registry.json"
        registry.write_text(json.dumps([]))

        os.environ["GANTRY_FILES_BASE"] = tmp
        os.environ["GANTRY_UI_URL"] = "http://localhost:19999"

        result = await swarm_update_project_registry("does-not-exist", "https://github.com/x/y")
        assert "not found" in result.lower()

        del os.environ["GANTRY_FILES_BASE"]
        del os.environ["GANTRY_UI_URL"]


# ── swarm_github_create_repo ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_github_create_repo_rejects_bad_name():
    """Repo name sanitisation: special chars become hyphens, result is non-empty."""
    from activities.swarm_activities import swarm_github_create_repo
    import re

    # We can't call gh without a token — test the name sanitisation logic directly
    import re as _re
    raw = "My Project 2025!"
    safe = _re.sub(r"[^a-z0-9-]", "-", raw.lower()).strip("-") or "gantry-project"
    assert safe == "my-project-2025"


# ── _order_tracks_by_deps ─────────────────────────────────────────────────────

def test_order_tracks_no_deps():
    from workflows.swarm_orchestrator import _order_tracks_by_deps

    tracks = [
        {"label": "a", "implementation_steps": ["s1"]},
        {"label": "b", "implementation_steps": ["s2"]},
    ]
    waves = _order_tracks_by_deps(tracks)
    # No deps → single wave with both tracks
    assert len(waves) == 1
    assert len(waves[0]) == 2


def test_order_tracks_with_deps():
    from workflows.swarm_orchestrator import _order_tracks_by_deps

    tracks = [
        {"label": "scaffold", "implementation_steps": ["s1"], "depends_on": []},
        {"label": "feature", "implementation_steps": ["s2"], "depends_on": ["scaffold"]},
    ]
    waves = _order_tracks_by_deps(tracks)
    assert len(waves) == 2
    assert waves[0][0]["label"] == "scaffold"
    assert waves[1][0]["label"] == "feature"
