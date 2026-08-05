"""Per-task LLM credentials — worker-side store keyed by task_id."""
from __future__ import annotations

_store: dict[str, dict] = {}


def register(task_id: str, credentials: dict) -> None:
    _store[task_id] = dict(credentials)


def get(task_id: str) -> dict:
    return dict(_store.get(task_id, {}))


def clear(task_id: str) -> None:
    _store.pop(task_id, None)
