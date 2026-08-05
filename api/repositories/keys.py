from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from api.auth import hash_key, verify_key
from api.config import KEYS_PATH
from api import db
from api.repositories.organizations import DEFAULT_ORG_ID, ensure_default_org

_FILE_ORG_ID = DEFAULT_ORG_ID


def _load_file() -> list[dict]:
    if not KEYS_PATH.exists():
        return []
    try:
        return json.loads(KEYS_PATH.read_text())
    except Exception:
        return []


def _save_file(keys: list[dict]) -> None:
    KEYS_PATH.parent.mkdir(parents=True, exist_ok=True)
    KEYS_PATH.write_text(json.dumps(keys, indent=2))


def _record_to_api(record: dict, include_hash: bool = False) -> dict:
    out = {
        "id": record["id"],
        "org_id": record.get("org_id", _FILE_ORG_ID),
        "name": record["name"],
        "scopes": record.get("scopes", ["admin"]),
        "created_at": record["created_at"],
        "last_used_at": record.get("last_used_at"),
        "active": record.get("active", True),
    }
    if include_hash:
        out["key_hash"] = record["key_hash"]
    return out


async def has_any_key() -> bool:
    if db.is_available():
        row = await db.fetch_one("SELECT 1 FROM api_keys WHERE active = true LIMIT 1")
        return row is not None
    return bool(_load_file())


async def create_key(
    name: str,
    plaintext: str,
    *,
    org_id: str | None = None,
    scopes: list[str] | None = None,
) -> tuple[dict, str]:
    org = org_id or await ensure_default_org()
    now = datetime.now(timezone.utc).isoformat()
    key_scopes = scopes or ["admin"]
    record = {
        "id": str(uuid4()),
        "org_id": org,
        "name": name,
        "key_hash": hash_key(plaintext),
        "scopes": key_scopes,
        "created_at": now,
        "last_used_at": None,
        "active": True,
    }

    if db.is_available():
        await db.execute(
            """
            INSERT INTO api_keys (id, org_id, name, key_hash, scopes, active, created_at)
            VALUES (%s, %s, %s, %s, %s, true, now())
            """,
            (record["id"], org, name, record["key_hash"], key_scopes),
        )
    else:
        keys = _load_file()
        keys.append(record)
        _save_file(keys)

    return _record_to_api(record), plaintext


async def list_keys(*, org_id: str | None = None) -> list[dict]:
    if db.is_available():
        if org_id:
            rows = await db.fetch_all(
                "SELECT * FROM api_keys WHERE org_id = %s AND active = true ORDER BY created_at DESC",
                (org_id,),
            )
        else:
            rows = await db.fetch_all(
                "SELECT * FROM api_keys WHERE active = true ORDER BY created_at DESC"
            )
        return [
            {
                "id": str(r["id"]),
                "org_id": str(r["org_id"]),
                "name": r["name"],
                "scopes": r.get("scopes") or ["admin"],
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                "last_used_at": r["last_used_at"].isoformat() if r.get("last_used_at") else None,
                "active": r.get("active", True),
            }
            for r in rows
        ]

    keys = [k for k in _load_file() if k.get("active", True)]
    if org_id:
        keys = [k for k in keys if k.get("org_id", _FILE_ORG_ID) == org_id]
    return [_record_to_api(k) for k in keys]


async def revoke_key(key_id: str, *, org_id: str | None = None) -> bool:
    if db.is_available():
        if org_id:
            row = await db.fetch_one(
                "SELECT id FROM api_keys WHERE id = %s AND org_id = %s",
                (key_id, org_id),
            )
            if not row:
                return False
        await db.execute("UPDATE api_keys SET active = false WHERE id = %s", (key_id,))
        return True

    keys = _load_file()
    found = False
    for k in keys:
        if k["id"] == key_id and (not org_id or k.get("org_id", _FILE_ORG_ID) == org_id):
            k["active"] = False
            found = True
    if found:
        _save_file(keys)
    return found


async def authenticate(plaintext: str) -> Optional[dict]:
    if db.is_available():
        rows = await db.fetch_all("SELECT * FROM api_keys WHERE active = true")
        for r in rows:
            if verify_key(plaintext, r["key_hash"]):
                await db.execute(
                    "UPDATE api_keys SET last_used_at = now() WHERE id = %s",
                    (str(r["id"]),),
                )
                return {
                    "id": str(r["id"]),
                    "org_id": str(r["org_id"]),
                    "name": r["name"],
                    "scopes": r.get("scopes") or ["admin"],
                    "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                    "last_used_at": datetime.now(timezone.utc).isoformat(),
                    "active": True,
                }
        return None

    keys = _load_file()
    for k in keys:
        if k.get("active", True) and verify_key(plaintext, k["key_hash"]):
            k["last_used_at"] = datetime.now(timezone.utc).isoformat()
            _save_file(keys)
            return _record_to_api(k)
    return None


async def migrate_file_keys_to_db() -> int:
    if not db.is_available() or not KEYS_PATH.exists():
        return 0
    org_id = await ensure_default_org()
    existing = await db.fetch_all("SELECT key_hash FROM api_keys")
    existing_hashes = {r["key_hash"] for r in existing}
    migrated = 0
    for k in _load_file():
        if not k.get("active", True) or k["key_hash"] in existing_hashes:
            continue
        await db.execute(
            """
            INSERT INTO api_keys (id, org_id, name, key_hash, scopes, active, created_at, last_used_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (key_hash) DO NOTHING
            """,
            (
                k.get("id") or str(uuid4()),
                k.get("org_id", org_id),
                k["name"],
                k["key_hash"],
                k.get("scopes", ["admin"]),
                k.get("active", True),
                k.get("created_at"),
                k.get("last_used_at"),
            ),
        )
        migrated += 1
    return migrated
