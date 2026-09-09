"""Vertical playbooks — config overlays for the engine (M4). No workflow forks."""
from __future__ import annotations

from typing import Any

PLAYBOOK_IDS = frozenset({"platform-backlog", "a11y-remediation", "monorepo-slice"})

PLAYBOOKS: dict[str, dict[str, Any]] = {
    "platform-backlog": {
        "label": "Platform backlog",
        "vertical": "V-PLAT",
        "tier_default": 1,
        "branch_prefix": "backlog",
        "goal_prefix": "Small scoped change suitable for backlog drain: ",
        "pipeline": {
            "max_heal_cycles": 1,
            "max_parallel_tracks": 1,
        },
    },
    "a11y-remediation": {
        "label": "A11y remediation",
        "vertical": "V-A11Y",
        "tier_default": 2,
        "branch_prefix": "a11y",
        "goal_prefix": "WCAG 2.1 AA remediation — ",
        "pipeline": {
            "max_heal_cycles": 2,
            "max_parallel_tracks": 2,
        },
        "oracle": {
            "inspector_overlay": (
                "ACCESSIBILITY ORACLE (V-A11Y):\n"
                "After standard test/lint/type checks, run accessibility verification:\n"
                "1. Prefer project-configured a11y lint (eslint-plugin-jsx-a11y) via run_lint.\n"
                "2. If package.json lists pa11y-ci or @axe-core/cli, run it via run_tests.\n"
                "3. Treat WCAG 2.1 AA violations as heal_items with severity=high.\n"
                "4. Do NOT mark passed=True until a11y checks pass or are explicitly skipped "
                "(missing tooling only — note in summary).\n"
            ),
            "qa_commands": {
                "a11y": "npx eslint src --ext .tsx,.jsx --max-warnings 0",
            },
        },
    },
    "monorepo-slice": {
        "label": "Monorepo slice",
        "vertical": "V-MONO",
        "tier_default": 2,
        "branch_prefix": "slice",
        "goal_prefix": "Monorepo package-boundary slice — ",
        "pipeline": {
            "max_heal_cycles": 2,
            "max_parallel_tracks": 3,
        },
        "architect_overlay": (
            "MONOREPO SLICE RULES (V-MONO):\n"
            "- Identify package boundaries (packages/*, apps/*, libs/*, modules/*).\n"
            "- Each parallel track MUST own files within ONE package only.\n"
            "- Use depends_on when a track needs exports from another package.\n"
            "- NEVER assign the same file to two parallel tracks in the same wave.\n"
            "- Prefer 2-3 tracks scoped to distinct packages over one mega-track.\n"
        ),
    },
}


def get_playbook(playbook_id: str | None) -> dict[str, Any] | None:
    if not playbook_id:
        return None
    row = PLAYBOOKS.get(playbook_id)
    return dict(row) if row else None


def resolve_submit_params(
    *,
    goal: str,
    branch_prefix: str,
    tier: int,
    playbook_id: str | None,
    pipeline: dict[str, Any] | None,
) -> tuple[str, str, int, dict[str, Any] | None, str | None]:
    """Merge playbook defaults into submit params. Returns (goal, branch_prefix, tier, pipeline, playbook_id)."""
    spec = get_playbook(playbook_id)
    if not spec:
        if playbook_id:
            raise ValueError(f"unknown playbook: {playbook_id}")
        return goal, branch_prefix, tier, pipeline, None

    merged_goal = goal
    prefix = spec.get("goal_prefix", "")
    if prefix and not goal.lower().startswith(prefix.lower()[:20]):
        merged_goal = f"{prefix}{goal}"

    merged_branch = spec.get("branch_prefix") or branch_prefix
    merged_tier = tier if tier >= 0 else int(spec.get("tier_default", tier))

    merged_pipeline: dict[str, Any] = dict(spec.get("pipeline") or {})
    if pipeline:
        merged_pipeline.update(pipeline)

    return merged_goal, merged_branch, merged_tier, merged_pipeline or None, playbook_id


def architect_prompt_overlay(playbook_id: str | None) -> str | None:
    spec = get_playbook(playbook_id)
    if not spec:
        return None
    overlay = spec.get("architect_overlay")
    return str(overlay).strip() if overlay else None


def inspector_prompt_overlay(playbook_id: str | None) -> str | None:
    spec = get_playbook(playbook_id)
    if not spec:
        return None
    oracle = spec.get("oracle") or {}
    overlay = oracle.get("inspector_overlay")
    return str(overlay).strip() if overlay else None


def playbook_oracle_qa_commands(playbook_id: str | None) -> dict[str, str]:
    spec = get_playbook(playbook_id)
    if not spec:
        return {}
    oracle = spec.get("oracle") or {}
    raw = oracle.get("qa_commands") or {}
    return {str(k): str(v) for k, v in raw.items()}
