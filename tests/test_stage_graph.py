"""Phase C — stage graph + Foreman interpreter golden path."""
from __future__ import annotations

import pytest

from workflows.swarm.interpreter import (
    GOLDEN_DEFAULT_ROLES,
    GOLDEN_DEFAULT_UNIT_KINDS,
    golden_default_matches_current_pipeline,
    hitl_required,
    plan_for_run,
    unit_kinds,
)
from workflows.swarm.stage_graph import (
    ROLE_WORKFLOW_MAP,
    compile_execution_plan,
    default_stages,
    resolve_stages,
    stage_roles,
)


def test_golden_default_equals_current_pipeline():
    assert golden_default_matches_current_pipeline()
    stages, plan = plan_for_run(playbook_spec=None, tier=2)
    assert stage_roles(stages) == list(GOLDEN_DEFAULT_ROLES)
    assert unit_kinds(plan) == list(GOLDEN_DEFAULT_UNIT_KINDS)


def test_default_stages_have_heal_and_hitl_metadata():
    stages = default_stages()
    by_role = {s["role"]: s for s in stages}
    assert by_role["inspector"]["heal"] is True
    assert by_role["reviewer"]["heal"] is True
    assert by_role["architect"]["hitl"] == "architect_plan"
    assert by_role["architect"]["hitl_min_tier"] == 2
    assert by_role["devops"]["hitl"] == "devops"
    assert by_role["devops"]["hitl_min_tier"] == 3


def test_hitl_required_respects_tier():
    stages = default_stages()
    arch = next(s for s in stages if s["role"] == "architect")
    devops = next(s for s in stages if s["role"] == "devops")
    assert hitl_required(arch, tier=1) is None
    assert hitl_required(arch, tier=2) == "architect_plan"
    assert hitl_required(devops, tier=2) is None
    assert hitl_required(devops, tier=3) == "devops"


def test_tier_and_disable_and_lightweight_filter_stages():
    auto = resolve_stages(playbook_spec=None, tier=0, lightweight_mode=False)
    assert "pm" not in stage_roles(auto)

    muted = resolve_stages(
        playbook_spec=None,
        tier=2,
        disabled={"security", "pm"},
        lightweight_mode=False,
    )
    assert stage_roles(muted) == [
        "architect",
        "builder",
        "inspector",
        "reviewer",
        "devops",
    ]

    light = resolve_stages(playbook_spec=None, tier=2, lightweight_mode=True)
    assert "reviewer" not in stage_roles(light)
    assert "security" not in stage_roles(light)


def test_custom_stages_reorder_security_and_devops():
    spec = {
        "stages": [
            {"role": "architect"},
            {"role": "builder"},
            {"role": "inspector", "heal": True},
            {"role": "devops"},
            {"role": "security"},
        ]
    }
    stages, plan = plan_for_run(playbook_spec=spec, tier=2)
    assert unit_kinds(plan) == ["architect", "build_verify", "devops", "security"]


def test_architect_after_core_rejected():
    spec = {
        "stages": [
            {"role": "builder"},
            {"role": "inspector"},
            {"role": "architect"},
        ]
    }
    with pytest.raises(ValueError, match="architect must run before"):
        plan_for_run(playbook_spec=spec, tier=2)


def test_unknown_role_rejected():
    with pytest.raises(ValueError, match="unknown"):
        resolve_stages(
            playbook_spec={"stages": [{"role": "grok-bot"}, {"role": "architect"}, {"role": "builder"}]},
            tier=2,
        )


def test_role_workflow_map_includes_oracle_pack():
    assert ROLE_WORKFLOW_MAP["oracle_a11y"] == "OracleA11yAgent"
    assert ROLE_WORKFLOW_MAP["builder"] == "BuilderAgent"


def test_a11y_playbook_stages_compile_with_oracle():
    from schemas.playbooks import SYSTEM_PLAYBOOKS

    stages, plan = plan_for_run(
        playbook_spec=SYSTEM_PLAYBOOKS["a11y-remediation"],
        tier=2,
    )
    assert "oracle_a11y" in stage_roles(stages)
    assert unit_kinds(plan) == [
        "pm",
        "architect",
        "build_verify",
        "oracle_a11y",
        "security",
        "devops",
    ]
    # build_verify still collapses heal core
    core = next(u for u in plan if u["kind"] == "build_verify")
    assert [s["role"] for s in core["stages"]] == ["builder", "inspector", "reviewer"]


def test_compile_requires_build_verify_core():
    with pytest.raises(ValueError, match="build_verify"):
        compile_execution_plan([{"role": "pm", "workflow": "PMAgent"}])
