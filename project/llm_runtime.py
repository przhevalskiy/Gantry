"""LLM credential helpers — per-task BYOK with worker env fallback."""
from __future__ import annotations

import os

from project.config import ANTHROPIC_API_KEY, CLAUDE_HAIKU_MODEL, CLAUDE_SONNET_MODEL, MISTRAL_API_KEY


def extract_agentex_llm_params(task_params: dict | None) -> dict:
    """Build worker credential dict from Agentex task params."""
    if not task_params:
        return {}
    creds: dict = {}
    mapping = {
        "llm_anthropic_api_key": "anthropic_api_key",
        "llm_mistral_api_key": "mistral_api_key",
        "llm_openai_api_key": "openai_api_key",
        "llm_openai_base_url": "openai_base_url",
        "llm_sonnet_model": "sonnet_model",
        "llm_haiku_model": "haiku_model",
        "llm_provider": "provider",
    }
    for src, dst in mapping.items():
        value = task_params.get(src)
        if value:
            creds[dst] = value
    return creds


def sonnet_model(credentials: dict | None) -> str:
    creds = credentials or {}
    return creds.get("sonnet_model") or CLAUDE_SONNET_MODEL


def haiku_model(credentials: dict | None) -> str:
    creds = credentials or {}
    return creds.get("haiku_model") or CLAUDE_HAIKU_MODEL


def model_for_tier(tier: int, credentials: dict | None) -> str:
    return haiku_model(credentials) if tier <= 1 else sonnet_model(credentials)


def anthropic_api_key(credentials: dict | None) -> str:
    creds = credentials or {}
    return creds.get("anthropic_api_key") or ANTHROPIC_API_KEY or os.getenv("ANTHROPIC_API_KEY", "")


def mistral_api_key(credentials: dict | None) -> str:
    creds = credentials or {}
    return creds.get("mistral_api_key") or MISTRAL_API_KEY or os.getenv("MISTRAL_API_KEY", "")


def openai_api_key(credentials: dict | None) -> str:
    creds = credentials or {}
    return creds.get("openai_api_key") or os.getenv("OPENAI_API_KEY", "")


def openai_base_url(credentials: dict | None) -> str:
    creds = credentials or {}
    return creds.get("openai_base_url") or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
