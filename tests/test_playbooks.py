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
    validate_playbook_config,
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


def test_custom_playbook_spec_merges():
    spec = {
        "label": "Custom",
        "tier_default": 2,
        "branch_prefix": "custom",
        "goal_prefix": "CUSTOM: ",
        "pipeline": {"max_parallel_tracks": 2, "max_heal_cycles": 1},
        "architect_overlay": "Follow platform rules.",
    }
    goal, branch, tier, pipeline, pid = resolve_submit_params(
        goal="Add feature",
        branch_prefix="swarm",
        tier=-1,
        playbook_id="custom-skill",
        pipeline=None,
        playbook_spec=spec,
    )
    assert pid == "custom-skill"
    assert branch == "custom"
    assert tier == 2
    assert goal.startswith("CUSTOM:")
    assert architect_prompt_overlay("custom-skill", spec)


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


def test_validate_artifact_and_stages_additive():
    validate_playbook_config({
        "tier_default": 2,
        "artifact": {"type": "branch"},
        "pipeline": {
            "max_parallel_tracks": 2,
            "max_heal_cycles": 1,
            "disable_agents": ["pm", "security"],
        },
        "stages": [
            {"role": "architect"},
            {"role": "builder"},
            {"role": "inspector"},
        ],
    })


def test_validate_rejects_unknown_role_in_stages():
    with pytest.raises(ValueError, match="unknown"):
        validate_playbook_config({
            "pipeline": {"max_parallel_tracks": 1, "max_heal_cycles": 0},
            "stages": [{"role": "grok-bot"}],
        })


def test_validate_rejects_unknown_artifact():
    with pytest.raises(ValueError, match="artifact"):
        validate_playbook_config({
            "pipeline": {"max_parallel_tracks": 1, "max_heal_cycles": 0},
            "artifact": "chat",
        })


def test_a11y_merges_artifact_into_pipeline():
    _, _, _, pipeline, _ = resolve_submit_params(
        goal="Fix contrast",
        branch_prefix="swarm",
        tier=-1,
        playbook_id="a11y-remediation",
        pipeline=None,
    )
    assert pipeline is not None
    assert pipeline.get("artifact") == {"type": "branch"}
