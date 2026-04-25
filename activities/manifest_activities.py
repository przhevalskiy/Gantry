"""Shared manifest activities for cross-track coordination."""
from __future__ import annotations

import json
from pathlib import Path

from temporalio import activity

from activities._shared import logger

# .gantry/manifest.json is written by the orchestrator after the Architect
# finishes and read by every Builder before it starts writing code.
# This gives parallel builders visibility into what other tracks own and export,
# preventing file-ownership collisions and enabling safe cross-track imports.
_MANIFEST_FILE = ".gantry/manifest.json"


@activity.defn(name="manifest_write")
async def manifest_write(repo_path: str, tracks: list[dict]) -> str:
    """Initialize the shared manifest from the architect's tracks array."""
    p = Path(repo_path) / _MANIFEST_FILE
    p.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "version": 1,
        "tracks": [
            {
                "label": t.get("label", "unknown"),
                "key_files": t.get("key_files", []),
                "exports": t.get("exports", []),
                "goal_summary": t.get("implementation_steps", [""])[0][:120] if t.get("implementation_steps") else "",
            }
            for t in tracks
        ],
        "completed_edits": [],
    }
    p.write_text(json.dumps(manifest, indent=2))
    total_files = sum(len(t.get("key_files", [])) for t in tracks)
    return f"Manifest initialized: {len(tracks)} track(s), {total_files} file ownership entries."


@activity.defn(name="manifest_read")
async def manifest_read(repo_path: str) -> str:
    """Return the shared manifest as a JSON string."""
    p = Path(repo_path) / _MANIFEST_FILE
    if not p.exists():
        return json.dumps({"version": 1, "tracks": [], "completed_edits": []})
    try:
        return p.read_text(encoding="utf-8")
    except Exception as e:
        return json.dumps({"error": str(e), "tracks": [], "completed_edits": []})


@activity.defn(name="manifest_append_edits")
async def manifest_append_edits(repo_path: str, track_label: str, edits: list[dict]) -> str:
    """Append a builder's completed edits to the manifest."""
    p = Path(repo_path) / _MANIFEST_FILE
    try:
        manifest = json.loads(p.read_text()) if p.exists() else {"version": 1, "tracks": [], "completed_edits": []}
    except Exception:
        manifest = {"version": 1, "tracks": [], "completed_edits": []}
    for edit in edits:
        manifest["completed_edits"].append({
            "track": track_label,
            "path": edit.get("path", ""),
            "operation": edit.get("operation", ""),
        })
    p.write_text(json.dumps(manifest, indent=2))
    return f"Manifest updated: +{len(edits)} edits from track '{track_label}'."
