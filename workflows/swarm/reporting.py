"""
Report assembly helpers for SwarmOrchestrator.

Extracted from workflows/swarm_orchestrator.py — pure functions, no Temporal imports.
"""
from __future__ import annotations


def _build_final_report(
    goal: str,
    tracks: list[dict],
    build_result: dict,
    inspector_report: dict,
    reviewer_report: dict,
    security_report: dict,
    devops_result: dict | None,
    heal_cycles: int,
    blocked_by: str | None = None,
    quality_score: dict | None = None,
) -> str:
    edits = build_result.get("edits", [])
    findings = security_report.get("findings", [])
    pr_url = devops_result.get("pr_url", "") if devops_result else ""
    branch = devops_result.get("branch", "") if devops_result else ""

    status = "✓ Complete" if not blocked_by else f"⚠ Blocked by {blocked_by}"
    qa_status = "✓ Passed" if inspector_report.get("passed") else "✗ Failed"
    rev_verdict = reviewer_report.get("verdict", "approve")
    rev_status = "✓ Approved" if rev_verdict == "approve" else "✗ Changes requested"
    sec_status = "✓ Clean" if security_report.get("passed") else "✗ Issues found"

    track_labels = [t.get("label", "?") for t in tracks if t.get("label") not in ("heal", "reviewer-heal")]
    tracks_str = ", ".join(track_labels) if track_labels else "main"

    lines = [
        "## Swarm Factory Report",
        f"**Status:** {status}",
        f"**Goal:** {goal[:200]}",
        "",
        "### Results",
        f"- Architect: {len(tracks)} parallel track(s) — {tracks_str}",
        f"- Builders: {len(edits)} file(s) modified (heal cycles: {heal_cycles})",
        f"- Inspector: {qa_status}",
        f"- Reviewer: {rev_status}",
        f"- Security: {sec_status} ({len(findings)} finding(s))",
    ]

    if quality_score and quality_score.get("score") is not None:
        score = quality_score["score"]
        lines.append(f"- Quality: {score}/10 — {quality_score.get('reasoning', '')}")

    if pr_url:
        lines.append(f"- DevOps: PR opened → {pr_url}")
    elif branch:
        lines.append(f"- DevOps: Branch '{branch}' pushed")

    if not inspector_report.get("passed"):
        issues = inspector_report.get("heal_instructions", [])[:3]
        if issues:
            lines += ["", "### Remaining QA Issues"] + [f"- {i}" for i in issues]

    if not security_report.get("passed"):
        critical = [f for f in findings if f.get("severity") in ("critical", "high")][:3]
        if critical:
            lines += ["", "### Security Findings (blocking)"] + [
                f"- [{f.get('severity')}] {f.get('description', '')}" for f in critical
            ]

    return "\n".join(lines)


def format_quality_comment(
    quality_score: dict,
    build_number: int | str,
    prior_episode_count: int,
) -> str:
    """Format the GitHub PR comment body for the quality score breakdown."""
    _prior = prior_episode_count
    comment_lines = [
        "## 🏗️ Gantry Quality Score",
        "",
        f"**{quality_score.get('score', '?')}/10** — {quality_score.get('reasoning', '')}",
        "",
        "| Dimension | Score |",
        "|---|---|",
        f"| Alignment to goal | {quality_score.get('alignment', '?')}/10 |",
        f"| Completeness | {quality_score.get('completeness', '?')}/10 |",
        f"| Code quality | {quality_score.get('quality', '?')}/10 |",
        "",
        f"_Build #{build_number} on this repo"
        + (f" · {_prior} prior episode{'s' if _prior != 1 else ''} in memory" if _prior > 0 else "")
        + "_",
    ]
    return "\n".join(comment_lines)
