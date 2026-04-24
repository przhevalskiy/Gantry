"""LLM planning layer — multi-provider tool-use loop for swarm agents.

Supported providers:
  - Anthropic Claude  (model names starting with "claude-")
  - Mistral           (model names starting with "mistral-", "open-mistral-", etc.)

The provider is selected automatically from the model name passed to next_step().
Tool schemas use standard JSON Schema (input_schema), which both providers accept.
"""
from __future__ import annotations

import asyncio
import json
import os
import structlog
from dataclasses import dataclass
from typing import Any

import anthropic

from project.config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from project.rate_limit_config import (
    get_rate_config, get_rate_tracker, log_rate_limit_warning,
    log_rate_limit_hit, log_rate_limit_recovery
)

logger = structlog.get_logger(__name__)

_DEFAULT_SYSTEM = (
    "You are a specialist agent in a durable software engineering swarm. "
    "Use the tools available to complete your assigned task. "
    "Call exactly ONE tool per response."
)


@dataclass
class PlannerStep:
    tool_name: str
    tool_use_id: str
    tool_input: dict[str, Any]


@dataclass
class FinalAnswer:
    answer: str


class PlannerError(Exception):
    """Raised when the planner cannot complete a step."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


PlannerResult = PlannerStep | FinalAnswer | PlannerError

# Global semaphore — cap concurrent LLM calls across all activities in this worker
_LLM_SEMAPHORE = asyncio.Semaphore(4)

# Last token usage — written by next_step(), read by planner activities for trace emission
_last_usage: dict[str, int] = {"input_tokens": 0, "output_tokens": 0}


def get_last_usage() -> dict[str, int]:
    """Return the token usage from the most recent next_step() call."""
    return dict(_last_usage)


def _extract_task_prompt(params: dict | None) -> str:
    if not params:
        return "No task prompt provided."
    return (
        params.get("prompt")
        or params.get("content")
        or params.get("query")
        or str(params)
    )


_PROMPT_CACHE_BETA = "prompt-caching-2024-07-31"
_TOOL_RESULT_MAX_CHARS = 800
_SUMMARIZE_AFTER_TURNS = 6
_KEEP_RECENT_TURNS = 3


# ── Tool result truncation ────────────────────────────────────────────────────

def _truncate_text(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n[truncated]"


def _cap_tool_result(block: dict[str, Any]) -> dict[str, Any]:
    if block.get("type") != "tool_result":
        return block
    content = block.get("content", "")
    if isinstance(content, str):
        return {**block, "content": _truncate_text(content, _TOOL_RESULT_MAX_CHARS)}
    if isinstance(content, list):
        capped = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                capped.append({**item, "text": _truncate_text(item["text"], _TOOL_RESULT_MAX_CHARS)})
            else:
                capped.append(item)
        return {**block, "content": capped}
    return block


def _cap_all_tool_results(context: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for msg in context:
        if msg.get("role") != "user" or not isinstance(msg.get("content"), list):
            result.append(msg)
            continue
        result.append({**msg, "content": [
            _cap_tool_result(b) if isinstance(b, dict) else b
            for b in msg["content"]
        ]})
    return result


# ── Consume already-processed read_file results ───────────────────────────────

def _consume_read_results(context: list[dict[str, Any]], keep_last: int = 1) -> list[dict[str, Any]]:
    read_ids: list[str] = []
    for msg in context:
        if msg.get("role") != "assistant":
            continue
        for block in (msg.get("content") or []):
            if isinstance(block, dict) and block.get("type") == "tool_use" and block.get("name") == "read_file":
                read_ids.append(block["id"])

    consume = set(read_ids[:-keep_last] if keep_last > 0 else read_ids)
    if not consume:
        return context

    result = []
    for msg in context:
        if msg.get("role") != "user" or not isinstance(msg.get("content"), list):
            result.append(msg)
            continue
        new_blocks = []
        for block in msg["content"]:
            if isinstance(block, dict) and block.get("type") == "tool_result" and block.get("tool_use_id") in consume:
                new_blocks.append({
                    "type": "tool_result",
                    "tool_use_id": block["tool_use_id"],
                    "content": "[file content consumed]",
                })
            else:
                new_blocks.append(block)
        result.append({**msg, "content": new_blocks})
    return result


# ── Periodic summarization ────────────────────────────────────────────────────

def _extract_tool_actions(context: list[dict[str, Any]]) -> dict[str, list[str]]:
    written: list[str] = []
    read: list[str] = []
    run: list[str] = []
    for msg in context:
        if msg.get("role") != "assistant":
            continue
        for block in (msg.get("content") or []):
            if not isinstance(block, dict) or block.get("type") != "tool_use":
                continue
            name = block.get("name", "")
            path = block.get("input", {}).get("path") or block.get("input", {}).get("command", "")
            if name in ("write_file", "patch_file"):
                written.append(path)
            elif name == "read_file":
                read.append(path)
            elif name == "run_command":
                run.append(path)
    return {"written": written, "read": read, "run": run}


def _compress_context(context: list[dict[str, Any]]) -> list[dict[str, Any]]:
    assistant_turns = sum(1 for m in context if m.get("role") == "assistant")
    if assistant_turns < _SUMMARIZE_AFTER_TURNS:
        return context

    actions = _extract_tool_actions(context)
    parts = []
    if actions["written"]:
        seen: dict[str, None] = {}
        for p in actions["written"]:
            seen[p] = None
        parts.append("Written/patched: " + ", ".join(seen))
    if actions["read"]:
        seen2: dict[str, None] = {}
        for p in actions["read"]:
            seen2[p] = None
        parts.append("Read: " + ", ".join(seen2))
    if actions["run"]:
        parts.append("Commands: " + ", ".join(actions["run"]))

    summary = "[Progress — " + ". ".join(parts) + ".]" if parts else "[No file operations yet.]"
    raw_tail = context[-(_KEEP_RECENT_TURNS * 2):]

    # Ensure the tail starts with an assistant message so every tool_result in the
    # tail has its matching tool_use present.  If we slice mid-pair (user message
    # with tool_result whose tool_use was in the compressed portion) Claude returns
    # a 400: "unexpected tool_use_id found in tool_result blocks".
    start = 0
    while start < len(raw_tail) and raw_tail[start].get("role") != "assistant":
        start += 1
    tail = raw_tail[start:]

    return [context[0], {"role": "user", "content": summary}] + tail


def _cacheable_task_prompt(task_prompt: str) -> list[dict[str, Any]]:
    return [{
        "type": "text",
        "text": task_prompt,
        "cache_control": {"type": "ephemeral"},
    }]


# ── Anthropic backend ─────────────────────────────────────────────────────────

async def _make_claude_request(client: Any, kwargs: dict[str, Any]) -> Any:
    config = get_rate_config()
    tracker = get_rate_tracker()

    if tracker.is_near_limit(config):
        log_rate_limit_warning()

    retry_count = 0
    delay = config.initial_retry_delay

    async with _LLM_SEMAPHORE:
        while retry_count <= config.max_retries:
            try:
                response = await client.messages.create(
                    extra_headers={"anthropic-beta": _PROMPT_CACHE_BETA},
                    **kwargs,
                )
                if hasattr(response, "usage"):
                    tracker.add_tokens(response.usage.input_tokens, response.usage.output_tokens)
                if retry_count > 0:
                    log_rate_limit_recovery()
                return response

            except anthropic.RateLimitError as e:
                retry_count += 1
                if retry_count > config.max_retries:
                    raise PlannerError(f"Rate limit exhausted after {retry_count} retries: {e}")
                log_rate_limit_hit(retry_count, delay, str(e))
                await asyncio.sleep(delay)
                delay = min(delay * 2, config.max_retry_delay)

            except anthropic.APIError as e:
                raise PlannerError(f"Claude API error: {e}")

            except Exception as e:
                raise PlannerError(f"Unexpected error: {e}")

    raise PlannerError(f"Failed after {config.max_retries} retries")


# ── Mistral backend ───────────────────────────────────────────────────────────

def _is_mistral_model(model: str) -> bool:
    return model.startswith(("mistral-", "open-mistral-", "open-mixtral-", "codestral-"))


def _to_mistral_tools(tools: list[dict]) -> list[dict]:
    """Convert Anthropic tool schema format to Mistral/OpenAI function format."""
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
    """Convert Anthropic-format message context to Mistral/OpenAI format."""
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


async def _make_mistral_request(
    messages: list[dict],
    tools: list[dict] | None,
    system_prompt: str,
    model: str,
) -> tuple[str, list[dict], dict]:
    """
    Call Mistral API. Returns (stop_reason, content_blocks, usage_dict).
    Uses mistralai SDK if installed, falls back to httpx for raw REST.
    stop_reason: "end_turn" | "tool_use"
    content_blocks: same shape as Anthropic blocks for unified handling in next_step()
    """
    mistral_key = os.environ.get("MISTRAL_API_KEY", "")
    if not mistral_key:
        raise PlannerError("MISTRAL_API_KEY not set in environment.")

    api_messages = _anthropic_context_to_mistral(messages, system_prompt)

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

    # Try mistralai SDK first
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
        pass  # fall through to httpx

    # Fallback: raw REST via httpx
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


# ── Unified entry point ───────────────────────────────────────────────────────

async def next_step(
    task_prompt: str,
    context: list[dict],
    tools: list[dict] | None = None,
    system_prompt: str | None = None,
    model: str = CLAUDE_MODEL,
) -> tuple[PlannerResult, list[dict]]:
    """
    Make one LLM API call and return the next step plus the updated context.
    Routes to Mistral or Anthropic based on the model name prefix.
    Context is never mutated in place — a new list is always returned.
    """
    if not context:
        messages: list[dict] = [{"role": "user", "content": _cacheable_task_prompt(task_prompt)}]
    else:
        ctx = _consume_read_results(context)
        ctx = _compress_context(ctx)
        ctx = _cap_all_tool_results(ctx)
        messages = ctx

    system = system_prompt or _DEFAULT_SYSTEM
    log = logger.bind(turn=len([m for m in messages if m["role"] == "assistant"]) + 1)
    log.info("planner_call", model=model, message_count=len(messages))

    # ── Mistral path ──────────────────────────────────────────────────────────
    if _is_mistral_model(model):
        try:
            stop_reason, content_blocks, usage = await _make_mistral_request(
                messages=messages,
                tools=tools,
                system_prompt=system,
                model=model,
            )
        except PlannerError:
            raise
        except Exception as e:
            raise PlannerError(f"Mistral request failed: {e}")

        log.info("planner_response", stop_reason=stop_reason,
                 input_tokens=usage.get("input_tokens", 0),
                 output_tokens=usage.get("output_tokens", 0))

        _last_usage["input_tokens"] = usage.get("input_tokens", 0)
        _last_usage["output_tokens"] = usage.get("output_tokens", 0)

        assistant_msg = {"role": "assistant", "content": content_blocks}
        new_context = messages + [assistant_msg]

        if stop_reason == "end_turn":
            text_parts = [b["text"] for b in content_blocks if b.get("type") == "text"]
            return FinalAnswer(answer=" ".join(text_parts) or "Task complete."), new_context

        # stop_reason == "tool_use"
        tool_blocks = [b for b in content_blocks if b.get("type") == "tool_use"]
        first = tool_blocks[0] if tool_blocks else None
        if len(tool_blocks) > 1:
            stubs = [
                {"type": "tool_result", "tool_use_id": b["id"],
                 "content": "Skipped: only one tool call per turn is supported."}
                for b in tool_blocks[1:]
            ]
            new_context = new_context + [{"role": "user", "content": stubs}]
        if first:
            if first["name"] == "finish":
                return FinalAnswer(answer=first["input"].get("answer", "Task complete.")), new_context
            return PlannerStep(
                tool_name=first["name"],
                tool_use_id=first["id"],
                tool_input=first["input"],
            ), new_context

        return FinalAnswer(answer="Task complete (unexpected stop reason)."), new_context

    # ── Anthropic / Claude path ───────────────────────────────────────────────
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    system_payload: list[dict[str, Any]] = [{
        "type": "text",
        "text": system,
        "cache_control": {"type": "ephemeral"},
    }]

    kwargs: dict[str, Any] = dict(
        model=model,
        max_tokens=8192,
        system=system_payload,
        messages=messages,
    )
    if tools:
        kwargs["tools"] = tools

    response = await _make_claude_request(client, kwargs)

    log.info(
        "planner_response",
        stop_reason=response.stop_reason,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
    )

    _last_usage["input_tokens"] = response.usage.input_tokens
    _last_usage["output_tokens"] = response.usage.output_tokens

    def _serialize(b: Any) -> dict:
        if b.type == "text":
            return {"type": "text", "text": b.text}
        if b.type == "tool_use":
            return {"type": "tool_use", "id": b.id, "name": b.name, "input": b.input}
        return b.model_dump(exclude_none=True)

    assistant_msg = {"role": "assistant", "content": [_serialize(b) for b in response.content]}
    new_context = messages + [assistant_msg]

    if response.stop_reason == "end_turn":
        text_parts = [b.text for b in response.content if hasattr(b, "text")]
        return FinalAnswer(answer=" ".join(text_parts) or "Task complete."), new_context

    if response.stop_reason == "tool_use":
        tool_blocks = [b for b in response.content if b.type == "tool_use"]
        first = tool_blocks[0] if tool_blocks else None

        if len(tool_blocks) > 1:
            stubs = [
                {"type": "tool_result", "tool_use_id": b.id,
                 "content": "Skipped: only one tool call per turn is supported."}
                for b in tool_blocks[1:]
            ]
            new_context = new_context + [{"role": "user", "content": stubs}]

        if first:
            if first.name == "finish":
                return FinalAnswer(answer=first.input.get("answer", "Task complete.")), new_context
            return PlannerStep(
                tool_name=first.name,
                tool_use_id=first.id,
                tool_input=first.input,
            ), new_context

    return FinalAnswer(answer="Task complete (unexpected stop reason)."), new_context
