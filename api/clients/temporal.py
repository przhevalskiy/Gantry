"""Temporal client helper for direct workflow operations from the Gantry API."""
from temporalio.client import Client

from api.config import TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE

_client: Client | None = None


async def get_client() -> Client:
    global _client
    if _client is None:
        _client = await Client.connect(TEMPORAL_ADDRESS, namespace=TEMPORAL_NAMESPACE)
    return _client


async def signal_workflow(workflow_id: str, signal_name: str, payload) -> None:
    client = await get_client()
    handle = client.get_workflow_handle(workflow_id)
    await handle.signal(signal_name, payload)
