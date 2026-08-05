from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.deps import require_scope
from api.repositories import org_settings as settings_repo

router = APIRouter(prefix="/v1/settings", tags=["Org Settings"])


class BrandingUpdate(BaseModel):
    brand_name: str | None = None
    logo_url: str | None = None
    support_email: str | None = None
    accent_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


@router.get("")
async def get_org_settings(key: dict = Depends(require_scope("admin"))):
    """White-label branding for embedded portal integrations."""
    return {"settings": await settings_repo.get_settings(key["org_id"])}


@router.patch("")
async def update_org_settings(
    body: BrandingUpdate,
    key: dict = Depends(require_scope("admin")),
):
    settings = await settings_repo.update_settings(
        key["org_id"],
        **body.model_dump(exclude_none=True),
    )
    return {"settings": settings}
