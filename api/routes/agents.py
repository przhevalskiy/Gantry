"""Agentex crew catalog — public to API keys, not tenant data."""
from fastapi import APIRouter, Depends, HTTPException

from api.config import AGENTEX_BASE_URL, AGENT_NAME
from api.deps import require_scope
from project.schema.crew import (
    FOREMAN_ACP_NAME,
    catalog_payload,
    get_agent,
)

router = APIRouter(prefix="/v1/agents", tags=["Agents"])


def _catalog():
    """C1: advertised ACP name is always swarm-factory, even if AGENT_NAME is set."""
    payload = catalog_payload(agentex_base_url=AGENTEX_BASE_URL)
    payload["acp_agent"] = FOREMAN_ACP_NAME
    payload["acp"]["url"] = (
        f"{AGENTEX_BASE_URL.rstrip('/')}/agents/name/{FOREMAN_ACP_NAME}/rpc"
    )
    if AGENT_NAME and AGENT_NAME != FOREMAN_ACP_NAME:
        payload["runtime_agent_name"] = AGENT_NAME
    return payload


@router.get("")
async def list_agents(key: dict = Depends(require_scope("tasks:read"))):
    """Named crew on the Agentex track. Foreman is the only ACP task/create target."""
    return _catalog()


@router.get("/{name}")
async def get_agent_by_name(
    name: str,
    key: dict = Depends(require_scope("tasks:read")),
):
    agent = get_agent(name)
    if not agent:
        raise HTTPException(status_code=404, detail="agent not found")
    return {
        "agent": agent,
        "acp_agent": FOREMAN_ACP_NAME,
        "invoke": (
            "ACP task/create on swarm-factory"
            if agent["entrypoint"] == "acp"
            else "Temporal child workflow composed by Foreman — not independently ACP-invoked"
        ),
    }
