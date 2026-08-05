from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import generate_api_key
from api.deps import VALID_SCOPES, require_admin_key, require_scope
from api.repositories import audit as audit_repo
from api.repositories import keys as keys_repo
from api.repositories.organizations import ensure_default_org

router = APIRouter(prefix="/v1/keys", tags=["API Keys"])


class CreateKeyRequest(BaseModel):
    name: str
    scopes: list[str] = Field(default_factory=lambda: ["admin"])


class KeyResponse(BaseModel):
    id: str
    org_id: str
    name: str
    created_at: str
    last_used_at: str | None
    active: bool
    scopes: list[str]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_key(
    body: CreateKeyRequest,
    admin: dict | None = Depends(require_admin_key),
):
    """Create a new API key. Plaintext shown once — store securely."""
    invalid = set(body.scopes) - VALID_SCOPES
    if invalid:
        raise HTTPException(status_code=422, detail=f"invalid scopes: {sorted(invalid)}")

    org_id = admin["org_id"] if admin else await ensure_default_org()
    plaintext = generate_api_key()
    record, _ = await keys_repo.create_key(
        body.name, plaintext, org_id=org_id, scopes=body.scopes
    )
    if admin:
        await audit_repo.record(
            org_id=org_id,
            key_id=admin["id"],
            action="key.created",
            resource_type="api_key",
            resource_id=record["id"],
            metadata={"name": body.name, "scopes": body.scopes},
        )
    return {
        "id": record["id"],
        "org_id": record["org_id"],
        "name": record["name"],
        "key": plaintext,
        "scopes": record.get("scopes", ["admin"]),
        "created_at": record["created_at"],
    }


@router.get("")
async def list_keys(key: dict = Depends(require_scope("admin"))):
    keys = await keys_repo.list_keys(org_id=key["org_id"])
    return {
        "keys": [
            KeyResponse(
                id=k["id"],
                org_id=k["org_id"],
                name=k["name"],
                created_at=k["created_at"],
                last_used_at=k.get("last_used_at"),
                active=k.get("active", True),
                scopes=k.get("scopes", ["admin"]),
            )
            for k in keys
        ]
    }


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_key(key_id: str, key: dict = Depends(require_scope("admin"))):
    if not await keys_repo.revoke_key(key_id, org_id=key["org_id"]):
        raise HTTPException(status_code=404, detail="key not found")
    await audit_repo.record(
        org_id=key["org_id"],
        key_id=key["id"],
        action="key.revoked",
        resource_type="api_key",
        resource_id=key_id,
    )
