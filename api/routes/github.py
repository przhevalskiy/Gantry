"""GitHub integration — App install flow, webhooks, and Issues trigger."""
from __future__ import annotations

import hashlib
import hmac

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from api.clients import github as github_client
from api.config import GANTRY_PUBLIC_URL, GANTRY_WEB_URL, GITHUB_APP_WEBHOOK_SECRET, GITHUB_WEBHOOK_SECRET
from api.deps import require_scope
from api.repositories import github_installations as installations_repo
from api.repositories import projects as projects_repo
from api.services import github_app
from api.services import github_install_state
from api.services import github_tokens
from api.services.integration_submit import submit_integration_task

router = APIRouter(prefix="/v1/integrations/github", tags=["GitHub Integration"])
log = structlog.get_logger(__name__)

TRIGGER_LABEL = "gantry"


def _webhook_secret() -> str:
    return GITHUB_APP_WEBHOOK_SECRET or GITHUB_WEBHOOK_SECRET


def _verify_signature(body: bytes, signature: str | None) -> None:
    secret = _webhook_secret()
    if not secret:
        return
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing webhook signature")
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


@router.get("/install")
async def github_install(key: dict = Depends(require_scope("admin"))):
    """Return the GitHub App installation URL for this org."""
    if not github_app.is_configured():
        raise HTTPException(
            status_code=503,
            detail="GitHub App not configured — set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY",
        )
    state = github_install_state.sign_org_state(key["org_id"])
    return {
        "install_url": github_app.install_url(state),
        "setup_url": f"{GANTRY_PUBLIC_URL.rstrip('/')}/v1/integrations/github/setup",
        "state": state,
    }


@router.get("/setup")
async def github_setup(
    installation_id: int = Query(...),
    setup_action: str = Query(default="install"),
    state: str = Query(default=""),
):
    """GitHub redirects here after App installation — link installation to org."""
    org_id = github_install_state.verify_org_state(state)
    if not org_id:
        raise HTTPException(status_code=400, detail="Invalid or missing install state")

    if not github_app.is_configured():
        raise HTTPException(status_code=503, detail="GitHub App not configured")

    try:
        remote = await github_app.fetch_installation(installation_id)
    except Exception as exc:
        log.error("github_fetch_installation_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="Failed to verify installation with GitHub") from exc

    account = remote.get("account") or {}
    await installations_repo.upsert_installation(
        installation_id=installation_id,
        org_id=org_id,
        account_login=account.get("login", ""),
        account_type=account.get("type", "Organization"),
        repository_selection=remote.get("repository_selection", "selected"),
    )

    log.info("github_app_installed", installation_id=installation_id, org_id=org_id, action=setup_action)
    return RedirectResponse(url=f"{GANTRY_WEB_URL}/settings?github_app=installed", status_code=302)


@router.get("/installations")
async def list_installations(key: dict = Depends(require_scope("admin"))):
    """List GitHub App installations linked to this org."""
    installations = await installations_repo.list_by_org(key["org_id"])
    return {"installations": installations}


@router.delete("/installations/{installation_id}", status_code=204)
async def remove_installation(
    installation_id: int,
    key: dict = Depends(require_scope("admin")),
):
    """Remove a local installation record (uninstall on GitHub separately)."""
    record = await installations_repo.get_installation(installation_id)
    if not record or record["org_id"] != key["org_id"]:
        raise HTTPException(status_code=404, detail="installation not found")
    await installations_repo.delete_installation(installation_id)


async def _handle_installation_event(action: str, payload: dict) -> dict:
    installation = payload.get("installation") or {}
    installation_id = installation.get("id")
    if not installation_id:
        return {"ok": True, "action": "ignored"}

    account = installation.get("account") or {}

    if action == "deleted":
        await installations_repo.delete_installation(installation_id)
        log.info("github_installation_deleted", installation_id=installation_id)
        return {"ok": True, "action": "deleted"}

    org_id = None
    existing = await installations_repo.get_installation(installation_id)
    if existing:
        org_id = existing["org_id"]

    if not org_id:
        log.warning("github_installation_unlinked", installation_id=installation_id)
        return {"ok": True, "action": "ignored", "reason": "installation not linked — complete /install flow first"}

    suspended_at = installation.get("suspended_at")
    await installations_repo.upsert_installation(
        installation_id=installation_id,
        org_id=org_id,
        account_login=account.get("login", ""),
        account_type=account.get("type", "Organization"),
        repository_selection=installation.get("repository_selection", "selected"),
        suspended_at=suspended_at,
    )
    return {"ok": True, "action": action, "installation_id": installation_id}


async def _handle_installation_repositories(action: str, payload: dict) -> dict:
    installation = payload.get("installation") or {}
    installation_id = installation.get("id")
    if not installation_id:
        return {"ok": True, "action": "ignored"}

    repos_added = [
        {"owner": r.get("owner", {}).get("login", ""), "name": r.get("name", "")}
        for r in payload.get("repositories_added") or []
    ]
    repos_removed = [
        {"owner": r.get("owner", {}).get("login", ""), "name": r.get("name", "")}
        for r in payload.get("repositories_removed") or []
    ]

    if repos_added:
        await installations_repo.add_repositories(installation_id, repos_added)
    if repos_removed:
        await installations_repo.remove_repositories(installation_id, repos_removed)

    return {"ok": True, "action": action, "added": len(repos_added), "removed": len(repos_removed)}


async def _handle_issues_event(payload: dict) -> dict:
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
        token = await github_tokens.resolve_token(org_id=project.get("org_id"), project=project)

        try:
            task_id = await submit_integration_task(
                goal=goal,
                project=project,
                source="github_issues",
                github_token=token,
                meta={
                    "github_owner": owner,
                    "github_repo": repo,
                    "github_issue_number": issue_number,
                    "github_issue_title": issue_title,
                },
            )
        except Exception as exc:
            log.error("github_submit_failed", error=str(exc))
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        if token:
            await github_client.post_issue_comment(
                owner=owner,
                repo=repo,
                issue_number=issue_number,
                body=(
                    f"🏗️ Gantry picked this up — task `{task_id}` is running.\n\n"
                    "I'll post a follow-up here when the PR is ready."
                ),
                token=token,
            )

        log.info("github_task_submitted", task_id=task_id, issue=issue_number)
        return {"ok": True, "task_id": task_id}

    if action == "unlabeled" and label.get("name") == TRIGGER_LABEL:
        return {"ok": True, "action": "ignored", "reason": "label removed"}

    return {"ok": True, "action": "ignored"}


@router.post("/webhook", status_code=202)
async def github_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None),
    x_github_event: str | None = Header(default=None),
):
    body = await request.body()
    _verify_signature(body, x_hub_signature_256)

    if x_github_event == "ping":
        return {"ok": True, "action": "ping"}

    payload = await request.json()

    if x_github_event == "installation":
        return await _handle_installation_event(payload.get("action", ""), payload)

    if x_github_event == "installation_repositories":
        return await _handle_installation_repositories(payload.get("action", ""), payload)

    if x_github_event == "issues":
        return await _handle_issues_event(payload)

    return {"ok": True, "action": "ignored", "reason": f"unhandled event: {x_github_event}"}
