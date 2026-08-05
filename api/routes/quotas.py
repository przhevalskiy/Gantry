from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.deps import require_scope
from api.repositories import audit as audit_repo
from api.repositories import quotas as quotas_repo

router = APIRouter(prefix="/v1/quotas", tags=["Quotas"])


class QuotaResponse(BaseModel):
    org_id: str
    max_concurrent_tasks: int
    max_tasks_per_day: int
    max_bulk_size: int
    requests_per_minute: int


class UpdateQuotasRequest(BaseModel):
    max_concurrent_tasks: int | None = Field(default=None, ge=1, le=1000)
    max_tasks_per_day: int | None = Field(default=None, ge=1, le=100000)
    max_bulk_size: int | None = Field(default=None, ge=1, le=500)
    requests_per_minute: int | None = Field(default=None, ge=10, le=10000)


@router.get("")
async def get_org_quotas(key: dict = Depends(require_scope("admin"))):
    q = await quotas_repo.get_quotas(key["org_id"])
    usage = {
        "concurrent_tasks": await quotas_repo.count_concurrent_tasks(key["org_id"]),
        "tasks_today": await quotas_repo.count_tasks_today(key["org_id"]),
    }
    return {
        "quotas": QuotaResponse(
            org_id=q.org_id,
            max_concurrent_tasks=q.max_concurrent_tasks,
            max_tasks_per_day=q.max_tasks_per_day,
            max_bulk_size=q.max_bulk_size,
            requests_per_minute=q.requests_per_minute,
        ),
        "usage": usage,
    }


@router.patch("")
async def update_org_quotas(
    body: UpdateQuotasRequest,
    key: dict = Depends(require_scope("admin")),
):
    updated = await quotas_repo.update_quotas(
        key["org_id"],
        **body.model_dump(exclude_none=True),
    )
    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action="quota.updated",
        resource_type="org",
        resource_id=key["org_id"],
        metadata=body.model_dump(exclude_none=True),
    )
    return {
        "quotas": QuotaResponse(
            org_id=updated.org_id,
            max_concurrent_tasks=updated.max_concurrent_tasks,
            max_tasks_per_day=updated.max_tasks_per_day,
            max_bulk_size=updated.max_bulk_size,
            requests_per_minute=updated.requests_per_minute,
        )
    }
