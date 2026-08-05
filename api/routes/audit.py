from fastapi import APIRouter, Depends, Query

from api.deps import require_scope
from api.repositories import audit as audit_repo

router = APIRouter(prefix="/v1/audit", tags=["Audit"])


@router.get("")
async def get_audit_log(
    key: dict = Depends(require_scope("admin")),
    limit: int = Query(default=100, ge=1, le=500),
    action: str | None = Query(default=None),
    key_id: str | None = Query(default=None),
):
    """Immutable audit trail for the org — key actions, task submissions, config changes."""
    entries = await audit_repo.list_entries(
        org_id=key["org_id"],
        limit=limit,
        action=action,
        key_id=key_id,
    )
    return {"org_id": key["org_id"], "entries": entries, "count": len(entries)}
