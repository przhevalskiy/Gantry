"""Agentex-facing crew catalog.

Foreman remains the only ACP task entry (`swarm-factory`). Child roles are
Temporal workflows on the same worker — listed here so they have stable
names on the Agentex track without replacing orchestration (I7 / C1 / C2).
"""
from __future__ import annotations

from typing import Any

FOREMAN_ACP_NAME = "swarm-factory"

# Agentex autonomy: L1 chat → L5 multi-agent orchestrator.
# Gantry tiers start at mechanical execution, so Micro maps to L2 not L1.
TIER_AUTONOMY: dict[int, dict[str, Any]] = {
    0: {
        "tier": 0,
        "label": "Micro",
        "level": "L2",
        "agentex": "Tool-use, single pass, no heal, no HITL",
        "max_parallel_tracks": 1,
        "max_heal_cycles": 0,
        "hitl": [],
    },
    1: {
        "tier": 1,
        "label": "Lightweight",
        "level": "L3",
        "agentex": "Multi-step with one heal; PM may clarify",
        "max_parallel_tracks": 1,
        "max_heal_cycles": 1,
        "hitl": ["pm_clarification"],
    },
    2: {
        "tier": 2,
        "label": "Standard",
        "level": "L4",
        "agentex": "Long-running async crew; architect-plan HITL",
        "max_parallel_tracks": 2,
        "max_heal_cycles": 2,
        "hitl": ["pm_clarification", "architect_plan", "max_heals"],
    },
    3: {
        "tier": 3,
        "label": "Full Crew",
        "level": "L5",
        "agentex": "Orchestrator of specialized agents; plan + deploy HITL",
        "max_parallel_tracks": 4,
        "max_heal_cycles": 2,
        "hitl": ["pm_clarification", "architect_plan", "max_heals", "devops"],
    },
}

HITL_CHECKPOINTS: tuple[dict[str, str], ...] = (
    {
        "id": "pm_clarification",
        "signal": "submit",
        "workflow": "gantry_clarification",
        "acp_event": "hitl.clarify",
        "description": "PM questions; payload is {question: answer}",
    },
    {
        "id": "architect_plan",
        "signal": "approve",
        "workflow": "gantry_approval",
        "acp_event": "hitl.approve_plan",
        "description": "Approve or reject the Architect plan before builders run",
    },
    {
        "id": "max_heals",
        "signal": "approve",
        "workflow": "gantry_approval",
        "acp_event": "hitl.approve_continue",
        "description": "Heal budget exhausted; continue or abort",
    },
    {
        "id": "devops",
        "signal": "approve",
        "workflow": "gantry_approval",
        "acp_event": "hitl.approve_deploy",
        "description": "Approve opening the PR / deploy (Full Crew)",
    },
)

# Temporal workflow.defn names — must match worker.py registration.
CREW_AGENTS: tuple[dict[str, Any], ...] = (
    {
        "name": "swarm-factory",
        "role": "Foreman",
        "workflow": "swarm-factory",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "acp",
        "level": "L5",
        "description": "Durable orchestrator. Only ACP task/create target for a full pipeline run.",
        "tools": ["Temporal workflow", "HITL checkpoints"],
    },
    {
        "name": "gantry-pm",
        "role": "PM",
        "workflow": "PMAgent",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "temporal_child",
        "level": "L3",
        "description": "Enriches the goal; optional clarification HITL. Composed by Foreman.",
        "tools": ["fetch_url", "memory_read", "web_search"],
    },
    {
        "name": "gantry-architect",
        "role": "Architect",
        "workflow": "ArchitectAgent",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "temporal_child",
        "level": "L4",
        "description": "Maps the repo and decomposes into parallel tracks. Composed by Foreman.",
        "tools": ["list_directory", "read_file", "find_symbol", "web_search", "run_command"],
    },
    {
        "name": "gantry-builder",
        "role": "Builder",
        "workflow": "BuilderAgent",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "temporal_child",
        "level": "L4",
        "description": "Writes code on one track. Parallel instances; composed by Foreman.",
        "tools": ["write_file", "edit_file", "find_symbol", "run_command", "verify_build"],
    },
    {
        "name": "gantry-inspector",
        "role": "Inspector",
        "workflow": "InspectorAgent",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "temporal_child",
        "level": "L4",
        "description": "Runs tests/lint/types; emits heal instructions. Composed by Foreman.",
        "tools": ["run_tests", "run_lint", "run_type_check", "run_coverage"],
    },
    {
        "name": "gantry-reviewer",
        "role": "Reviewer",
        "workflow": "ReviewerAgent",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "temporal_child",
        "level": "L4",
        "description": "Logic review of the full diff. Composed by Foreman.",
        "tools": ["git_diff", "read_file", "find_symbol", "report_review"],
    },
    {
        "name": "gantry-security",
        "role": "Security",
        "workflow": "SecurityAgent",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "temporal_child",
        "level": "L3",
        "description": "Secrets/CVE/SAST gate. Composed by Foreman.",
        "tools": ["scan_secrets", "scan_dependencies", "run_sast"],
    },
    {
        "name": "gantry-devops",
        "role": "DevOps",
        "workflow": "DevOpsAgent",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "temporal_child",
        "level": "L4",
        "description": "Branch, commit, push, PR. Optional deploy HITL. Composed by Foreman.",
        "tools": ["git_commit", "git_push", "create_pull_request"],
    },
    {
        "name": "gantry-approval",
        "role": "HITL Approval",
        "workflow": "gantry_approval",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "temporal_child",
        "level": "L4",
        "description": "Durable approve/reject checkpoint. Signalled via REST HITL.",
        "tools": ["approve signal"],
    },
    {
        "name": "gantry-clarification",
        "role": "HITL Clarification",
        "workflow": "gantry_clarification",
        "acp_name": FOREMAN_ACP_NAME,
        "entrypoint": "temporal_child",
        "level": "L3",
        "description": "Durable PM question checkpoint. Signalled via REST HITL.",
        "tools": ["submit signal"],
    },
)

_CHECKPOINT_BY_ID = {c["id"]: c for c in HITL_CHECKPOINTS}
_AGENT_BY_NAME = {a["name"]: a for a in CREW_AGENTS}
_AGENT_BY_WORKFLOW = {a["workflow"]: a for a in CREW_AGENTS}


def autonomy_for_tier(tier: int | None) -> str | None:
    if tier is None or tier < 0:
        return None
    row = TIER_AUTONOMY.get(int(tier))
    return row["level"] if row else None


def autonomy_row(tier: int | None) -> dict[str, Any] | None:
    if tier is None or tier < 0:
        return None
    row = TIER_AUTONOMY.get(int(tier))
    return dict(row) if row else None


def get_agent(name: str) -> dict[str, Any] | None:
    return dict(_AGENT_BY_NAME[name]) if name in _AGENT_BY_NAME else None


def get_checkpoint(checkpoint_id: str) -> dict[str, str] | None:
    row = _CHECKPOINT_BY_ID.get(checkpoint_id)
    return dict(row) if row else None


def workflow_names() -> list[str]:
    return [a["workflow"] for a in CREW_AGENTS]


def acp_invoke_example(*, base_url: str = "http://localhost:5003") -> dict[str, Any]:
    """How another Agentex agent/client starts a full Gantry run (C1)."""
    return {
        "method": "POST",
        "url": f"{base_url.rstrip('/')}/agents/name/{FOREMAN_ACP_NAME}/rpc",
        "jsonrpc": "2.0",
        "rpc_method": "task/create",
        "params": {
            "params": {
                "query": "<goal>",
                "prompt": "<goal>",
                "project_id": "<gantry project id>",
                "tier": -1,
            }
        },
        "note": (
            "Only swarm-factory accepts ACP task/create for a pipeline run. "
            "Child roles are Temporal workflows composed by the Foreman."
        ),
    }


def catalog_payload(*, agentex_base_url: str = "http://localhost:5003") -> dict[str, Any]:
    return {
        "acp_agent": FOREMAN_ACP_NAME,
        "orchestration": "temporal_children",
        "agents": [dict(a) for a in CREW_AGENTS],
        "autonomy": [dict(v) for v in TIER_AUTONOMY.values()],
        "hitl": [dict(c) for c in HITL_CHECKPOINTS],
        "acp": acp_invoke_example(base_url=agentex_base_url),
    }
