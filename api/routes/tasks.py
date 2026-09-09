from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

import asyncio
import json
import os
import re
import structlog
from pathlib import Path

from api.clients import agentex as agentex_client
from api.clients import temporal as temporal_client
from api.deps import client_ip, require_any_scope, require_scope
from api.repositories import audit as audit_repo
from api.repositories import builds as builds_repo
from api.repositories import projects as projects_repo
from api.repositories import quotas as quotas_repo
from api.repositories import tasks as tasks_repo
from api.repositories import usage as usage_repo
from api.repositories.quotas import QuotaExceeded
from api.schemas.llm import LlmConfig
from api.schemas.pipeline import PipelineConfig
from api.schemas.task_sse import (
    done_event,
    error_event,
    hitl_event,
    lifecycle_event,
    message_event,
    status_event,
)
from api.services import github_tokens
from api.services import llm_config as llm_config_service
from api.services import task_events
from fastapi.responses import StreamingResponse
from project.schema.crew import autonomy_for_tier, get_checkpoint
from project.schema.playbooks import resolve_submit_params

router = APIRouter(prefix="/v1/tasks", tags=["Tasks"])
log = structlog.get_logger(__name__)

TERMINAL_STATUSES = {"completed", "failed", "cancelled", "terminated", "timeout"}


class SubmitTaskRequest(BaseModel):
    goal: str
    project_id: str
    branch_prefix: str = "swarm"
    tier: int = -1
    playbook: str | None = None
    github_token: str | None = None
    github_token_secret: str | None = None
    webhook_url: str | None = None
    pipeline: PipelineConfig | None = None
    llm: LlmConfig | None = None


class BulkTaskItem(BaseModel):
    goal: str
    branch_prefix: str | None = None
    tier: int | None = None
    webhook_url: str | None = None
    pipeline: PipelineConfig | None = None
    llm: LlmConfig | None = None


class BulkSubmitRequest(BaseModel):
    project_id: str
    tasks: list[BulkTaskItem] = Field(..., min_length=1)
    branch_prefix: str = "swarm"
    tier: int = -1
    playbook: str | None = None
    github_token: str | None = None
    github_token_secret: str | None = None
    webhook_url: str | None = None
    pipeline: PipelineConfig | None = None
    llm: LlmConfig | None = None


class HitlRequest(BaseModel):
    checkpoint: str
    workflow_id: str
    payload: bool | dict | None = None
    approved: bool | None = None
    signal: str | None = None


class FollowUpRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


def _extract_pr_url(messages: list[dict]) -> str | None:
    for msg in reversed(messages):
        content = msg.get("content", "")
        if isinstance(content, str) and "github.com" in content and "/pull/" in content:
            match = re.search(r"https://github\.com/\S+/pull/\d+", content)
            if match:
                return match.group(0)
    return None


async def _verify_project(project_id: str, org_id: str) -> dict:
    project = await projects_repo.get_project(project_id, org_id=org_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    return project


async def _resolve_github_token(
    org_id: str,
    project: dict,
    github_token: str | None,
    github_token_secret: str | None,
) -> str:
    return await github_tokens.resolve_token(
        org_id=org_id,
        project=project,
        github_token=github_token,
        github_token_secret=github_token_secret,
    )


def _resolve_pipeline_params(
    tier: int,
    pipeline: PipelineConfig | None,
) -> tuple[int, dict]:
    """Merge top-level tier with optional pipeline overrides for Agentex."""
    if not pipeline:
        return tier, {}
    try:
        params = pipeline.to_agentex_params()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    effective_tier = pipeline.tier if pipeline.tier is not None else tier
    params.pop("tier", None)
    return effective_tier, params


async def _submit_one(
    goal: str,
    project_id: str,
    org_id: str,
    branch_prefix: str,
    tier: int,
    github_token: str,
    github_token_secret: str | None,
    webhook_url: str | None,
    key_id: str,
    idempotency_key: str | None = None,
    pipeline: PipelineConfig | None = None,
    llm: LlmConfig | None = None,
    playbook: str | None = None,
) -> dict:
    try:
        project = await _verify_project(project_id, org_id)
        token = await _resolve_github_token(org_id, project, github_token or None, github_token_secret)
        try:
            goal, branch_prefix, tier, pipeline_overlay, playbook_id = resolve_submit_params(
                goal=goal,
                branch_prefix=branch_prefix,
                tier=tier,
                playbook_id=playbook,
                pipeline=pipeline.model_dump(exclude_unset=True) if pipeline else None,
            )
        except ValueError as exc:
            return {"goal": goal, "error": str(exc)}
        if pipeline_overlay:
            combined = {**(pipeline.model_dump(exclude_unset=True) if pipeline else {}), **pipeline_overlay}
            pipeline = PipelineConfig.model_validate(combined)
        effective_tier, extra_params = _resolve_pipeline_params(tier, pipeline)
        llm_params = await llm_config_service.resolve_llm_agentex_params(org_id, llm)
        if llm_params:
            extra_params = {**extra_params, **llm_params}
        if playbook_id:
            extra_params = {**(extra_params or {}), "playbook": playbook_id}
        if project.get("repo_path"):
            extra_params = {**(extra_params or {}), "repo_path": project["repo_path"]}
        if project.get("github_url"):
            extra_params = {**(extra_params or {}), "github_url": project["github_url"]}
        task_id = await agentex_client.submit_task(
            goal=goal,
            project_id=project_id,
            branch_prefix=branch_prefix,
            tier=effective_tier,
            github_token=token,
            extra_params=extra_params or None,
        )
        autonomy = autonomy_for_tier(effective_tier if effective_tier >= 0 else None)
        task_meta: dict = {}
        if autonomy:
            task_meta["autonomy_level"] = autonomy
        if playbook_id:
            task_meta["playbook"] = playbook_id
        task_meta["goal"] = goal
        await tasks_repo.save_task(
            task_id=task_id,
            org_id=org_id,
            project_id=project_id,
            webhook_url=webhook_url,
            source="api",
            key_id=key_id,
            tier=effective_tier if effective_tier >= 0 else None,
            idempotency_key=idempotency_key,
            meta=task_meta or None,
        )
        meta = await tasks_repo.get_task_meta(task_id, org_id=org_id) or {}
        await task_events.emit_task_event(task_id, meta, "task.queued", extra={"status": "queued"})
        return {"goal": goal, "task_id": task_id, "status": "queued"}
    except HTTPException:
        raise
    except Exception as exc:
        log.error("task_submit_failed", goal=goal, error=str(exc))
        return {"goal": goal, "error": str(exc)}


async def _build_task_response(task_id: str, org_id: str, agentex_task: dict, messages: list[dict]) -> dict:
    meta = await tasks_repo.get_task_meta(task_id, org_id=org_id) or {}
    status = agentex_task.get("status", "unknown")
    result = await tasks_repo.get_task_result(task_id, org_id=org_id)

    if not result and status in TERMINAL_STATUSES:
        pr_url = _extract_pr_url(messages)
        if pr_url or meta.get("pr_url"):
            result = {
                "pr_url": pr_url or meta.get("pr_url"),
                "branch": meta.get("branch"),
            }

    return {
        "task_id": task_id,
        "status": status,
        "project_id": meta.get("project_id"),
        "source": meta.get("source", "api"),
        "tier": meta.get("tier"),
        "autonomy_level": meta.get("autonomy_level") or autonomy_for_tier(meta.get("tier")),
        "playbook": meta.get("playbook"),
        "track_warnings": meta.get("track_warnings") or [],
        "pending_hitl": meta.get("pending_hitl") or [],
        "created_at": agentex_task.get("created_at") or meta.get("created_at"),
        "updated_at": agentex_task.get("updated_at"),
        "result": result,
    }


@router.post("", status_code=201)
async def submit_task(
    body: SubmitTaskRequest,
    request: Request,
    key: dict = Depends(require_scope("tasks:write")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    if idempotency_key:
        existing = await usage_repo.find_task_by_idempotency(key["org_id"], idempotency_key)
        if existing:
            return {
                "task_id": existing,
                "status": "queued",
                "project_id": body.project_id,
                "org_id": key["org_id"],
                "idempotent": True,
            }

    try:
        await quotas_repo.check_task_submit(key["org_id"], bulk_count=1)
    except QuotaExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc))

    result = await _submit_one(
        goal=body.goal,
        project_id=body.project_id,
        org_id=key["org_id"],
        branch_prefix=body.branch_prefix,
        tier=body.tier,
        github_token=body.github_token or "",
        github_token_secret=body.github_token_secret,
        webhook_url=body.webhook_url,
        key_id=key["id"],
        idempotency_key=idempotency_key,
        pipeline=body.pipeline,
        llm=body.llm,
        playbook=body.playbook,
    )

    if "error" in result:
        err = result["error"]
        if err.startswith("unknown playbook"):
            raise HTTPException(status_code=422, detail=err)
        raise HTTPException(status_code=502, detail=f"Agentex error: {err}")

    await usage_repo.record_event(
        org_id=key["org_id"],
        event_type="task.submitted",
        key_id=key["id"],
        task_id=result["task_id"],
        metadata={"project_id": body.project_id, "tier": body.tier},
    )
    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action="task.submitted",
        resource_type="task",
        resource_id=result["task_id"],
        metadata={"project_id": body.project_id},
        ip_address=client_ip(request),
    )

    return {
        "task_id": result["task_id"],
        "status": "queued",
        "project_id": body.project_id,
        "org_id": key["org_id"],
        "autonomy_level": autonomy_for_tier(body.tier if body.tier >= 0 else None),
    }


@router.post("/bulk", status_code=202)
async def bulk_submit_tasks(
    body: BulkSubmitRequest,
    request: Request,
    key: dict = Depends(require_scope("tasks:write")),
):
    await _verify_project(body.project_id, key["org_id"])
    project = await projects_repo.get_project(body.project_id, org_id=key["org_id"])
    quotas = await quotas_repo.get_quotas(key["org_id"])
    if len(body.tasks) > quotas.max_bulk_size:
        raise HTTPException(
            status_code=429,
            detail=f"bulk size {len(body.tasks)} exceeds limit of {quotas.max_bulk_size}",
        )

    try:
        await quotas_repo.check_task_submit(key["org_id"], bulk_count=len(body.tasks))
    except QuotaExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc))

    token = await _resolve_github_token(
        key["org_id"], project or {}, body.github_token, body.github_token_secret
    )

    coroutines = [
        _submit_one(
            goal=item.goal,
            project_id=body.project_id,
            org_id=key["org_id"],
            branch_prefix=item.branch_prefix or body.branch_prefix,
            tier=item.tier if item.tier is not None else body.tier,
            github_token=token,
            github_token_secret=None,
            webhook_url=item.webhook_url or body.webhook_url,
            key_id=key["id"],
            pipeline=item.pipeline or body.pipeline,
            llm=item.llm or body.llm,
            playbook=body.playbook,
        )
        for item in body.tasks
    ]

    results = await asyncio.gather(*coroutines, return_exceptions=False)

    submitted = [r for r in results if "task_id" in r]
    failed = [r for r in results if "error" in r]

    for r in submitted:
        await usage_repo.record_event(
            org_id=key["org_id"],
            event_type="task.submitted",
            key_id=key["id"],
            task_id=r["task_id"],
            metadata={"project_id": body.project_id, "bulk": True},
        )

    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action="task.bulk_submitted",
        resource_type="project",
        resource_id=body.project_id,
        metadata={"submitted": len(submitted), "failed": len(failed)},
        ip_address=client_ip(request),
    )

    log.info("bulk_submitted", total=len(results), ok=len(submitted), failed=len(failed))

    return {
        "project_id": body.project_id,
        "org_id": key["org_id"],
        "submitted": len(submitted),
        "failed": len(failed),
        "results": list(results),
    }


def _goal_from_agentex(task: dict) -> str | None:
    params = task.get("params") or {}
    if not isinstance(params, dict):
        return None
    for key in ("query", "prompt", "content", "goal"):
        val = params.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


@router.get("")
async def list_tasks(
    key: dict = Depends(require_any_scope("tasks:read", "tasks:write")),
    limit: int = 50,
):
    """List factory runs for the org, enriched with live Agentex status."""
    limit = max(1, min(limit, 100))
    rows = await tasks_repo.list_tasks(org_id=key["org_id"], limit=limit)

    agentex_by_id: dict[str, dict] = {}
    try:
        for task in await agentex_client.list_tasks():
            tid = task.get("id") or task.get("task_id")
            if tid:
                agentex_by_id[str(tid)] = task
    except Exception as exc:
        log.warning("agentex_list_tasks_failed", error=str(exc))

    tasks: list[dict] = []
    for task_id, meta in rows:
        ax = agentex_by_id.get(task_id, {})
        status = ax.get("status") or meta.get("status") or "unknown"
        goal = meta.get("goal") or _goal_from_agentex(ax)
        tasks.append({
            "task_id": task_id,
            "status": status,
            "goal": goal,
            "project_id": meta.get("project_id"),
            "tier": meta.get("tier"),
            "playbook": meta.get("playbook"),
            "created_at": ax.get("created_at") or meta.get("created_at"),
            "updated_at": ax.get("updated_at"),
        })

    return {"tasks": tasks, "count": len(tasks)}


@router.get("/{task_id}")
async def get_task(task_id: str, key: dict = Depends(require_any_scope("tasks:read", "tasks:write"))):
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")

    import httpx
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

    return await _build_task_response(task_id, key["org_id"], task, messages)


@router.get("/{task_id}/events")
async def stream_task_events(
    task_id: str,
    key: dict = Depends(require_any_scope("tasks:read", "tasks:write")),
):
    """SSE stream of task status changes and new agent messages."""
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")

    async def event_generator():
        last_status: str | None = None
        last_msg_count = 0
        events_fired = set(meta.get("events_fired") or [])
        hitl_sent: set[str] = set()

        while True:
            try:
                task = await agentex_client.get_task(task_id)
            except Exception:
                yield error_event("failed to fetch task")
                break

            status = task.get("status", "unknown")
            if status != last_status:
                yield status_event(status)
                last_status = status

            fresh = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"]) or {}
            new_events = set(fresh.get("events_fired") or []) - events_fired
            for ev in sorted(new_events):
                yield lifecycle_event(ev)
                events_fired.add(ev)

            for pending in fresh.get("pending_hitl") or []:
                ck = pending.get("checkpoint", "")
                wf = pending.get("workflow_id", "")
                key_sig = f"{ck}:{wf}"
                if key_sig and key_sig not in hitl_sent:
                    spec = get_checkpoint(ck)
                    yield hitl_event(
                        checkpoint=ck,
                        workflow_id=wf,
                        description=spec["description"] if spec else None,
                    )
                    hitl_sent.add(key_sig)

            try:
                messages = await agentex_client.get_messages(task_id)
                if len(messages) > last_msg_count:
                    for msg in messages[last_msg_count:]:
                        yield message_event(msg)
                    last_msg_count = len(messages)
            except Exception:
                pass

            if status in TERMINAL_STATUSES:
                result = await tasks_repo.get_task_result(task_id, org_id=key["org_id"])
                yield done_event(status=status, result=result)
                break

            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/{task_id}/report")
async def get_task_report(task_id: str, key: dict = Depends(require_any_scope("tasks:read", "tasks:write"))):
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")

    build = await builds_repo.get_build(task_id, org_id=key["org_id"])
    result = await tasks_repo.get_task_result(task_id, org_id=key["org_id"])

    return {
        "task_id": task_id,
        "project_id": meta.get("project_id"),
        "source": meta.get("source"),
        "status": meta.get("status"),
        "result": result,
        "build": build,
    }


@router.get("/{task_id}/messages")
async def get_task_messages(task_id: str, key: dict = Depends(require_any_scope("tasks:read", "tasks:write"))):
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")

    import httpx
    try:
        messages = await agentex_client.get_messages(task_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="task not found")
        raise HTTPException(status_code=502, detail=str(exc))
    return {"task_id": task_id, "messages": messages}


@router.get("/{task_id}/traces")
async def get_task_traces(task_id: str, key: dict = Depends(require_any_scope("tasks:read", "tasks:write"))):
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")

    repo_path = None
    project_id = meta.get("project_id")
    if project_id:
        project = await projects_repo.get_project(project_id, org_id=key["org_id"])
        if project:
            repo_path = project.get("repo_path")

    gantry_home = os.getenv("GANTRY_HOME", str(Path.home() / ".gantry"))
    traces_dir = (
        Path(repo_path) / ".gantry" / "traces"
        if repo_path
        else Path(gantry_home) / "traces"
    )
    trace_file = traces_dir / f"{task_id}.jsonl"
    if not trace_file.exists():
        return []

    records = []
    for line in trace_file.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except Exception:
            pass
    return records


@router.delete("/{task_id}", status_code=204)
async def terminate_task(task_id: str, key: dict = Depends(require_scope("tasks:write"))):
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")

    import httpx
    try:
        await agentex_client.terminate_task(task_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="task not found")
        raise HTTPException(status_code=502, detail=str(exc))

    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action="task.terminated",
        resource_type="task",
        resource_id=task_id,
    )


@router.post("/{task_id}/followup")
async def send_task_followup(
    task_id: str,
    body: FollowUpRequest,
    key: dict = Depends(require_scope("tasks:write")),
):
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")

    import httpx
    try:
        await agentex_client.send_followup(task_id, body.prompt.strip())
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="task not found")
        raise HTTPException(status_code=502, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action="task.followup",
        resource_type="task",
        resource_id=task_id,
        metadata={"prompt_len": len(body.prompt.strip())},
    )
    return {"ok": True}


@router.get("/{task_id}/source")
async def get_task_source(task_id: str):
    meta = await tasks_repo.get_task_meta(task_id)
    if not meta:
        return {"source": "ui"}
    return {
        "source": meta.get("source", "ui"),
        "github_owner": meta.get("github_owner"),
        "github_repo": meta.get("github_repo"),
        "github_issue_number": meta.get("github_issue_number"),
    }


@router.post("/{task_id}/approve")
async def approve_task(task_id: str, body: dict, key: dict = Depends(require_scope("tasks:write"))):
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")

    workflow_id = body.get("workflow_id", task_id)
    checkpoint_id = body.get("checkpoint")
    spec = get_checkpoint(checkpoint_id) if checkpoint_id else None
    signal_name = body.get("signal") or (spec["signal"] if spec else "approve")
    payload = body.get("payload")
    if payload is None:
        payload = body.get("approved", True)

    try:
        await temporal_client.signal_workflow(workflow_id, signal_name, payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action=spec["acp_event"] if spec else "task.approved",
        resource_type="task",
        resource_id=task_id,
        metadata={
            "approved": payload,
            "signal": signal_name,
            "workflow_id": workflow_id,
            "checkpoint": checkpoint_id,
        },
    )
    return {"ok": True, "checkpoint": checkpoint_id, "signal": signal_name}


@router.post("/{task_id}/hitl")
async def hitl_signal(
    task_id: str,
    body: HitlRequest,
    key: dict = Depends(require_scope("tasks:write")),
):
    """Agentex-shaped HITL door — named checkpoint, durable Temporal signal, audit (C3)."""
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")

    spec = get_checkpoint(body.checkpoint)
    if not spec:
        raise HTTPException(status_code=422, detail=f"unknown checkpoint: {body.checkpoint}")

    signal_name = body.signal or spec["signal"]
    payload: bool | dict
    if body.payload is not None:
        payload = body.payload
    elif body.approved is not None:
        payload = body.approved
    elif signal_name == "submit":
        raise HTTPException(status_code=422, detail="payload object required for clarification")
    else:
        payload = True

    try:
        await temporal_client.signal_workflow(body.workflow_id, signal_name, payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action=spec["acp_event"],
        resource_type="task",
        resource_id=task_id,
        metadata={
            "checkpoint": body.checkpoint,
            "signal": signal_name,
            "workflow_id": body.workflow_id,
            "payload": payload,
        },
    )
    return {
        "ok": True,
        "checkpoint": body.checkpoint,
        "acp_event": spec["acp_event"],
        "signal": signal_name,
        "workflow": spec["workflow"],
    }


@router.get("/{task_id}/hitl")
async def list_task_hitl(
    task_id: str,
    key: dict = Depends(require_any_scope("tasks:read", "tasks:write")),
):
    meta = await tasks_repo.get_task_meta(task_id, org_id=key["org_id"])
    if not meta:
        raise HTTPException(status_code=404, detail="task not found")
    entries = await audit_repo.list_entries(
        org_id=key["org_id"],
        resource_type="task",
        resource_id=task_id,
        limit=200,
    )
    hitl = [e for e in entries if str(e.get("action", "")).startswith("hitl.") or e.get("action") == "task.approved"]
    return {"task_id": task_id, "events": hitl, "count": len(hitl)}
