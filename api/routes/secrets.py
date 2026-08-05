from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.deps import client_ip, require_any_scope, require_scope
from api.repositories import audit as audit_repo
from api.repositories import secrets as secrets_repo

router = APIRouter(prefix="/v1/secrets", tags=["Secrets"])


class UpsertSecretRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$")
    value: str = Field(..., min_length=1)


@router.post("", status_code=201)
async def upsert_secret(
    body: UpsertSecretRequest,
    request: Request,
    key: dict = Depends(require_scope("secrets:write")),
):
    try:
        record = await secrets_repo.upsert_secret(
            org_id=key["org_id"],
            name=body.name,
            value=body.value,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action="secret.upserted",
        resource_type="secret",
        resource_id=body.name,
        ip_address=client_ip(request),
    )
    return {"secret": record}


@router.get("")
async def list_secrets(key: dict = Depends(require_any_scope("secrets:read", "secrets:write"))):
    secrets = await secrets_repo.list_secrets(org_id=key["org_id"])
    return {"secrets": secrets}


@router.delete("/{name}", status_code=204)
async def delete_secret(name: str, key: dict = Depends(require_scope("secrets:write"))):
    if not await secrets_repo.delete_secret(org_id=key["org_id"], name=name):
        raise HTTPException(status_code=404, detail="secret not found")
    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action="secret.deleted",
        resource_type="secret",
        resource_id=name,
    )
