"""Background task: poll Agentex for lifecycle + terminal webhooks."""
import asyncio
import re

import structlog

from api.clients import agentex as agentex_client
from api.clients import github as github_client
from api.repositories import builds as builds_repo
from api.repositories import projects as projects_repo
from api.repositories import tasks as tasks_repo
from api.services import github_tokens
from api.services import task_events

log = structlog.get_logger(__name__)

POLL_INTERVAL = 10  # seconds
TERMINAL_STATUSES = {"completed", "failed", "cancelled", "terminated", "timeout"}
INTERMEDIATE_STATUSES = {"running", "waiting_approval"}


def _extract_pr_url(messages: list[dict]) -> str | None:
    for msg in reversed(messages):
        content = msg.get("content", "")
        if isinstance(content, str) and "/pull/" in content:
            match = re.search(r"https://github\.com/\S+/pull/\d+", content)
            if match:
                return match.group(0)
    return None


def _extract_branch(messages: list[dict], task_id: str) -> str | None:
    for msg in reversed(messages):
        content = msg.get("content", "")
        if isinstance(content, str):
            match = re.search(rf"branch[:\s]+(\S*{re.escape(task_id[:8])}\S*)", content, re.I)
            if match:
                return match.group(1)
    return None


async def _handle_github_callback(task_id: str, meta: dict, status: str, pr_url: str | None) -> None:
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
        body = f"❌ Gantry task `{task_id}` ended with status `{status}`. Check the Gantry dashboard for details."

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


async def _poll_task(task_id: str, meta: dict) -> None:
    try:
        task = await agentex_client.get_task(task_id)
    except Exception as exc:
        log.warning("poller_get_task_failed", task_id=task_id, error=str(exc))
        return

    status = task.get("status", "")
    meta = await tasks_repo.get_task_meta(task_id) or meta

    if status in INTERMEDIATE_STATUSES:
        await task_events.emit_for_agentex_status(task_id, meta, status)
        meta = await tasks_repo.get_task_meta(task_id) or meta
        await tasks_repo.update_task_status(task_id, status=status)
        return

    if status not in TERMINAL_STATUSES:
        return

    pr_url = None
    branch = None
    messages: list[dict] = []
    try:
        messages = await agentex_client.get_messages(task_id)
        pr_url = _extract_pr_url(messages)
        branch = _extract_branch(messages, task_id)
    except Exception:
        pass

    await tasks_repo.update_task_status(task_id, status=status, pr_url=pr_url, branch=branch)
    meta = await tasks_repo.get_task_meta(task_id) or meta
    meta["pr_url"] = pr_url or meta.get("pr_url")
    meta["branch"] = branch or meta.get("branch")

    project_id = meta.get("project_id")
    org_id = meta.get("org_id")
    if project_id:
        await builds_repo.upsert_build(
            task_id=task_id,
            project_id=project_id,
            org_id=org_id,
            branch=branch,
            pr_url=pr_url,
            status=status.upper() if status == "completed" else status,
            tier=meta.get("tier"),
            result={"pr_url": pr_url, "branch": branch} if pr_url or branch else None,
        )

    result = {"pr_url": pr_url, "branch": branch} if (pr_url or branch) else None
    await task_events.emit_for_agentex_status(task_id, meta, status, result=result)

    if meta.get("source") == "github_issues":
        await _handle_github_callback(task_id, meta, status, pr_url)

    await tasks_repo.mark_webhook_fired(task_id)


async def run_poller() -> None:
    log.info("poller_started", interval=POLL_INTERVAL)
    while True:
        await asyncio.sleep(POLL_INTERVAL)
        pending = await tasks_repo.pending_tasks()
        if pending:
            await asyncio.gather(
                *[_poll_task(tid, meta) for tid, meta in pending],
                return_exceptions=True,
            )
