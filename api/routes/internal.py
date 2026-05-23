"""Internal endpoints — called by Next.js server-side routes, not public callers.

Next.js runs on Vercel and cannot reach Temporal's gRPC port directly.
These endpoints act as a proxy: Next.js → Gantry API → Temporal.
Authenticated by INTERNAL_API_KEY (shared secret, never exposed to browsers).
"""
import os

from fastapi import APIRouter, Header, HTTPException

from api import temporal_client

router = APIRouter(prefix="/internal", tags=["Internal"])

_INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "")


def _check(key: str | None) -> None:
    if not _INTERNAL_KEY:
        return  # not configured — allow (dev mode)
    if key != _INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal key")


@router.post("/signal")
async def proxy_signal(
    body: dict,
    x_internal_key: str | None = Header(default=None),
):
    """Proxy a Temporal workflow signal from Next.js."""
    _check(x_internal_key)

    workflow_id = body.get("workflow_id")
    signal_name = body.get("signal", "approve")
    payload = body.get("payload")

    if payload is None:
        payload = body.get("approved")
    if not workflow_id:
        raise HTTPException(status_code=400, detail="workflow_id required")

    try:
        await temporal_client.signal_workflow(workflow_id, signal_name, payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"ok": True}
