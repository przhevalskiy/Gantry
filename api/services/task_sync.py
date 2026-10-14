"""Push-primary task status sync (worker → Gantry API).

The Agentex poller is a slow safety net only. Canonical paths:

1. Worker ``db_upsert_build`` / ``db_notify_task_status`` → this module
2. Optional fallback poller when push is missed (crash, network)
"""
from __future__ import annotations

import structlog

from api.clients import github as github_client
from api.repositories import builds as builds_repo
from api.repositories import projects as projects_repo
from api.repositories import tasks as tasks_repo
from api.services import github_tokens
from api.services import task_events
from api.services.task_results import resolve_terminal_result

log = structlog.get_logger(__name__)

TERMINAL_STATUSES = {"completed", "failed", "cancelled", "terminated", "timeout"}
INTERMEDIATE_STATUSES = {"queued", "running", "waiting_approval"}


async def handle_github_callback(
    task_id: str,
    meta: dict,
    status: str,
    pr_url: str | None,
) -> None:
    owner = meta.get("github_owner")
    repo = meta.get("github_repo")
    issue_number = meta.get("github_issue_number")
    if not (owner and repo and issue_number):
        return

    if status == "completed" and pr_url:
        body = f"✅ Done — PR ready for review: {pr_url}"
    elif status == "completed":
        body = "✅ Gantry completed the task. Check the repository for new branches or commits."
    else:
        body = (
            f"❌ Gantry task `{task_id}` ended with status `{status}`. "
            "Check the Gantry dashboard for details."
        )

    project = None
    project_id = meta.get("project_id")
    org_id = meta.get("org_id")
    if project_id:
        project = await projects_repo.get_project(project_id, org_id=org_id)
    if not project:
        project = {"github_owner": owner, "github_repo": repo, "org_id": org_id}

    token = await github_tokens.resolve_token(org_id=org_id or "", project=project)
    if not token:
        log.warning("github_callback_no_token", task_id=task_id, owner=owner, repo=repo)
        return

    try:
        await github_client.post_issue_comment(
            owner=owner,
            repo=repo,
            issue_number=issue_number,
            body=body,
            token=token,
        )
        log.info("github_callback_posted", task_id=task_id, issue=issue_number, status=status)
    except Exception as exc:
        log.error("github_callback_failed", task_id=task_id, error=str(exc))


async def apply_status_update(
    task_id: str,
    status: str,
    *,
    meta: dict | None = None,
    pr_url: str | None = None,
    branch: str | None = None,
    result: dict | None = None,
    messages: list[dict] | None = None,
    scrape_messages: bool = False,
) -> dict:
    """Apply a status update from the worker (push) or fallback poller.

    Returns the effective meta after update.
    """
    status = (status or "").lower().strip()
    meta = await tasks_repo.get_task_meta(task_id) or meta or {}
    if not meta:
        log.warning("task_sync_unknown_task", task_id=task_id, status=status)
        return {}

    org_id = meta.get("org_id")

    if status in INTERMEDIATE_STATUSES:
        await tasks_repo.update_task_status(task_id, status=status)
        await task_events.emit_for_agentex_status(task_id, meta, status)
        return await tasks_repo.get_task_meta(task_id) or meta

    if status not in TERMINAL_STATUSES:
        log.warning("task_sync_unknown_status", task_id=task_id, status=status)
        return meta

    structured = result or await resolve_terminal_result(task_id, org_id=org_id)
    if scrape_messages and (not structured.get("pr_url") or not structured.get("branch")):
        structured = await resolve_terminal_result(
            task_id,
            org_id=org_id,
            messages=messages or [],
        )

    effective_pr = pr_url or structured.get("pr_url")
    effective_branch = branch or structured.get("branch")

    await tasks_repo.update_task_status(
        task_id,
        status=status,
        pr_url=effective_pr,
        branch=effective_branch,
    )
    meta = await tasks_repo.get_task_meta(task_id) or meta
    meta["pr_url"] = effective_pr or meta.get("pr_url")
    meta["branch"] = effective_branch or meta.get("branch")

    project_id = meta.get("project_id")
    if project_id and (effective_pr or effective_branch or structured):
        await builds_repo.upsert_build(
            task_id=task_id,
            project_id=project_id,
            org_id=org_id,
            branch=effective_branch,
            pr_url=effective_pr,
            quality_score=structured.get("quality_score") if structured else None,
            status=status.upper() if status == "completed" else status,
            tier=meta.get("tier") or (structured.get("tier") if structured else None),
            heal_cycles=structured.get("heal_cycles") if structured else None,
            files_changed=structured.get("files_changed") if structured else None,
            result=(
                {"pr_url": effective_pr, "branch": effective_branch}
                if effective_pr or effective_branch
                else None
            ),
        )

    payload_result = (
        {"pr_url": effective_pr, "branch": effective_branch}
        if (effective_pr or effective_branch)
        else None
    )
    await task_events.emit_for_agentex_status(
        task_id, meta, status, result=payload_result
    )

    if meta.get("source") == "github_issues":
        await handle_github_callback(task_id, meta, status, effective_pr)

    await tasks_repo.mark_webhook_fired(task_id)
    log.info("task_sync_applied", task_id=task_id, status=status, source="push_or_fallback")
    return await tasks_repo.get_task_meta(task_id) or meta
