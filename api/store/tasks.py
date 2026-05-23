import json
from datetime import datetime, timezone
from pathlib import Path

from api.config import TASKS_PATH


def _load() -> dict:
    if not TASKS_PATH.exists():
        return {}
    try:
        return json.loads(TASKS_PATH.read_text())
    except Exception:
        return {}


def _save(store: dict) -> None:
    TASKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    TASKS_PATH.write_text(json.dumps(store, indent=2))


def save_task(task_id: str, project_id: str, webhook_url: str | None, source: str = "api", meta: dict | None = None) -> None:
    store = _load()
    store[task_id] = {
        "project_id": project_id,
        "webhook_url": webhook_url,
        "source": source,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "webhook_fired": False,
        **(meta or {}),
    }
    _save(store)


def get_task_meta(task_id: str) -> dict | None:
    return _load().get(task_id)


def mark_webhook_fired(task_id: str) -> None:
    store = _load()
    if task_id in store:
        store[task_id]["webhook_fired"] = True
        _save(store)


def pending_tasks() -> list[tuple[str, dict]]:
    """Return all tasks that haven't been marked done yet (webhook or github callback)."""
    return [
        (tid, meta)
        for tid, meta in _load().items()
        if not meta.get("webhook_fired")
    ]


def pending_webhook_tasks() -> list[tuple[str, dict]]:
    """Return tasks that have a webhook_url and haven't been fired yet."""
    return [
        (tid, meta)
        for tid, meta in _load().items()
        if meta.get("webhook_url") and not meta.get("webhook_fired")
    ]
