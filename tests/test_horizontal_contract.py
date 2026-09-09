"""Horizontal engine contract — pure track_manager helpers (H-PAR, H-CON, H-DEP)."""
from __future__ import annotations

from workflows.swarm.track_manager import (
    MAX_PARALLEL_TRACKS,
    _extract_tracks,
    _merge_build_results,
    _normalise_path,
    _order_tracks_by_deps,
    _resolve_track_conflicts,
    _track_plan,
)


def test_h_par_extract_respects_parallel_cap():
    plan = {
        "tracks": [{"label": f"t{i}", "implementation_steps": [f"s{i}"], "key_files": []} for i in range(10)]
    }
    tracks = _extract_tracks(plan, max_parallel_tracks=2)
    assert len(tracks) == 4  # max_parallel_tracks * 2


def test_h_dep_orders_waves():
    tracks = [
        {"label": "backend", "key_files": [], "implementation_steps": []},
        {"label": "frontend", "key_files": [], "implementation_steps": [], "depends_on": ["backend"]},
    ]
    waves = _order_tracks_by_deps(tracks)
    assert len(waves) == 2
    assert waves[0][0]["label"] == "backend"
    assert waves[1][0]["label"] == "frontend"


def test_h_con_same_wave_collision():
    tracks = [
        {"label": "alpha", "key_files": ["src/shared.ts"], "implementation_steps": []},
        {"label": "beta", "key_files": ["src/shared.ts"], "implementation_steps": []},
    ]
    updated, warnings = _resolve_track_conflicts(tracks)
    assert warnings
    owners = []
    for t in updated:
        if "src/shared.ts" in t.get("key_files", []):
            owners.append(t["label"])
    assert owners == ["alpha"]


def test_h_con_different_waves_no_collision():
    tracks = [
        {"label": "backend", "key_files": ["src/api.ts"], "implementation_steps": []},
        {
            "label": "frontend",
            "key_files": ["src/api.ts"],
            "implementation_steps": [],
            "depends_on": ["backend"],
        },
    ]
    _, warnings = _resolve_track_conflicts(tracks)
    assert warnings == []


def test_track_plan_scopes_steps():
    plan = {"goal": "x", "key_files": ["a.py"], "implementation_steps": ["global"]}
    track = {"label": "t1", "implementation_steps": ["local"], "key_files": ["b.py"]}
    scoped = _track_plan(plan, track)
    assert scoped["implementation_steps"] == ["local"]
    assert scoped["key_files"] == ["b.py"]


def test_merge_build_results_all_success():
    payloads = (
        '{"success": true, "edits": [{"path": "a.py"}], "summary": "ok"}',
        '{"success": true, "edits": [{"path": "b.py"}], "summary": "done"}',
    )
    merged = _merge_build_results(payloads)
    assert merged["success"] is True
    assert len(merged["edits"]) == 2


def test_normalise_path_contract():
    assert _normalise_path("./Src/File.TS") == "src/file.ts"


def test_max_parallel_tracks_constant():
    assert MAX_PARALLEL_TRACKS == 4
