from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.auth import generate_api_key
from api.deps import require_api_key
from api.store import keys as key_store

router = APIRouter(prefix="/v1/keys", tags=["API Keys"])


class CreateKeyRequest(BaseModel):
    name: str


class KeyResponse(BaseModel):
    id: str
    name: str
    created_at: str
    last_used_at: str | None
    active: bool


@router.post("", status_code=status.HTTP_201_CREATED)
def create_key(body: CreateKeyRequest):
    """Create a new API key. The plaintext key is returned once — store it securely."""
    plaintext = generate_api_key()
    record = key_store.create_key(body.name, plaintext)
    return {
        "id": record["id"],
        "name": record["name"],
        "key": plaintext,  # shown once only
        "created_at": record["created_at"],
    }


@router.get("")
def list_keys(_key: dict = Depends(require_api_key)):
    keys = key_store.list_keys()
    return {
        "keys": [
            KeyResponse(
                id=k["id"],
                name=k["name"],
                created_at=k["created_at"],
                last_used_at=k.get("last_used_at"),
                active=k.get("active", True),
            )
            for k in keys
        ]
    }


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_key(key_id: str, _key: dict = Depends(require_api_key)):
    if not key_store.revoke_key(key_id):
        raise HTTPException(status_code=404, detail="key not found")
