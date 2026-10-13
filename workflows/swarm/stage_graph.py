"""Phase C — playbook stage graph for the Foreman.

Default stages match today's SWE pipeline. Custom ``stages[]`` may reorder
``pm`` / ``security`` / ``devops`` around a fixed build-verify core
(builder + inspector heal + reviewer). No new ACP names (C1).
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from role_packs.registry import all_known_roles, role_workflow_map
from schemas.crew import HITL_CHECKPOINTS

# Public Temporal role → workflow.defn name (C2). Includes Phase D packs.
ROLE_WORKFLOW_MAP: dict[str, str] = role_workflow_map()
KNOWN_STAGE_ROLES = all_known_roles()

# Coupled heal loop — compiled as one execution unit (H-HEAL).
CORE_ROLES = frozenset({"builder", "inspector", "reviewer"})

_HITL_IDS = frozenset(c["id"] for c in HITL_CHECKPOINTS)

# Today's pipeline as data (compat baseline).
DEFAULT_STAGES: list[dict[str, Any]] = [
    {
        "role": "pm",
        "min_tier": 1,
        "workflow": "PMAgent",
    },
    {
        "role": "architect",
        "workflow": "ArchitectAgent",
        "hitl": "architect_plan",
        "hitl_min_tier": 2,
    },
    {
        "role": "builder",
        "workflow": "BuilderAgent",
        "parallel": True,
    },
    {
        "role": "inspector",
        "workflow": "InspectorAgent",
        "heal": True,
    },
    {
        "role": "reviewer",
        "workflow": "ReviewerAgent",
        "heal": True,
        "skip_lightweight": True,
    },
    {
        "role": "security",
        "workflow": "SecurityAgent",
        "skip_lightweight": True,
    },
    {
        "role": "devops",
        "workflow": "DevOpsAgent",
        "hitl": "devops",
        "hitl_min_tier": 3,
    },
]


def default_stages() -> list[dict[str, Any]]:
    return deepcopy(DEFAULT_STAGES)


def _normalize_stage(raw: dict[str, Any], index: int) -> dict[str, Any]:
    role = str(raw.get("role", "")).lower().strip()
    if role not in KNOWN_STAGE_ROLES:
        raise ValueError(f"stages[{index}].role unknown: {role!r}")
    if role not in ROLE_WORKFLOW_MAP:
        raise ValueError(f"stages[{index}].role {role!r} has no registered workflow (P3)")
    stage = {
        "role": role,
        "workflow": ROLE_WORKFLOW_MAP[role],
        "parallel": bool(raw.get("parallel", role == "builder")),
        "heal": bool(raw.get("heal", role in {"inspector", "reviewer"})),
        "skip_lightweight": bool(raw.get("skip_lightweight", role in {"reviewer", "security", "oracle_a11y"})),
        "min_tier": int(raw.get("min_tier", 0)),
    }
    hitl = raw.get("hitl")
    if hitl:
        hitl_id = str(hitl)
        if hitl_id not in _HITL_IDS:
            raise ValueError(
                f"stages[{index}].hitl unknown checkpoint {hitl_id!r} "
                f"(known: {', '.join(sorted(_HITL_IDS))})"
            )
        stage["hitl"] = hitl_id
        stage["hitl_min_tier"] = int(raw.get("hitl_min_tier", 0))
    elif role == "architect":
        stage["hitl"] = "architect_plan"
        stage["hitl_min_tier"] = int(raw.get("hitl_min_tier", 2))
    elif role == "devops":
        stage["hitl"] = "devops"
        stage["hitl_min_tier"] = int(raw.get("hitl_min_tier", 3))
    if "min_tier" in raw:
        stage["min_tier"] = int(raw["min_tier"])
    elif role == "pm":
        stage["min_tier"] = 1
    return stage


def resolve_stages(
    *,
    playbook_spec: dict[str, Any] | None,
    tier: int,
    disabled: set[str] | None = None,
    lightweight_mode: bool = False,
) -> list[dict[str, Any]]:
    """Return active stages for this run (skip muted / tier / lightweight)."""
    disabled = {str(x).lower() for x in (disabled or set())}
    raw_stages = None
    if playbook_spec and isinstance(playbook_spec.get("stages"), list):
        raw_stages = playbook_spec["stages"]
    stages = (
        [_normalize_stage(s, i) for i, s in enumerate(raw_stages)]
        if raw_stages
        else default_stages()
    )

    roles = [s["role"] for s in stages]
    if "architect" not in roles or "builder" not in roles:
        raise ValueError("stages must include architect and builder")

    active: list[dict[str, Any]] = []
    for stage in stages:
        role = stage["role"]
        if role in disabled:
            continue
        if tier < int(stage.get("min_tier", 0)):
            continue
        if lightweight_mode and stage.get("skip_lightweight"):
            continue
        active.append(stage)
    return active


def compile_execution_plan(stages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Collapse builder/inspector/reviewer into one build_verify unit; preserve outer order.

    Units:
      - ``{kind: role, stage: ...}`` for pm|architect|security|devops
      - ``{kind: build_verify, stages: [...]}`` for the coupled heal core
    """
    plan: list[dict[str, Any]] = []
    core_buf: list[dict[str, Any]] = []

    def flush_core() -> None:
        nonlocal core_buf
        if core_buf:
            plan.append({"kind": "build_verify", "stages": core_buf})
            core_buf = []

    for stage in stages:
        if stage["role"] in CORE_ROLES:
            core_buf.append(stage)
        else:
            flush_core()
            plan.append({"kind": "role", "stage": stage})
    flush_core()

    if not any(u["kind"] == "build_verify" for u in plan):
        raise ValueError("execution plan missing build_verify core (builder/inspector/reviewer)")
    return plan


def stage_roles(stages: list[dict[str, Any]]) -> list[str]:
    return [s["role"] for s in stages]


def unit_kinds(plan: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for unit in plan:
        if unit["kind"] == "build_verify":
            out.append("build_verify")
        else:
            out.append(unit["stage"]["role"])
    return out


def default_execution_plan(
    *,
    tier: int = 2,
    disabled: set[str] | None = None,
    lightweight_mode: bool = False,
) -> list[dict[str, Any]]:
    stages = resolve_stages(
        playbook_spec=None,
        tier=tier,
        disabled=disabled,
        lightweight_mode=lightweight_mode,
    )
    return compile_execution_plan(stages)
