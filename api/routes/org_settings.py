from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.deps import require_scope
from api.repositories import org_settings as settings_repo
from api.schemas.llm import LlmConfig, VALID_LLM_PROVIDERS

router = APIRouter(prefix="/v1/settings", tags=["Org Settings"])


class BrandingUpdate(BaseModel):
    brand_name: str | None = None
    logo_url: str | None = None
    support_email: str | None = None
    accent_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class LlmSettingsUpdate(BaseModel):
    provider: str | None = Field(default=None, description="anthropic | mistral | openai")
    api_key_secret: str | None = Field(default=None, description="Org secret name for provider API key")
    sonnet_model: str | None = None
    haiku_model: str | None = None
    openai_base_url: str | None = None


class OrgSettingsUpdate(BrandingUpdate, LlmSettingsUpdate):
    pass


@router.get("")
async def get_org_settings(key: dict = Depends(require_scope("admin"))):
    """Org settings including white-label branding and default LLM provider."""
    return {"settings": await settings_repo.get_settings(key["org_id"])}


@router.patch("")
async def update_org_settings(
    body: OrgSettingsUpdate,
    key: dict = Depends(require_scope("admin")),
):
    payload = body.model_dump(exclude_none=True)
    if payload.get("provider") and payload["provider"] not in VALID_LLM_PROVIDERS:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=f"invalid provider: {payload['provider']}")

    llm_keys = {"provider", "api_key_secret", "sonnet_model", "haiku_model", "openai_base_url"}
    kwargs = {}
    for k, v in payload.items():
        if k in llm_keys:
            kwargs[f"llm_{k}"] = v
        else:
            kwargs[k] = v

    settings = await settings_repo.update_settings(key["org_id"], **kwargs)
    return {"settings": settings}
