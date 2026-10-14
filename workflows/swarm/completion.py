"""
Pipeline completion helpers — structured results and episodic memory payloads.

Pure functions extracted from workflows/swarm_orchestrator.py.
"""
from __future__ import annotations

from typing import Any


def structured_result_from_devops(
    devops_result: dict | None,
    *,
    branch: str,
    quality_score: dict | None = None,
    tier: int | None = None,
    heal_cycles: int | None = None,
    files_changed: int | None = None,
    artifact_type: str | None = None,
) -> dict[str, Any]:
    """Build the I3 structured result dict written to builds / api_tasks."""
    pr_url = (devops_result or {}).get("pr_url", "") or ""
    resolved_branch = (devops_result or {}).get("branch", "") or branch
    artifact = (
        artifact_type
        or (devops_result or {}).get("artifact_type")
        or ("pr" if pr_url else "branch")
    )
    result: dict[str, Any] = {"artifact_type": artifact}
    if pr_url and artifact == "pr":
        result["pr_url"] = pr_url
    if resolved_branch and artifact != "report":
        result["branch"] = resolved_branch
    if quality_score and quality_score.get("score") is not None:
        result["quality_score"] = quality_score["score"]
    if tier is not None:
        result["tier"] = tier
    if heal_cycles is not None:
        result["heal_cycles"] = heal_cycles
    if files_changed is not None:
        result["files_changed"] = files_changed
    return result


def build_episode_record(
    *,
    goal: str,
    tier: int,
    tier_label: str,
    tracks: list[dict],
    architect_plan: dict,
    build_result: dict,
    inspector_report: dict,
    security_report: dict,
    devops_result: dict | None,
    heal_cycles: int,
    quality_score: dict,
) -> dict[str, Any]:
    """Episodic memory payload for memory_append_episode."""
    return {
        "goal": goal[:300],
        "tier": tier,
        "tier_label": tier_label,
        "outcome": "success" if not inspector_report.get("blocked_by") else "blocked",
        "inspector_passed": inspector_report.get("passed", False),
        "security_passed": security_report.get("passed", False),
        "heal_cycles": heal_cycles,
        "tracks": [t.get("label") for t in tracks],
        "files_modified": len(build_result.get("edits", [])),
        "pr_url": (devops_result or {}).get("pr_url", ""),
        "quality_score": quality_score.get("score", 5.0),
        "quality_reasoning": quality_score.get("reasoning", ""),
        "key_decisions": [
            f"tracks={[t.get('label') for t in tracks]}",
            f"tech_stack={architect_plan.get('tech_stack', [])}",
        ],
    }
