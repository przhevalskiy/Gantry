"""OpenAI-compatible backend (OpenAI, Azure, Ollama, vLLM, Together, etc.)."""
from __future__ import annotations

from typing import Any

import httpx

from project.backends.mistral import _anthropic_context_to_mistral, _parse_response_data, _to_mistral_tools
from project.planner_types import PlannerError

_LLM_SEMAPHORE = __import__("asyncio").Semaphore(4)


def is_openai_model(model: str) -> bool:
    return model.startswith(("gpt-", "o1", "o3", "chatgpt-"))


def is_openai_compatible(model: str, credentials: dict | None) -> bool:
    creds = credentials or {}
    if is_openai_model(model):
        return True
    if creds.get("provider") == "openai":
        return True
    if creds.get("openai_api_key") and creds.get("openai_base_url"):
        return True
    return False


async def make_openai_request(
    messages: list[dict],
    tools: list[dict] | None,
    system_prompt: str,
    model: str,
    *,
    api_key: str,
    base_url: str,
) -> tuple[str, list[dict], dict]:
    if not api_key:
        raise PlannerError("OpenAI-compatible API key not configured for this task.")

    api_messages = _anthropic_context_to_mistral(messages, system_prompt)
    payload: dict[str, Any] = {
        "model": model,
        "messages": api_messages,
        "max_tokens": 8192,
    }
    if tools:
        payload["tools"] = _to_mistral_tools(tools)
        payload["tool_choice"] = "auto"

    url = base_url.rstrip("/") + "/chat/completions"
    async with _LLM_SEMAPHORE:
        async with httpx.AsyncClient(timeout=120) as http:
            resp = await http.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if resp.status_code != 200:
            raise PlannerError(f"OpenAI-compatible API error {resp.status_code}: {resp.text[:300]}")
        data = resp.json()

    return _parse_response_data(data["choices"], data.get("usage", {}))
