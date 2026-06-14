"""Mistral backend for the planner."""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from project.planner_types import PlannerError

_LLM_SEMAPHORE = asyncio.Semaphore(4)


def is_mistral_model(model: str) -> bool:
    return model.startswith(("mistral-", "open-mistral-", "open-mixtral-", "codestral-"))


def _to_mistral_tools(tools: list[dict]) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
            },
        }
        for t in tools
    ]


def _anthropic_context_to_mistral(messages: list[dict], system_prompt: str) -> list[dict]:
    api_messages: list[dict] = [{"role": "system", "content": system_prompt}]

    for msg in messages:
        role = msg["role"]
        content = msg["content"]

        if isinstance(content, str):
            api_messages.append({"role": role, "content": content})
            continue

        if not isinstance(content, list):
            continue

        text_parts: list[str] = []
        tool_calls: list[dict] = []
        tool_results: list[dict] = []

        for block in content:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "text":
                text_parts.append(block.get("text", ""))
            elif btype == "tool_use":
                tool_calls.append({
                    "id": block["id"],
                    "type": "function",
                    "function": {
                        "name": block["name"],
                        "arguments": json.dumps(block.get("input", {})),
                    },
                })
            elif btype == "tool_result":
                tool_results.append({
                    "role": "tool",
                    "tool_call_id": block["tool_use_id"],
                    "content": str(block.get("content", "")),
                })

        if tool_results:
            api_messages.extend(tool_results)
        elif tool_calls:
            api_messages.append({
                "role": "assistant",
                "content": " ".join(text_parts) if text_parts else None,
                "tool_calls": tool_calls,
            })
        elif text_parts:
            api_messages.append({"role": role, "content": " ".join(text_parts)})

    return api_messages


def _parse_response_data(choices: list, usage_data: Any) -> tuple[str, list[dict], dict]:
    choice = choices[0]
    finish_reason = getattr(choice, "finish_reason", None) or choice.get("finish_reason", "stop")
    msg = getattr(choice, "message", None) or choice.get("message", {})

    blocks: list[dict] = []
    msg_content = getattr(msg, "content", None) or (msg.get("content") if isinstance(msg, dict) else None)
    if msg_content:
        blocks.append({"type": "text", "text": msg_content})

    tool_calls = getattr(msg, "tool_calls", None) or (msg.get("tool_calls") if isinstance(msg, dict) else None) or []
    for tc in tool_calls:
        fn = getattr(tc, "function", None) or (tc.get("function") if isinstance(tc, dict) else {})
        tc_id = getattr(tc, "id", None) or (tc.get("id") if isinstance(tc, dict) else "")
        fn_name = getattr(fn, "name", None) or (fn.get("name") if isinstance(fn, dict) else "")
        fn_args = getattr(fn, "arguments", None) or (fn.get("arguments") if isinstance(fn, dict) else "{}")
        try:
            args = json.loads(fn_args) if isinstance(fn_args, str) else fn_args
        except (json.JSONDecodeError, TypeError):
            args = {}
        blocks.append({"type": "tool_use", "id": tc_id, "name": fn_name, "input": args})

    stop = "tool_use" if (
        finish_reason == "tool_calls"
        or any(b["type"] == "tool_use" for b in blocks)
    ) else "end_turn"

    if isinstance(usage_data, dict):
        usage = {
            "input_tokens": usage_data.get("prompt_tokens", 0),
            "output_tokens": usage_data.get("completion_tokens", 0),
        }
    else:
        usage = {
            "input_tokens": getattr(usage_data, "prompt_tokens", 0),
            "output_tokens": getattr(usage_data, "completion_tokens", 0),
        }
    return stop, blocks, usage


async def make_mistral_request(
    messages: list[dict],
    tools: list[dict] | None,
    system_prompt: str,
    model: str,
) -> tuple[str, list[dict], dict]:
    """
    Call Mistral API. Returns (stop_reason, content_blocks, usage_dict).
    Uses mistralai SDK if installed, falls back to httpx for raw REST.
    stop_reason: "end_turn" | "tool_use"
    """
    mistral_key = os.environ.get("MISTRAL_API_KEY", "")
    if not mistral_key:
        raise PlannerError("MISTRAL_API_KEY not set in environment.")

    api_messages = _anthropic_context_to_mistral(messages, system_prompt)

    try:
        from mistralai import Mistral  # type: ignore
        client = Mistral(api_key=mistral_key)
        call_kwargs: dict[str, Any] = {
            "model": model,
            "messages": api_messages,
            "max_tokens": 8192,
        }
        if tools:
            call_kwargs["tools"] = _to_mistral_tools(tools)
            call_kwargs["tool_choice"] = "auto"

        async with _LLM_SEMAPHORE:
            response = await client.chat.complete_async(**call_kwargs)

        return _parse_response_data(response.choices, response.usage)

    except ImportError:
        pass

    try:
        import httpx
    except ImportError:
        raise PlannerError("Neither mistralai nor httpx is installed. Run: uv add mistralai")

    payload: dict[str, Any] = {
        "model": model,
        "messages": api_messages,
        "max_tokens": 8192,
    }
    if tools:
        payload["tools"] = _to_mistral_tools(tools)
        payload["tool_choice"] = "auto"

    async with _LLM_SEMAPHORE:
        async with httpx.AsyncClient(timeout=120) as http:
            resp = await http.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {mistral_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if resp.status_code != 200:
            raise PlannerError(f"Mistral API error {resp.status_code}: {resp.text[:300]}")
        data = resp.json()

    return _parse_response_data(data["choices"], data.get("usage", {}))
