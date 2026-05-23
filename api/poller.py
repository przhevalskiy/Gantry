"""Background task: poll Agentex for completion, fire webhooks, and post GitHub callbacks."""
import asyncio
import re

import structlog

from api import agentex_client, github_client, webhooks
from api.store import tasks as task_store

log = structlog.get_logger(__name__)

POLL_INTERVAL = 10  # seconds
TERMINAL_STATUSES = {"completed", "failed", "cancelled", "terminated", "timeout"}


def _extract_pr_url(messages: list[dict]) -> str | None:
    for msg in reversed(messages):
        content = msg.get("content", "")
        if isinstance(content, str) and "/pull/" in content:
            match = re.search(r"https://github\.com/\S+/pull/\d+", content)
            if match:
                return match.group(0)
    return None


async def _handle_github_callback(task_id: str, meta: dict, status: str, pr_url: str | None) -> None:
    owner = meta.get("github_owner")
    repo = meta.get("github_repo")
    issue_number = meta.get("github_issue_number")
    if not (owner and repo and issue_number):
        return

    if status == "completed" and pr_url:
        body = f"✅ Done — PR opened: {pr_url}"
    elif status == "completed":
        body = "✅ Gantry completed the task. Check the repository for new branches or commits."
    else:
        body = f"❌ Gantry task `{task_id}` ended with status `{status}`. Check the Gantry dashboard for details."

    try:
        await github_client.post_issue_comment(
            owner=owner,
            repo=repo,
            issue_number=issue_number,
            body=body,
        )
        log.info("github_callback_posted", task_id=task_id, issue=issue_number, status=status)
    except Exception as exc:
        log.error("github_callback_failed", task_id=task_id, error=str(exc))


async def _check_and_fire(task_id: str, meta: dict) -> None:
    try:
        task = await agentex_client.get_task(task_id)
    except Exception as exc:
        log.warning("poller_get_task_failed", task_id=task_id, error=str(exc))
        return

    status = task.get("status", "")
    if status not in TERMINAL_STATUSES:
        return

    pr_url = None
    try:
        messages = await agentex_client.get_messages(task_id)
        pr_url = _extract_pr_url(messages)
    except Exception:
        pass

    # Fire outbound webhook if registered
    webhook_url = meta.get("webhook_url")
    if webhook_url:
        if status == "completed":
            event = "task.completed"
            payload = {
                "task_id": task_id,
                "project_id": meta.get("project_id"),
                "source": meta.get("source"),
                "pr_url": pr_url,
            }
        else:
            event = "task.failed"
            payload = {
                "task_id": task_id,
                "project_id": meta.get("project_id"),
                "source": meta.get("source"),
                "status": status,
            }
        await webhooks.fire_webhook(webhook_url, event, payload)
        log.info("webhook_fired", task_id=task_id, event=event)

    # Post completion comment back to GitHub if triggered from an issue
    if meta.get("source") == "github_issues":
        await _handle_github_callback(task_id, meta, status, pr_url)

    task_store.mark_webhook_fired(task_id)


async def run_poller() -> None:
    log.info("poller_started", interval=POLL_INTERVAL)
    while True:
        await asyncio.sleep(POLL_INTERVAL)
        pending = task_store.pending_tasks()
        if pending:
            await asyncio.gather(
                *[_check_and_fire(tid, meta) for tid, meta in pending],
                return_exceptions=True,
            )
