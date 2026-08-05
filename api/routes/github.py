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

import structlog
from fastapi import APIRouter, Header, HTTPException, Request

from api.clients import github as github_client
from api.config import GITHUB_WEBHOOK_SECRET
from api.repositories import projects as projects_repo
from api.services.integration_submit import submit_integration_task

router = APIRouter(prefix="/v1/integrations/github", tags=["GitHub Integration"])
log = structlog.get_logger(__name__)

TRIGGER_LABEL = "gantry"


def _verify_signature(body: bytes, signature: str | None) -> None:
    if not GITHUB_WEBHOOK_SECRET:
        return
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing webhook signature")
    expected = "sha256=" + hmac.new(
        GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


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
        project = await projects_repo.find_by_github(owner, repo)
        if not project:
            log.warning("github_no_project", owner=owner, repo=repo)
            return {"ok": False, "reason": f"No Gantry project linked to {owner}/{repo}"}

        goal = f"{issue_title}\n\n{issue_body}".strip()

        try:
            task_id = await submit_integration_task(
                goal=goal,
                project=project,
                source="github_issues",
                meta={
                    "github_owner": owner,
                    "github_repo": repo,
                    "github_issue_number": issue_number,
                    "github_issue_title": issue_title,
                },
            )
        except Exception as exc:
            log.error("github_submit_failed", error=str(exc))
            raise HTTPException(status_code=502, detail=str(exc))

        await github_client.post_issue_comment(
            owner=owner,
            repo=repo,
            issue_number=issue_number,
            body=f"🏗️ Gantry picked this up — task `{task_id}` is running.\n\nI'll post a follow-up here when the PR is ready.",
        )

        log.info("github_task_submitted", task_id=task_id, issue=issue_number)
        return {"ok": True, "task_id": task_id}

    if action == "unlabeled" and label.get("name") == TRIGGER_LABEL:
        log.info("github_label_removed", owner=owner, repo=repo, issue=issue_number)
        return {"ok": True, "action": "ignored", "reason": "label removed"}

    return {"ok": True, "action": "ignored"}
