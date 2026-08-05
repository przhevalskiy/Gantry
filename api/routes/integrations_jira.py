"""Jira → Gantry integration.

Configure a Jira automation/webhook pointing to:
  POST /v1/integrations/jira/webhook

Trigger: add label `gantry` to an issue.

Link projects by setting `jira_project_key` (e.g. `ENG`) on the Gantry project.
"""
from __future__ import annotations

import os

import structlog
from fastapi import APIRouter, Header, HTTPException, Request

from api.repositories import projects as projects_repo
from api.services.integration_submit import submit_integration_task

router = APIRouter(prefix="/v1/integrations/jira", tags=["Jira Integration"])
log = structlog.get_logger(__name__)

JIRA_WEBHOOK_SECRET = os.getenv("JIRA_WEBHOOK_SECRET", "")
TRIGGER_LABEL = "gantry"


def _verify_jira_token(token: str | None) -> None:
    if not JIRA_WEBHOOK_SECRET:
        return
    if token != JIRA_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid Jira webhook token")


@router.post("/webhook", status_code=202)
async def jira_webhook(
    request: Request,
    x_gantry_jira_token: str | None = Header(default=None, alias="X-Gantry-Jira-Token"),
):
    _verify_jira_token(x_gantry_jira_token)

    payload = await request.json()
    issue = payload.get("issue") or payload
    fields = issue.get("fields") or issue

    summary = fields.get("summary") or issue.get("summary", "")
    description = fields.get("description") or issue.get("description", "") or ""
    if isinstance(description, dict):
        description = description.get("content", "") or str(description)

    project_data = fields.get("project") or {}
    project_key = project_data.get("key") or issue.get("projectKey", "")

    labels = fields.get("labels") or issue.get("labels") or []
    if TRIGGER_LABEL not in [lbl.lower() for lbl in labels]:
        return {"ok": True, "action": "ignored", "reason": f"no '{TRIGGER_LABEL}' label"}

    project = await projects_repo.find_by_jira_key(project_key) if project_key else None
    if not project:
        log.warning("jira_no_project", project_key=project_key)
        return {"ok": False, "reason": f"No Gantry project linked to Jira project {project_key}"}

    goal = f"{summary}\n\n{description}".strip()
    issue_key = issue.get("key", "")

    task_id = await submit_integration_task(
        goal=goal,
        project=project,
        source="jira",
        meta={
            "jira_issue_key": issue_key,
            "jira_project_key": project_key,
        },
    )

    return {"ok": True, "task_id": task_id, "jira_issue": issue_key}
