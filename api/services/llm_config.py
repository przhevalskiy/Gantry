"""Resolve org + task LLM settings into Agentex task params (BYOK)."""
from __future__ import annotations

from fastapi import HTTPException

from api.repositories import org_settings as settings_repo
from api.repositories import secrets as secrets_repo
from api.schemas.llm import LlmConfig, VALID_LLM_PROVIDERS

_DEFAULT_MODELS = {
    "anthropic": {
        "sonnet": "claude-sonnet-4-6",
        "haiku": "claude-haiku-4-5-20251001",
    },
    "mistral": {
        "sonnet": "mistral-large-latest",
        "haiku": "mistral-small-latest",
    },
    "openai": {
        "sonnet": "gpt-4o",
        "haiku": "gpt-4o-mini",
    },
}


async def get_org_llm_defaults(org_id: str) -> dict:
    settings = await settings_repo.get_settings(org_id)
    return {
        "provider": settings.get("llm_provider") or "anthropic",
        "api_key_secret": settings.get("llm_api_key_secret"),
        "sonnet_model": settings.get("llm_sonnet_model"),
        "haiku_model": settings.get("llm_haiku_model"),
        "openai_base_url": settings.get("llm_openai_base_url"),
    }


def _merge_llm(org: dict, task: LlmConfig | None) -> dict:
    merged = dict(org)
    if not task:
        return merged
    task.validate_provider()
    if task.provider is not None:
        merged["provider"] = task.provider
    if task.api_key_secret is not None:
        merged["api_key_secret"] = task.api_key_secret
    if task.api_key is not None:
        merged["api_key"] = task.api_key
    if task.sonnet_model is not None:
        merged["sonnet_model"] = task.sonnet_model
    if task.haiku_model is not None:
        merged["haiku_model"] = task.haiku_model
    if task.openai_base_url is not None:
        merged["openai_base_url"] = task.openai_base_url
    return merged


async def resolve_llm_agentex_params(org_id: str, task_llm: LlmConfig | None = None) -> dict:
    """
    Resolve LLM BYOK into task params passed to the worker.
    Customer's API key is never stored in task metadata — only forwarded to Agentex params.
    """
    org = await get_org_llm_defaults(org_id)
    merged = _merge_llm(org, task_llm)
    provider = merged.get("provider") or "anthropic"
    if provider not in VALID_LLM_PROVIDERS:
        raise HTTPException(status_code=422, detail=f"invalid llm provider: {provider}")

    api_key = merged.get("api_key")
    if not api_key and merged.get("api_key_secret"):
        api_key = await secrets_repo.get_secret_value(org_id=org_id, name=merged["api_key_secret"])
        if not api_key:
            raise HTTPException(
                status_code=404,
                detail=f"LLM secret not found: {merged['api_key_secret']}",
            )

    if not api_key:
        return {}

    defaults = _DEFAULT_MODELS[provider]
    sonnet = merged.get("sonnet_model") or defaults["sonnet"]
    haiku = merged.get("haiku_model") or defaults["haiku"]

    params: dict = {
        "llm_provider": provider,
        "llm_sonnet_model": sonnet,
        "llm_haiku_model": haiku,
    }

    if provider == "anthropic":
        params["llm_anthropic_api_key"] = api_key
    elif provider == "mistral":
        params["llm_mistral_api_key"] = api_key
    elif provider == "openai":
        params["llm_openai_api_key"] = api_key
        params["llm_openai_base_url"] = merged.get("openai_base_url") or "https://api.openai.com/v1"

    return params
