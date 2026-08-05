"""LLM planning layer — multi-provider tool-use loop for swarm agents.

Supported providers:
  - Anthropic Claude  (model names starting with "claude-")
  - Mistral           (model names starting with "mistral-", "open-mistral-", etc.)
  - OpenAI-compatible (gpt-*, o1*, o3*, or custom base URL for Ollama/vLLM)

The provider is selected automatically from the model name passed to next_step().
Tool schemas use standard JSON Schema (input_schema), which both providers accept.
"""
from __future__ import annotations

import structlog
from typing import Any

import anthropic

from project.config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from project.planner_types import PlannerStep, FinalAnswer, PlannerError, PlannerResult
from project.backends.anthropic import make_claude_request
from project.backends.mistral import is_mistral_model, make_mistral_request
from project.backends.openai_compat import is_openai_compatible, make_openai_request
from project.llm_runtime import anthropic_api_key, mistral_api_key, openai_api_key, openai_base_url

logger = structlog.get_logger(__name__)

_DEFAULT_SYSTEM = (
    "You are a specialist agent in a durable software engineering swarm. "
    "Use the tools available to complete your assigned task. "
    "Call exactly ONE tool per response."
)

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
    # tail has its matching tool_use present.
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


# ── Unified entry point ───────────────────────────────────────────────────────

async def next_step(
    task_prompt: str,
    context: list[dict],
    tools: list[dict] | None = None,
    system_prompt: str | None = None,
    model: str = CLAUDE_MODEL,
    llm_credentials: dict | None = None,
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
    if is_mistral_model(model):
        try:
            stop_reason, content_blocks, usage = await make_mistral_request(
                messages=messages,
                tools=tools,
                system_prompt=system,
                model=model,
                api_key=mistral_api_key(llm_credentials),
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

    # ── OpenAI-compatible path ────────────────────────────────────────────────
    if is_openai_compatible(model, llm_credentials):
        try:
            stop_reason, content_blocks, usage = await make_openai_request(
                messages=messages,
                tools=tools,
                system_prompt=system,
                model=model,
                api_key=openai_api_key(llm_credentials),
                base_url=openai_base_url(llm_credentials),
            )
        except PlannerError:
            raise
        except Exception as e:
            raise PlannerError(f"OpenAI-compatible request failed: {e}") from e

        log.info(
            "planner_response",
            stop_reason=stop_reason,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
        )
        _last_usage["input_tokens"] = usage.get("input_tokens", 0)
        _last_usage["output_tokens"] = usage.get("output_tokens", 0)

        assistant_msg = {"role": "assistant", "content": content_blocks}
        new_context = messages + [assistant_msg]

        if stop_reason == "end_turn":
            text_parts = [b["text"] for b in content_blocks if b.get("type") == "text"]
            return FinalAnswer(answer=" ".join(text_parts) or "Task complete."), new_context

        tool_blocks = [b for b in content_blocks if b.get("type") == "tool_use"]
        first = tool_blocks[0] if tool_blocks else None
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
    api_key = anthropic_api_key(llm_credentials)
    if not api_key:
        raise PlannerError(
            "No Anthropic API key for this task. Configure org LLM settings or set ANTHROPIC_API_KEY."
        )
    client = anthropic.AsyncAnthropic(api_key=api_key)
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

    response = await make_claude_request(client, kwargs)

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
