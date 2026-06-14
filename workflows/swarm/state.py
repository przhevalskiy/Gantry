"""
State helpers for SwarmOrchestrator.

Snapshot save/restore is handled via Temporal activities
(swarm_git_snapshot_save / swarm_git_snapshot_restore) called directly from
SwarmOrchestrator._run_pipeline.  This module holds the manifest builder that
constructs and rebuilds the shared track manifest stored on the workflow instance.
"""
from __future__ import annotations


def build_manifest(tracks: list[dict], completed_edits: list[dict] | None = None) -> dict:
    """
    Build (or rebuild) the shared workflow manifest from a list of track dicts.

    The manifest is stored on ``SwarmOrchestrator._manifest`` so it survives
    Temporal replays.  ``completed_edits`` lets callers carry forward edits
    accumulated in a prior manifest version (e.g. after an Architect re-plan).
    """
    return {
        "version": 1,
        "tracks": [
            {
                "label": t.get("label", "unknown"),
                "key_files": t.get("key_files", []),
                "exports": t.get("exports", []),
                "goal_summary": (t.get("implementation_steps") or [""])[0][:120],
            }
            for t in tracks
        ],
        "completed_edits": completed_edits if completed_edits is not None else [],
    }
