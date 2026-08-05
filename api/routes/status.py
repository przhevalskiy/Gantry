"""Platform status — public health surface."""
from __future__ import annotations

import httpx
import structlog
from fastapi import APIRouter

from api import db
from api.config import AGENTEX_BASE_URL, TEMPORAL_ADDRESS

log = structlog.get_logger(__name__)
router = APIRouter(tags=["Status"])


async def _probe(url: str, path: str = "") -> bool:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{url.rstrip('/')}{path}")
            return resp.status_code < 500
    except Exception:
        return False


@router.get("/status")
async def platform_status():
    """Public status page — dependency health + active task count."""
    db_ok = db.is_available()
    agentex_ok = await _probe(AGENTEX_BASE_URL)

    active_tasks = 0
    if db_ok:
        row = await db.fetch_one(
            """
            SELECT COUNT(*) AS count FROM api_tasks
            WHERE webhook_fired = false
              AND (status IS NULL OR status NOT IN ('completed','failed','cancelled','terminated','timeout'))
            """
        )
        active_tasks = int(row["count"]) if row else 0

    components = {
        "database": "ok" if db_ok else "unavailable",
        "agentex": "ok" if agentex_ok else "unreachable",
        "temporal": "configured" if TEMPORAL_ADDRESS else "unconfigured",
    }
    overall = "ok" if agentex_ok else "degraded"
    if not db_ok:
        overall = "degraded"

    return {
        "status": overall,
        "version": "0.3.0",
        "components": components,
        "metrics": {"active_tasks": active_tasks},
    }
