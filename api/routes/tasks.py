from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import asyncio
import httpx
import structlog

from api import agentex_client, temporal_client
from api.config import GANTRY_UI_URL
from api.deps import require_api_key
from api.store import tasks as task_store

router = APIRouter(prefix="/v1/tasks", tags=["Tasks"])
log = structlog.get_logger(__name__)

_UI_BASE = GANTRY_UI_URL


BULK_LIMIT = 50


class SubmitTaskRequest(BaseModel):
    goal: str
    project_id: str
    branch_prefix: str = "swarm"
    tier: int = -1
    github_token: str | None = None
    webhook_url: str | None = None


class BulkTaskItem(BaseModel):
    goal: str
    branch_prefix: str | None = None
    tier: int | None = None
    webhook_url: str | None = None


class BulkSubmitRequest(BaseModel):
    project_id: str
    tasks: list[BulkTaskItem] = Field(..., min_length=1, max_length=BULK_LIMIT)
    branch_prefix: str = "swarm"
    tier: int = -1
    github_token: str | None = None
    webhook_url: str | None = None


def _extract_pr_url(messages: list[dict]) -> str | None:
    for msg in reversed(messages):
        content = msg.get("content", "")
        if isinstance(content, str) and "github.com" in content and "/pull/" in content:
            import re
            match = re.search(r"https://github\.com/\S+/pull/\d+", content)
            if match:
                return match.group(0)
    return None


async def _fetch_projects() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{_UI_BASE}/api/projects")
        resp.raise_for_status()
        return resp.json().get("projects", [])


async def _submit_one(
    goal: str,
    project_id: str,
    branch_prefix: str,
    tier: int,
    github_token: str,
    webhook_url: str | None,
    key_id: str,
) -> dict:
    """Submit a single task. Returns a result dict (never raises)."""
    try:
        task_id = await agentex_client.submit_task(
            goal=goal,
            project_id=project_id,
            branch_prefix=branch_prefix,
            tier=tier,
            github_token=github_token,
        )
        task_store.save_task(
            task_id=task_id,
            project_id=project_id,
            webhook_url=webhook_url,
            source="api",
            meta={"key_id": key_id},
        )
        return {"goal": goal, "task_id": task_id, "status": "queued"}
    except Exception as exc:
        log.error("task_submit_failed", goal=goal, error=str(exc))
        return {"goal": goal, "error": str(exc)}


@router.post("", status_code=201)
async def submit_task(body: SubmitTaskRequest, key: dict = Depends(require_api_key)):
    projects = await _fetch_projects()
    if not any(p["id"] == body.project_id for p in projects):
        raise HTTPException(status_code=404, detail="project not found")

    result = await _submit_one(
        goal=body.goal,
        project_id=body.project_id,
        branch_prefix=body.branch_prefix,
        tier=body.tier,
        github_token=body.github_token or "",
        webhook_url=body.webhook_url,
        key_id=key["id"],
    )

    if "error" in result:
        raise HTTPException(status_code=502, detail=f"Agentex error: {result['error']}")

    return {"task_id": result["task_id"], "status": "queued", "project_id": body.project_id}


@router.post("/bulk", status_code=202)
async def bulk_submit_tasks(body: BulkSubmitRequest, key: dict = Depends(require_api_key)):
    """Submit up to 50 tasks in parallel. Returns partial results — failed items include an error field."""
    projects = await _fetch_projects()
    if not any(p["id"] == body.project_id for p in projects):
        raise HTTPException(status_code=404, detail="project not found")

    coroutines = [
        _submit_one(
            goal=item.goal,
            project_id=body.project_id,
            branch_prefix=item.branch_prefix or body.branch_prefix,
            tier=item.tier if item.tier is not None else body.tier,
            github_token=body.github_token or "",
            webhook_url=item.webhook_url or body.webhook_url,
            key_id=key["id"],
        )
        for item in body.tasks
    ]

    results = await asyncio.gather(*coroutines)

    submitted = [r for r in results if "task_id" in r]
    failed = [r for r in results if "error" in r]

    log.info("bulk_submitted", total=len(results), ok=len(submitted), failed=len(failed))

    return {
        "project_id": body.project_id,
        "submitted": len(submitted),
        "failed": len(failed),
        "results": list(results),
    }


@router.get("/{task_id}")
async def get_task(task_id: str, _key: dict = Depends(require_api_key)):
    try:
        task = await agentex_client.get_task(task_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="task not found")
        raise HTTPException(status_code=502, detail=str(exc))

    messages = []
    try:
        messages = await agentex_client.get_messages(task_id)
    except Exception:
        pass

    meta = task_store.get_task_meta(task_id) or {}
    return {
        "task_id": task_id,
        "status": task.get("status", "unknown"),
        "pr_url": _extract_pr_url(messages),
        "project_id": meta.get("project_id"),
        "source": meta.get("source"),
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at"),
    }


@router.get("/{task_id}/messages")
async def get_task_messages(task_id: str, _key: dict = Depends(require_api_key)):
    try:
        messages = await agentex_client.get_messages(task_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="task not found")
        raise HTTPException(status_code=502, detail=str(exc))
    return {"task_id": task_id, "messages": messages}


@router.delete("/{task_id}", status_code=204)
async def terminate_task(task_id: str, _key: dict = Depends(require_api_key)):
    try:
        await agentex_client.terminate_task(task_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="task not found")
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/{task_id}/source")
async def get_task_source(task_id: str):
    """Public (no auth) — returns only source metadata for UI badge rendering."""
    meta = task_store.get_task_meta(task_id)
    if not meta:
        return {"source": "ui"}
    return {
        "source": meta.get("source", "ui"),
        "github_owner": meta.get("github_owner"),
        "github_repo": meta.get("github_repo"),
        "github_issue_number": meta.get("github_issue_number"),
    }


@router.post("/{task_id}/approve")
async def approve_task(task_id: str, body: dict, _key: dict = Depends(require_api_key)):
    """Send a HITL approval signal to the running workflow."""
    workflow_id = body.get("workflow_id", task_id)
    signal_name = body.get("signal", "approve")
    payload = body.get("payload")
    if payload is None:
        payload = body.get("approved", True)

    try:
        await temporal_client.signal_workflow(workflow_id, signal_name, payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"ok": True}
