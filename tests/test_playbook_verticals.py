"""P5.3–P5.5 — vertical playbook oracle overlays and monorepo conflict behavior."""
from __future__ import annotations

import pytest

from project.schema.playbooks import (
    PLAYBOOKS,
    architect_prompt_overlay,
    inspector_prompt_overlay,
    playbook_oracle_qa_commands,
)
from workflows.swarm.track_manager import _resolve_track_conflicts

PLAYBOOK_UI_LABELS = {
    "platform-backlog": "Platform backlog",
    "a11y-remediation": "A11y remediation",
    "monorepo-slice": "Monorepo slice",
}

REQUIRED_PLAYBOOK_KEYS = frozenset({
    "label",
    "vertical",
    "tier_default",
    "branch_prefix",
    "goal_prefix",
    "pipeline",
})


def test_playbook_schema_keys():
    """G2 — every playbook has the expected config shape."""
    for playbook_id, spec in PLAYBOOKS.items():
        missing = REQUIRED_PLAYBOOK_KEYS - set(spec)
        assert not missing, f"{playbook_id} missing {missing}"
        assert spec["pipeline"]["max_parallel_tracks"] >= 1
        assert spec["pipeline"]["max_heal_cycles"] >= 0


def test_ui_playbook_labels_match_backend():
    """G3 — apps/web SubmitPage labels must match PLAYBOOKS (see PLAYBOOK_UI_LABELS)."""
    assert set(PLAYBOOK_UI_LABELS) == set(PLAYBOOKS)
    for pid, label in PLAYBOOK_UI_LABELS.items():
        assert PLAYBOOKS[pid]["label"] == label


def test_a11y_oracle_requires_accessibility_checks():
    """P5.3 — a11y playbook adds oracle overlay and qa command."""
    overlay = inspector_prompt_overlay("a11y-remediation")
    assert overlay and "ACCESSIBILITY" in overlay.upper()
    qa = playbook_oracle_qa_commands("a11y-remediation")
    assert "a11y" in qa
    assert "eslint" in qa["a11y"].lower() or "a11y" in qa["a11y"].lower()


def test_monorepo_package_scoped_tracks_no_collision():
    """P5.4 — distinct package paths in parallel tracks produce no H-CON warnings."""
    tracks = [
        {
            "label": "ui-package",
            "key_files": ["packages/ui/src/button.tsx"],
            "depends_on": [],
        },
        {
            "label": "api-package",
            "key_files": ["packages/api/handlers.py"],
            "depends_on": [],
        },
    ]
    resolved, warnings = _resolve_track_conflicts(tracks)
    assert warnings == []
    assert len(resolved) == 2


def test_monorepo_same_file_same_wave_gets_resolved():
    """P5.4 — parallel tracks claiming the same file trigger H-CON reassignment."""
    tracks = [
        {"label": "track-a", "key_files": ["packages/foo/index.ts"], "depends_on": []},
        {"label": "track-b", "key_files": ["packages/foo/index.ts"], "depends_on": []},
    ]
    resolved, warnings = _resolve_track_conflicts(tracks)
    assert len(warnings) == 1
    owners = {
        "packages/foo/index.ts".lower(): None,
    }
    for track in resolved:
        for path in track.get("key_files", []):
            norm = path.lstrip("./").lower()
            if norm in owners:
                if owners[norm] is None:
                    owners[norm] = track["label"]
                else:
                    pytest.fail("same file still owned by multiple tracks in one wave")


def test_monorepo_architect_overlay_mentions_packages():
    overlay = architect_prompt_overlay("monorepo-slice")
    assert overlay
    assert "package" in overlay.lower()
