"""Platform task SSE event formatting — see docs/platform/sse-events.md."""
from __future__ import annotations

import json
from typing import Any


def format_sse_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def status_event(status: str) -> str:
    return format_sse_event({"type": "status", "status": status})


def lifecycle_event(event: str) -> str:
    return format_sse_event({"type": "lifecycle", "event": event})


def message_event(message: dict[str, Any]) -> str:
    return format_sse_event({"type": "message", "message": message})


def hitl_event(*, checkpoint: str, workflow_id: str, description: str | None = None) -> str:
    payload: dict[str, Any] = {
        "type": "hitl",
        "checkpoint": checkpoint,
        "workflow_id": workflow_id,
    }
    if description:
        payload["description"] = description
    return format_sse_event(payload)


def error_event(message: str) -> str:
    return format_sse_event({"type": "error", "message": message})


def done_event(*, status: str, result: dict[str, Any] | None) -> str:
    return format_sse_event({"type": "done", "status": status, "result": result})
