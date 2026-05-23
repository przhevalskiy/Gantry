"""GitHub Issues → Gantry integration.

Setup on the GitHub repo:
  Webhook URL:  http://your-host:8001/v1/integrations/github/webhook
  Content type: application/json
  Events:       Issues
  Secret:       value of GITHUB_WEBHOOK_SECRET in .env

Label any issue `gantry` to trigger a build.
"""
import hashlib
import hmac

import httpx
import structlog
from fastapi import APIRouter, Header, HTTPException, Request

from api import agentex_client, github_client
from api.config import GITHUB_WEBHOOK_SECRET, GANTRY_UI_URL
from api.store import tasks as task_store

router = APIRouter(prefix="/v1/integrations/github", tags=["GitHub Integration"])
log = structlog.get_logger(__name__)

TRIGGER_LABEL = "gantry"


def _verify_signature(body: bytes, signature: str | None) -> None:
    if not GITHUB_WEBHOOK_SECRET:
        return  # signature check disabled — set GITHUB_WEBHOOK_SECRET to enable
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing webhook signature")
    expected = "sha256=" + hmac.new(
        GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


async def _find_project(owner: str, repo: str) -> dict | None:
    """Find a Gantry project whose github_owner/github_repo matches."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{GANTRY_UI_URL}/api/projects")
        if not resp.is_success:
            return None
        projects = resp.json().get("projects", [])
    return next(
        (p for p in projects if p.get("github_owner") == owner and p.get("github_repo") == repo),
        None,
    )


@router.post("/webhook", status_code=202)
async def github_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None),
    x_github_event: str | None = Header(default=None),
):
    body = await request.body()
    _verify_signature(body, x_hub_signature_256)

    if x_github_event != "issues":
        return {"ok": True, "action": "ignored", "reason": "not an issues event"}

    payload = await request.json()
    action = payload.get("action")
    issue = payload.get("issue", {})
    repo_data = payload.get("repository", {})
    label = payload.get("label", {})

    owner = repo_data.get("owner", {}).get("login", "")
    repo = repo_data.get("name", "")
    issue_number = issue.get("number")
    issue_title = issue.get("title", "")
    issue_body = issue.get("body", "") or ""

    if action == "labeled" and label.get("name") == TRIGGER_LABEL:
        project = await _find_project(owner, repo)
        if not project:
            log.warning("github_no_project", owner=owner, repo=repo)
            return {"ok": False, "reason": f"No Gantry project linked to {owner}/{repo}"}

        goal = f"{issue_title}\n\n{issue_body}".strip()

        try:
            task_id = await agentex_client.submit_task(
                goal=goal,
                project_id=project["id"],
                branch_prefix="swarm",
            )
        except Exception as exc:
            log.error("github_submit_failed", error=str(exc))
            raise HTTPException(status_code=502, detail=str(exc))

        task_store.save_task(
            task_id=task_id,
            project_id=project["id"],
            webhook_url=None,
            source="github_issues",
            meta={
                "github_owner": owner,
                "github_repo": repo,
                "github_issue_number": issue_number,
                "github_issue_title": issue_title,
            },
        )

        await github_client.post_issue_comment(
            owner=owner,
            repo=repo,
            issue_number=issue_number,
            body=f"🏗️ Gantry picked this up — task `{task_id}` is running.\n\nI'll post a follow-up here when the PR is ready.",
        )

        log.info("github_task_submitted", task_id=task_id, issue=issue_number)
        return {"ok": True, "task_id": task_id}

    if action == "unlabeled" and label.get("name") == TRIGGER_LABEL:
        # Best-effort: find and terminate any running task for this issue
        pending = task_store.pending_webhook_tasks()
        all_tasks = {tid: meta for tid, meta in task_store._load().items()}
        for tid, meta in all_tasks.items():
            if (
                meta.get("source") == "github_issues"
                and meta.get("github_owner") == owner
                and meta.get("github_repo") == repo
                and meta.get("github_issue_number") == issue_number
            ):
                try:
                    await agentex_client.terminate_task(tid)
                    log.info("github_task_terminated", task_id=tid)
                except Exception:
                    pass
        return {"ok": True, "action": "unlabeled"}

    return {"ok": True, "action": "ignored"}
