"""Async httpx wrapper around the Agentex API."""
from typing import Any

import httpx

from api.config import AGENTEX_BASE_URL, AGENT_NAME


async def submit_task(
    goal: str,
    project_id: str = "",
    branch_prefix: str = "swarm",
    tier: int = -1,
    github_token: str = "",
    extra_params: dict | None = None,
) -> str:
    """Submit a task to Agentex and return the task_id."""
    params: dict[str, Any] = {
        "query": goal,
        "prompt": goal,
        "content": goal,
        "project_id": project_id,
        "branch_prefix": branch_prefix,
        **(extra_params or {}),
    }
    if tier >= 0:
        params["tier"] = tier
    if github_token:
        params["github_token"] = github_token

    payload = {
        "jsonrpc": "2.0",
        "method": "task/create",
        "params": {"params": params},
    }

    async with httpx.AsyncClient(base_url=AGENTEX_BASE_URL, timeout=30) as client:
        resp = await client.post(f"/agents/name/{AGENT_NAME}/rpc", json=payload)
        resp.raise_for_status()
        data = resp.json()

    if data.get("error"):
        raise RuntimeError(data["error"].get("message", "Agentex RPC error"))

    result = data.get("result", {})
    task_id = result.get("task_id") or result.get("id") or result.get("task", {}).get("id")
    if not task_id:
        raise RuntimeError(f"No task_id in Agentex response: {result}")
    return task_id


async def get_task(task_id: str) -> dict:
    async with httpx.AsyncClient(base_url=AGENTEX_BASE_URL, timeout=15) as client:
        resp = await client.get(f"/tasks/{task_id}")
        resp.raise_for_status()
        return resp.json()


async def list_tasks() -> list[dict]:
    async with httpx.AsyncClient(base_url=AGENTEX_BASE_URL, timeout=15) as client:
        resp = await client.get("/tasks")
        resp.raise_for_status()
        data = resp.json()
    if isinstance(data, list):
        return data
    return data.get("tasks", [])


async def get_messages(task_id: str) -> list[dict]:
    async with httpx.AsyncClient(base_url=AGENTEX_BASE_URL, timeout=15) as client:
        resp = await client.get("/messages", params={"task_id": task_id})
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else data.get("messages", [])


async def terminate_task(task_id: str) -> None:
    async with httpx.AsyncClient(base_url=AGENTEX_BASE_URL, timeout=15) as client:
        resp = await client.post(f"/tasks/{task_id}/terminate", json={"reason": "terminated via API"})
        resp.raise_for_status()


async def send_followup(task_id: str, prompt: str) -> dict:
    """Send a user follow-up prompt to a running swarm task via Agentex event/send."""
    payload = {
        "jsonrpc": "2.0",
        "method": "event/send",
        "params": {
            "task_id": task_id,
            "content": {
                "type": "text",
                "content": prompt,
                "author": "user",
            },
        },
    }

    async with httpx.AsyncClient(base_url=AGENTEX_BASE_URL, timeout=30) as client:
        resp = await client.post(f"/agents/name/{AGENT_NAME}/rpc", json=payload)
        resp.raise_for_status()
        data = resp.json()

    if data.get("error"):
        raise RuntimeError(data["error"].get("message", "Agentex RPC error"))

    return data.get("result", {})
