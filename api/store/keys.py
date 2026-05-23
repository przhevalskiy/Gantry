import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from api.config import KEYS_PATH
from api.auth import hash_key, verify_key


def _load() -> list[dict]:
    if not KEYS_PATH.exists():
        return []
    try:
        return json.loads(KEYS_PATH.read_text())
    except Exception:
        return []


def _save(keys: list[dict]) -> None:
    KEYS_PATH.parent.mkdir(parents=True, exist_ok=True)
    KEYS_PATH.write_text(json.dumps(keys, indent=2))


def create_key(name: str, plaintext: str) -> dict:
    keys = _load()
    record = {
        "id": str(uuid4()),
        "name": name,
        "key_hash": hash_key(plaintext),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "active": True,
    }
    keys.append(record)
    _save(keys)
    return record


def list_keys() -> list[dict]:
    return [k for k in _load() if k.get("active", True)]


def revoke_key(key_id: str) -> bool:
    keys = _load()
    for k in keys:
        if k["id"] == key_id:
            k["active"] = False
            _save(keys)
            return True
    return False


def authenticate(plaintext: str) -> Optional[dict]:
    """Return the key record if valid, update last_used_at, else None."""
    keys = _load()
    for k in keys:
        if k.get("active") and verify_key(plaintext, k["key_hash"]):
            k["last_used_at"] = datetime.now(timezone.utc).isoformat()
            _save(keys)
            return k
    return None


def has_any_key() -> bool:
    return bool(_load())
