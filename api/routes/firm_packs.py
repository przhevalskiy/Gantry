"""Firm packs — catalog, install, enable/disable, per-pack quotas (Phase E)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.deps import require_any_scope, require_scope
from api.repositories import firm_packs as packs_repo
from schemas.firm_packs import parse_pack_ref

router = APIRouter(prefix="/v1/packs", tags=["Firm packs"])


class InstallPackRequest(BaseModel):
    version: str | None = None
    max_tasks_per_day: int | None = Field(default=None, ge=1, le=10_000)


class UpdatePackRequest(BaseModel):
    enabled: bool | None = None
    max_tasks_per_day: int | None = Field(default=None, ge=1, le=10_000)


@router.get("")
async def list_packs(
    key: dict = Depends(
        require_any_scope("projects:read", "projects:write", "tasks:read", "tasks:write")
    ),
):
    rows = await packs_repo.list_org_packs(org_id=key["org_id"])
    return {
        "packs": rows,
        "product": {
            "model": "one_factory",
            "summary": (
                "Firm packs are versioned role sets + default playbooks installed "
                "into one Gantry factory. They are not separately deployable chat bots."
            ),
        },
    }


@router.get("/{pack_ref}")
async def get_pack(
    pack_ref: str,
    key: dict = Depends(
        require_any_scope("projects:read", "projects:write", "tasks:read", "tasks:write")
    ),
):
    try:
        pack_id, _version = parse_pack_ref(pack_ref)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    row = await packs_repo.get_org_pack(org_id=key["org_id"], pack_id=pack_id)
    if not row:
        raise HTTPException(status_code=404, detail="firm pack not found")
    return {"pack": row}


@router.post("/{pack_ref}/install", status_code=201)
async def install_pack(
    pack_ref: str,
    body: InstallPackRequest | None = None,
    key: dict = Depends(require_scope("projects:write")),
):
    body = body or InstallPackRequest()
    try:
        pack_id, version = parse_pack_ref(pack_ref)
        if body.version:
            version = body.version
        row = await packs_repo.install_pack(
            org_id=key["org_id"],
            pack_id=pack_id,
            version=version,
            max_tasks_per_day=body.max_tasks_per_day,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"pack": row}


@router.patch("/{pack_ref}")
async def update_pack(
    pack_ref: str,
    body: UpdatePackRequest,
    key: dict = Depends(require_scope("projects:write")),
):
    try:
        pack_id, _version = parse_pack_ref(pack_ref)
        row = await packs_repo.update_pack(
            org_id=key["org_id"],
            pack_id=pack_id,
            enabled=body.enabled,
            max_tasks_per_day=body.max_tasks_per_day,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"pack": row}


@router.delete("/{pack_ref}", status_code=204)
async def uninstall_pack(
    pack_ref: str,
    key: dict = Depends(require_scope("projects:write")),
):
    try:
        pack_id, _version = parse_pack_ref(pack_ref)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    ok = await packs_repo.uninstall_pack(org_id=key["org_id"], pack_id=pack_id)
    if not ok and pack_id not in ("swe-factory", "migration-runner"):
        raise HTTPException(status_code=404, detail="firm pack not found")
    return None
