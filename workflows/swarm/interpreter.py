"""Phase C — Foreman stage interpreter helpers.

Resolves playbook ``stages[]`` into an execution plan and HITL/heal metadata.
The coupled builder/inspector/reviewer heal loop remains one ``build_verify`` unit.
"""
from __future__ import annotations

from typing import Any

from workflows.swarm.stage_graph import (
    CORE_ROLES,
    ROLE_WORKFLOW_MAP,
    compile_execution_plan,
    default_execution_plan,
    resolve_stages,
    stage_roles,
    unit_kinds,
)

# Frozen golden path for tier=2, no disables, not lightweight (compat baseline).
GOLDEN_DEFAULT_UNIT_KINDS: tuple[str, ...] = (
    "pm",
    "architect",
    "build_verify",
    "security",
    "devops",
)

GOLDEN_DEFAULT_ROLES: tuple[str, ...] = (
    "pm",
    "architect",
    "builder",
    "inspector",
    "reviewer",
    "security",
    "devops",
)


def plan_for_run(
    *,
    playbook_spec: dict[str, Any] | None,
    tier: int,
    disabled: set[str] | None = None,
    lightweight_mode: bool = False,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (active_stages, execution_plan). Validates architect precedes build_verify."""
    stages = resolve_stages(
        playbook_spec=playbook_spec,
        tier=tier,
        disabled=disabled,
        lightweight_mode=lightweight_mode,
    )
    plan = compile_execution_plan(stages)
    _assert_architect_before_core(plan)
    return stages, plan


def _assert_architect_before_core(plan: list[dict[str, Any]]) -> None:
    saw_core = False
    for unit in plan:
        if unit["kind"] == "build_verify":
            saw_core = True
        elif unit["kind"] == "role" and unit["stage"]["role"] == "architect" and saw_core:
            raise ValueError("stages: architect must run before build_verify core")


def hitl_required(stage: dict[str, Any] | None, *, tier: int) -> str | None:
    """Return checkpoint id if this stage should pause for HITL at ``tier``."""
    if not stage:
        return None
    hitl = stage.get("hitl")
    if not hitl:
        return None
    if tier < int(stage.get("hitl_min_tier", 0)):
        return None
    return str(hitl)


def core_roles_present(build_verify_unit: dict[str, Any]) -> set[str]:
    return {s["role"] for s in build_verify_unit.get("stages", [])}


def stage_by_role(stages: list[dict[str, Any]], role: str) -> dict[str, Any] | None:
    for stage in stages:
        if stage["role"] == role:
            return stage
    return None


def golden_default_matches_current_pipeline() -> bool:
    """Property: default stages/plan ≡ today's hardcoded Foreman path (tier 2)."""
    stages = resolve_stages(
        playbook_spec=None,
        tier=2,
        disabled=None,
        lightweight_mode=False,
    )
    plan = compile_execution_plan(stages)
    return (
        stage_roles(stages) == list(GOLDEN_DEFAULT_ROLES)
        and unit_kinds(plan) == list(GOLDEN_DEFAULT_UNIT_KINDS)
    )


__all__ = [
    "CORE_ROLES",
    "GOLDEN_DEFAULT_ROLES",
    "GOLDEN_DEFAULT_UNIT_KINDS",
    "ROLE_WORKFLOW_MAP",
    "compile_execution_plan",
    "core_roles_present",
    "default_execution_plan",
    "golden_default_matches_current_pipeline",
    "hitl_required",
    "plan_for_run",
    "resolve_stages",
    "stage_by_role",
    "stage_roles",
    "unit_kinds",
]
