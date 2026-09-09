"""
Unit tests for _normalise_path and _resolve_track_conflicts.
No Temporal runtime required — pure Python.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from workflows.swarm.track_manager import _normalise_path, _resolve_track_conflicts


# ── _normalise_path ───────────────────────────────────────────────────────────

def test_normalise_strips_leading_dotslash():
    assert _normalise_path("./src/app.ts") == "src/app.ts"

def test_normalise_strips_leading_slash():
    assert _normalise_path("/src/app.ts") == "src/app.ts"

def test_normalise_lowercases():
    assert _normalise_path("Src/App.TS") == "src/app.ts"

def test_normalise_empty():
    assert _normalise_path("   ") == ""

def test_normalise_no_prefix():
    assert _normalise_path("src/app.ts") == "src/app.ts"


# ── _resolve_track_conflicts ──────────────────────────────────────────────────

def _make_track(label, key_files, depends_on=None):
    t = {"label": label, "key_files": key_files, "implementation_steps": ["do something"]}
    if depends_on:
        t["depends_on"] = depends_on
    return t


def test_no_conflict_single_track():
    tracks = [_make_track("main", ["src/app.ts", "src/utils.ts"])]
    updated, warnings = _resolve_track_conflicts(tracks)
    assert warnings == []
    assert updated[0]["key_files"] == ["src/app.ts", "src/utils.ts"]


def test_no_conflict_disjoint_files():
    tracks = [
        _make_track("frontend", ["src/ui.tsx"]),
        _make_track("backend", ["src/api.py"]),
    ]
    updated, warnings = _resolve_track_conflicts(tracks)
    assert warnings == []
    assert updated[0]["key_files"] == ["src/ui.tsx"]
    assert updated[1]["key_files"] == ["src/api.py"]


def test_conflict_same_wave_reassigned():
    tracks = [
        _make_track("backend", ["src/app.ts", "src/db.ts"]),
        _make_track("frontend", ["src/app.ts", "src/ui.tsx"]),
    ]
    updated, warnings = _resolve_track_conflicts(tracks)
    assert len(warnings) == 1
    assert "src/app.ts" in warnings[0]
    # 'backend' sorts before 'frontend' — backend keeps the file
    backend = next(t for t in updated if t["label"] == "backend")
    frontend = next(t for t in updated if t["label"] == "frontend")
    assert "src/app.ts" in backend["key_files"]
    assert "src/app.ts" not in frontend["key_files"]
    assert "src/ui.tsx" in frontend["key_files"]


def test_conflict_path_normalisation():
    """./src/app.ts and src/app.ts should be treated as the same file."""
    tracks = [
        _make_track("alpha", ["src/app.ts"]),
        _make_track("beta", ["./src/app.ts"]),
    ]
    updated, warnings = _resolve_track_conflicts(tracks)
    assert len(warnings) == 1
    alpha = next(t for t in updated if t["label"] == "alpha")
    beta = next(t for t in updated if t["label"] == "beta")
    assert "src/app.ts" in alpha["key_files"]
    assert beta["key_files"] == []


def test_no_conflict_sequential_tracks():
    """Tracks in different waves (depends_on) may share files — not a conflict."""
    tracks = [
        _make_track("backend", ["src/schema.ts"]),
        _make_track("frontend", ["src/schema.ts"], depends_on=["backend"]),
    ]
    updated, warnings = _resolve_track_conflicts(tracks)
    assert warnings == []
    assert "src/schema.ts" in updated[0]["key_files"]
    assert "src/schema.ts" in updated[1]["key_files"]


def test_multiple_conflicts_same_wave():
    tracks = [
        _make_track("a", ["shared/config.ts", "shared/types.ts", "a_only.ts"]),
        _make_track("b", ["shared/config.ts", "shared/types.ts", "b_only.ts"]),
        _make_track("c", ["shared/config.ts", "c_only.ts"]),
    ]
    updated, warnings = _resolve_track_conflicts(tracks)
    # 'a' sorts first — keeps both shared files
    a = next(t for t in updated if t["label"] == "a")
    b = next(t for t in updated if t["label"] == "b")
    c = next(t for t in updated if t["label"] == "c")
    assert "shared/config.ts" in a["key_files"]
    assert "shared/types.ts" in a["key_files"]
    assert "shared/config.ts" not in b["key_files"]
    assert "shared/types.ts" not in b["key_files"]
    assert "shared/config.ts" not in c["key_files"]
    assert len(warnings) == 3  # config×2 (b,c) + types×1 (b)


def test_empty_key_files_ignored():
    tracks = [
        _make_track("x", []),
        _make_track("y", []),
    ]
    updated, warnings = _resolve_track_conflicts(tracks)
    assert warnings == []


def test_conflict_only_in_first_wave_not_second():
    """
    Wave 0: a, b (parallel) — conflict on shared.ts
    Wave 1: c (depends on a) — also lists shared.ts but that's wave 1, no parallel conflict
    """
    tracks = [
        _make_track("a", ["shared.ts", "a.ts"]),
        _make_track("b", ["shared.ts", "b.ts"]),
        _make_track("c", ["shared.ts", "c.ts"], depends_on=["a"]),
    ]
    updated, warnings = _resolve_track_conflicts(tracks)
    # Only a vs b conflict in wave 0
    assert len(warnings) == 1
    a = next(t for t in updated if t["label"] == "a")
    b = next(t for t in updated if t["label"] == "b")
    c = next(t for t in updated if t["label"] == "c")
    assert "shared.ts" in a["key_files"]
    assert "shared.ts" not in b["key_files"]
    assert "shared.ts" in c["key_files"]  # sequential with a — untouched
