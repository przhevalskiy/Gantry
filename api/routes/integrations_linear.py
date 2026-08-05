"""Linear → Gantry integration.

Configure a Linear webhook pointing to:
  POST /v1/integrations/linear/webhook

Trigger: add label `gantry` to an issue, or move to a configured workflow state.

Link projects by setting `linear_team_id` when creating/updating a project.
"""
from __future__ import annotations

import hashlib
import hmac
import os

import structlog
from fastapi import APIRouter, Header, HTTPException, Request

from api.repositories import projects as projects_repo
from api.services.integration_submit import submit_integration_task

router = APIRouter(prefix="/v1/integrations/linear", tags=["Linear Integration"])
log = structlog.get_logger(__name__)

LINEAR_WEBHOOK_SECRET = os.getenv("LINEAR_WEBHOOK_SECRET", "")
TRIGGER_LABEL = "gantry"


def _verify_linear_signature(body: bytes, signature: str | None) -> None:
    if not LINEAR_WEBHOOK_SECRET:
        return
    if not signature:
        raise HTTPException(status_code=401, detail="Missing Linear-Signature header")
    expected = hmac.new(
        LINEAR_WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid Linear webhook signature")


@router.post("/webhook", status_code=202)
async def linear_webhook(
    request: Request,
    linear_signature: str | None = Header(default=None, alias="Linear-Signature"),
):
    body = await request.body()
    _verify_linear_signature(body, linear_signature)

    payload = await request.json()
    action = payload.get("action")
    data = payload.get("data", {})
    event_type = payload.get("type", "")

    if event_type != "Issue" or action not in ("create", "update"):
        return {"ok": True, "action": "ignored", "reason": "not an issue create/update"}

    issue = data
    title = issue.get("title", "")
    description = issue.get("description", "") or ""
    team = issue.get("team") or {}
    team_id = team.get("id") if isinstance(team, dict) else None

    labels = issue.get("labels") or []
    label_names = {
        (lbl.get("name") if isinstance(lbl, dict) else str(lbl)).lower()
        for lbl in labels
    }

    if TRIGGER_LABEL not in label_names:
        return {"ok": True, "action": "ignored", "reason": f"no '{TRIGGER_LABEL}' label"}

    project = None
    if team_id:
        project = await projects_repo.find_by_linear_team(team_id)
    if not project:
        log.warning("linear_no_project", team_id=team_id)
        return {"ok": False, "reason": f"No Gantry project linked to Linear team {team_id}"}

    goal = f"{title}\n\n{description}".strip()
    identifier = issue.get("identifier", issue.get("id", ""))

    task_id = await submit_integration_task(
        goal=goal,
        project=project,
        source="linear",
        meta={
            "linear_issue_id": issue.get("id"),
            "linear_identifier": identifier,
            "linear_team_id": team_id,
        },
    )

    return {"ok": True, "task_id": task_id, "linear_issue": identifier}
