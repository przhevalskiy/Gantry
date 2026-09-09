"""SSE event shape contract — docs/platform/sse-events.md."""
from __future__ import annotations

import json

from api.schemas.task_sse import (
    done_event,
    error_event,
    hitl_event,
    lifecycle_event,
    message_event,
    status_event,
)


def _payload(line: str) -> dict:
    assert line.startswith("data: ")
    return json.loads(line[6:])


def test_status_event_shape():
    p = _payload(status_event("running"))
    assert p == {"type": "status", "status": "running"}


def test_lifecycle_event_shape():
    p = _payload(lifecycle_event("task.queued"))
    assert p == {"type": "lifecycle", "event": "task.queued"}


def test_message_event_shape():
    p = _payload(message_event({"id": "m1", "content": "hello"}))
    assert p["type"] == "message"
    assert p["message"]["id"] == "m1"


def test_hitl_event_shape():
    p = _payload(hitl_event(checkpoint="architect_plan", workflow_id="wf-1", description="Approve plan"))
    assert p["type"] == "hitl"
    assert p["checkpoint"] == "architect_plan"
    assert p["workflow_id"] == "wf-1"


def test_error_event_shape():
    p = _payload(error_event("boom"))
    assert p == {"type": "error", "message": "boom"}


def test_done_event_includes_structured_result():
    p = _payload(done_event(status="completed", result={"pr_url": "https://github.com/o/r/pull/1"}))
    assert p["type"] == "done"
    assert p["status"] == "completed"
    assert p["result"]["pr_url"].endswith("/pull/1")


def test_no_domain_sse_types():
    forbidden = {"checklist", "intent", "submitted", "citations"}
    for fn, args in (
        (status_event, ("running",)),
        (lifecycle_event, ("x",)),
        (message_event, ({"content": "x"},)),
        (hitl_event, {"checkpoint": "devops", "workflow_id": "w"}),
        (error_event, ("e",)),
        (done_event, {"status": "failed", "result": None}),
    ):
        if isinstance(args, dict):
            line = fn(**args)
        elif isinstance(args, tuple) and len(args) == 1:
            line = fn(args[0])
        else:
            line = fn(*args)
        p = _payload(line)
        assert p["type"] not in forbidden
