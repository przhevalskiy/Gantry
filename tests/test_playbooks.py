"""Playbook registry — vertical config overlays (M4)."""
from __future__ import annotations

import pytest

from project.schema.playbooks import (
    PLAYBOOKS,
    architect_prompt_overlay,
    get_playbook,
    inspector_prompt_overlay,
    playbook_oracle_qa_commands,
    resolve_submit_params,
)


def test_known_playbooks():
    assert set(PLAYBOOKS) == {"platform-backlog", "a11y-remediation", "monorepo-slice"}


def test_unknown_playbook_raises():
    with pytest.raises(ValueError, match="unknown playbook"):
        resolve_submit_params(
            goal="fix bug",
            branch_prefix="swarm",
            tier=-1,
            playbook_id="nope",
            pipeline=None,
        )


def test_platform_backlog_merges_defaults():
    goal, branch, tier, pipeline, pid = resolve_submit_params(
        goal="Add pagination",
        branch_prefix="swarm",
        tier=-1,
        playbook_id="platform-backlog",
        pipeline=None,
    )
    assert pid == "platform-backlog"
    assert branch == "backlog"
    assert tier == 1
    assert "backlog" in goal.lower() or goal.startswith("Small scoped")
    assert pipeline["max_parallel_tracks"] == 1


def test_get_playbook_returns_copy():
    row = get_playbook("monorepo-slice")
    assert row
    row["label"] = "mutated"
    assert PLAYBOOKS["monorepo-slice"]["label"] != "mutated"


def test_no_workflow_defs_in_playbooks():
    for spec in PLAYBOOKS.values():
        text = str(spec)
        assert "@workflow.defn" not in text
        assert "execute_child_workflow" not in text


def test_a11y_playbook_oracle_overlay():
    overlay = inspector_prompt_overlay("a11y-remediation")
    assert overlay
    assert "ACCESSIBILITY" in overlay.upper()
    qa = playbook_oracle_qa_commands("a11y-remediation")
    assert "a11y" in qa
    assert "|| true" not in qa["a11y"]


def test_monorepo_architect_overlay():
    overlay = architect_prompt_overlay("monorepo-slice")
    assert overlay
    assert "package" in overlay.lower()
    assert "MONOREPO" in overlay


def test_platform_backlog_has_no_oracle_overlay():
    assert inspector_prompt_overlay("platform-backlog") is None
    assert architect_prompt_overlay("platform-backlog") is None
