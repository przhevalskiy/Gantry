#!/usr/bin/env python3
"""Minimal Agentex API stub for local Muse UI E2E without private Agentex images.

Implements enough of :5003 for:
  POST /agents/register
  POST /agents/name/{name}/rpc  (task/create, event/send)
  GET  /tasks, /tasks/{id}
  GET  /messages?task_id=
  POST /tasks/{id}/terminate
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request

ACP_URL = "http://127.0.0.1:8000"
AGENT_API_KEY = "stub-agent-key"

app = FastAPI(title="Agentex stub")
agents: dict[str, dict[str, Any]] = {}
tasks: dict[str, dict[str, Any]] = {}
messages: dict[str, list[dict[str, Any]]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/health")
async def health():
    return {"ok": True, "stub": True}


@app.post("/agents/register")
async def register(body: dict[str, Any]):
    name = body.get("name") or "swarm-factory"
    agent_id = body.get("agent_id") or str(uuid.uuid4())
    agent = {
        "id": agent_id,
        "name": name,
        "description": body.get("description") or name,
        "acp_url": body.get("acp_url") or f"{ACP_URL}",
        "acp_type": body.get("acp_type") or "agentic",
        "agent_api_key": AGENT_API_KEY,
        "created_at": _now(),
        "updated_at": _now(),
        "status": "Ready",
    }
    agents[name] = agent
    return agent


@app.post("/agents/name/{name}/rpc")
async def rpc(name: str, request: Request):
    payload = await request.json()
    method = payload.get("method")
    params = payload.get("params") or {}
    req_id = payload.get("id", 1)

    agent = agents.get(name) or {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": name,
        "acp_type": "agentic",
        "created_at": _now(),
        "updated_at": _now(),
        "status": "Ready",
        "agent_api_key": AGENT_API_KEY,
        "acp_url": ACP_URL,
    }
    agents.setdefault(name, agent)

    if method == "task/create":
        user_params = params.get("params") or params
        task_id = str(uuid.uuid4())
        task = {
            "id": task_id,
            "name": (user_params.get("query") or user_params.get("prompt") or "task")[:80],
            "params": user_params,
            "status": "RUNNING",
            "created_at": _now(),
            "updated_at": _now(),
        }
        tasks[task_id] = task
        messages[task_id] = []

        acp_body = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "task/create",
            "params": {
                "agent": {
                    "id": agent["id"],
                    "name": agent["name"],
                    "description": agent.get("description", name),
                    "acp_type": agent.get("acp_type", "agentic"),
                    "created_at": agent.get("created_at", _now()),
                    "updated_at": _now(),
                    "status": "Ready",
                },
                "task": task,
                "params": user_params,
            },
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{ACP_URL}/api",
                    json=acp_body,
                    headers={"x-agent-api-key": AGENT_API_KEY},
                )
                if resp.status_code >= 400:
                    task["status"] = "FAILED"
                    task["status_reason"] = resp.text[:500]
        except Exception as exc:  # noqa: BLE001
            task["status"] = "FAILED"
            task["status_reason"] = str(exc)

        return {"jsonrpc": "2.0", "id": req_id, "result": {"task_id": task_id, "id": task_id}}

    if method == "event/send":
        task_id = params.get("task_id")
        if not task_id or task_id not in tasks:
            raise HTTPException(404, "task not found")
        content = params.get("content") or {}
        messages.setdefault(task_id, []).append(
            {
                "id": str(uuid.uuid4()),
                "task_id": task_id,
                "role": "user",
                "content": content.get("content") if isinstance(content, dict) else str(content),
                "created_at": _now(),
            }
        )
        acp_body = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "event/send",
            "params": {
                "agent": {
                    "id": agent["id"],
                    "name": agent["name"],
                    "description": agent.get("description", name),
                    "acp_type": agent.get("acp_type", "agentic"),
                    "created_at": agent.get("created_at", _now()),
                    "updated_at": _now(),
                    "status": "Ready",
                },
                "task": tasks[task_id],
                "event": {
                    "type": "text",
                    "content": content,
                    "author": "user",
                },
            },
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                await client.post(
                    f"{ACP_URL}/api",
                    json=acp_body,
                    headers={"x-agent-api-key": AGENT_API_KEY},
                )
        except Exception:
            pass
        return {"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}}

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {"code": -32601, "message": f"Method {method} not supported in stub"},
    }


@app.get("/tasks")
async def list_tasks():
    return {"tasks": list(tasks.values())}


@app.get("/tasks/{task_id}")
async def get_task(task_id: str):
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(404, "not found")
    return task


@app.get("/messages")
async def get_messages(task_id: str = Query(...)):
    return messages.get(task_id, [])


@app.post("/messages")
async def create_message(body: dict[str, Any]):
    task_id = body.get("task_id")
    if not task_id:
        raise HTTPException(400, "task_id required")
    msg = {
        "id": str(uuid.uuid4()),
        "task_id": task_id,
        "content": body.get("content"),
        "streaming_status": body.get("streaming_status"),
        "created_at": _now(),
        "updated_at": _now(),
        "author": "agent",
        "role": "assistant",
    }
    messages.setdefault(task_id, []).append(msg)
    if task_id in tasks:
        tasks[task_id]["updated_at"] = _now()
        if tasks[task_id].get("status") == "RUNNING":
            pass
        else:
            tasks[task_id]["status"] = "RUNNING"
    return msg


@app.get("/messages/{message_id}")
async def get_message(message_id: str):
    for task_msgs in messages.values():
        for msg in task_msgs:
            if msg.get("id") == message_id:
                return msg
    raise HTTPException(404, "not found")


@app.patch("/messages/{message_id}")
async def patch_message(message_id: str, body: dict[str, Any]):
    for task_msgs in messages.values():
        for msg in task_msgs:
            if msg.get("id") == message_id:
                msg.update(body)
                msg["updated_at"] = _now()
                return msg
    raise HTTPException(404, "not found")


@app.post("/tasks/{task_id}/terminate")
async def terminate(task_id: str):
    if task_id in tasks:
        tasks[task_id]["status"] = "TERMINATED"
        tasks[task_id]["updated_at"] = _now()
    return {"ok": True}


@app.patch("/tasks/{task_id}")
async def patch_task(task_id: str, body: dict[str, Any]):
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(404, "not found")
    task.update(body)
    task["updated_at"] = _now()
    return task



if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5003, log_level="info")
