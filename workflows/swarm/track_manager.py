"""
Track management helpers for SwarmOrchestrator.

Extracted from workflows/swarm_orchestrator.py — pure functions, no Temporal imports.
"""
from __future__ import annotations

import json
import re

MAX_PARALLEL_TRACKS = 4


def _extract_tracks(architect_plan: dict, max_parallel_tracks: int = MAX_PARALLEL_TRACKS) -> list[dict]:
    """Extract all tracks from an architect plan (flat list, order preserved)."""
    tracks = architect_plan.get("tracks", [])
    if tracks:
        # Allow up to max_parallel_tracks * 2 total tracks when using wave execution
        return tracks[:max_parallel_tracks * 2]
    steps = architect_plan.get("implementation_steps", [])
    return [{"label": "main", "implementation_steps": steps, "key_files": architect_plan.get("key_files", [])}]


def _order_tracks_by_deps(tracks: list[dict]) -> list[list[dict]]:
    """
    Topological sort of tracks by depends_on field.
    Returns a list of waves — each wave is a list of tracks that can run in parallel.
    Tracks with no dependencies are in wave 0. Tracks that depend on wave 0 are in wave 1, etc.
    Circular dependencies are broken by ignoring the offending edge (logged as a warning).

    Example:
      backend (no deps) → wave 0
      frontend (depends_on=['backend']) → wave 1
      tests (depends_on=['backend', 'frontend']) → wave 2
    """
    label_to_track = {t.get("label", f"track-{i}"): t for i, t in enumerate(tracks)}
    all_labels = set(label_to_track)

    # Build adjacency: label → set of labels it depends on (filtered to known labels)
    deps: dict[str, set[str]] = {}
    for label, track in label_to_track.items():
        raw_deps = set(track.get("depends_on", []))
        deps[label] = raw_deps & all_labels  # ignore deps on unknown tracks

    waves: list[list[dict]] = []
    remaining = set(all_labels)
    completed: set[str] = set()

    while remaining:
        # Find all tracks whose dependencies are all completed
        wave_labels = {
            label for label in remaining
            if deps[label].issubset(completed)
        }
        if not wave_labels:
            # Circular dependency — break by taking all remaining tracks
            wave_labels = remaining
        wave = [label_to_track[label] for label in sorted(wave_labels)]
        waves.append(wave)
        completed |= wave_labels
        remaining -= wave_labels

    return waves


def _normalise_path(p: str) -> str:
    """Strip leading ./ and / for stable file-path comparison across tracks."""
    p = p.strip()
    while p.startswith("./") or p.startswith("/"):
        p = p[2:] if p.startswith("./") else p[1:]
    return p.lower()


def _resolve_track_conflicts(tracks: list[dict]) -> tuple[list[dict], list[str]]:
    """
    Detect key_file collisions between tracks that run in the same wave (parallel).

    For each collision the file is kept in whichever track claims it first when
    the wave's tracks are sorted alphabetically by label — deterministic, no LLM
    call required.  Returns (updated_tracks, human-readable warning strings).
    """
    waves = _order_tracks_by_deps(tracks)
    label_to_idx = {t.get("label", f"track-{i}"): i for i, t in enumerate(tracks)}
    new_key_files: dict[int, list[str]] = {i: list(t.get("key_files", [])) for i, t in enumerate(tracks)}
    warnings: list[str] = []

    for wave in waves:
        if len(wave) < 2:
            continue
        wave_sorted = sorted(wave, key=lambda t: t.get("label", ""))
        claimed: dict[str, str] = {}  # normalised path → owner label

        for track in wave_sorted:
            label = track.get("label", "")
            idx = label_to_idx[label]
            keep: list[str] = []
            for path in new_key_files[idx]:
                norm = _normalise_path(path)
                if not norm:
                    keep.append(path)
                    continue
                if norm not in claimed:
                    claimed[norm] = label
                    keep.append(path)
                else:
                    warnings.append(
                        f"'{path}' claimed by both '{label}' and '{claimed[norm]}' "
                        f"(parallel wave) — ownership kept by '{claimed[norm]}'"
                    )
            new_key_files[idx] = keep

    updated = [{**t, "key_files": new_key_files[i]} for i, t in enumerate(tracks)]
    return updated, warnings


def _track_plan(architect_plan: dict, track: dict) -> dict:
    """Build a per-track plan dict for the Builder."""
    return {
        **architect_plan,
        "implementation_steps": track.get("implementation_steps", []),
        "key_files": track.get("key_files", architect_plan.get("key_files", [])),
    }


def _merge_build_results(builder_jsons: tuple[str, ...]) -> dict:
    """Merge edits and success flags from parallel Builder results."""
    all_edits: list[dict] = []
    summaries: list[str] = []
    success = True
    for bj in builder_jsons:
        try:
            bd = json.loads(bj)
        except (json.JSONDecodeError, ValueError):
            bd = {"success": False, "edits": [], "summary": str(bj)}
        if not bd.get("success"):
            success = False
        all_edits.extend(bd.get("edits", []))
        if bd.get("summary"):
            summaries.append(bd["summary"])
    return {
        "success": success,
        "edits": all_edits,
        "summary": " | ".join(summaries) if summaries else "Build complete.",
    }
