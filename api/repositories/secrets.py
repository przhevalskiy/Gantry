from __future__ import annotations

import json
from pathlib import Path
from typing import Optional
from uuid import uuid4

from api import db
from api.crypto import decrypt, encrypt


def _secrets_path() -> Path:
    import os

    return Path(os.getenv("GANTRY_HOME", str(Path.home() / ".gantry"))) / "org_secrets.json"


def _load_file_store() -> dict:
    path = _secrets_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def _save_file_store(store: dict) -> None:
    path = _secrets_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(store, indent=2))


async def upsert_secret(*, org_id: str, name: str, value: str) -> dict:
    name = name.strip()
    if not name:
        raise ValueError("name is required")
    ciphertext = encrypt(value)

    if not db.is_available():
        store = _load_file_store()
        org_secrets = store.setdefault(org_id, {})
        org_secrets[name] = ciphertext
        _save_file_store(store)
        return {"name": name, "org_id": org_id, "created_at": None}

    row = await db.fetch_one(
        """
        INSERT INTO org_secrets (id, org_id, name, encrypted_value)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (org_id, name) DO UPDATE SET
            encrypted_value = EXCLUDED.encrypted_value,
            updated_at = now()
        RETURNING id, org_id, name, created_at, updated_at
        """,
        (str(uuid4()), org_id, name, ciphertext),
    )
    return {
        "id": str(row["id"]),
        "org_id": str(row["org_id"]),
        "name": row["name"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


async def list_secrets(*, org_id: str) -> list[dict]:
    if not db.is_available():
        org_secrets = _load_file_store().get(org_id, {})
        return [{"name": name, "org_id": org_id} for name in sorted(org_secrets)]

    rows = await db.fetch_all(
        """
        SELECT id, org_id, name, created_at, updated_at
        FROM org_secrets
        WHERE org_id = %s
        ORDER BY name ASC
        """,
        (org_id,),
    )
    return [
        {
            "id": str(r["id"]),
            "org_id": str(r["org_id"]),
            "name": r["name"],
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            "updated_at": r["updated_at"].isoformat() if r.get("updated_at") else None,
        }
        for r in rows
    ]


async def get_secret_value(*, org_id: str, name: str) -> Optional[str]:
    if not db.is_available():
        ciphertext = _load_file_store().get(org_id, {}).get(name)
        if not ciphertext:
            return None
        return decrypt(ciphertext)

    row = await db.fetch_one(
        "SELECT encrypted_value FROM org_secrets WHERE org_id = %s AND name = %s",
        (org_id, name),
    )
    if not row:
        return None
    return decrypt(row["encrypted_value"])


async def delete_secret(*, org_id: str, name: str) -> bool:
    if not db.is_available():
        store = _load_file_store()
        org_secrets = store.get(org_id, {})
        if name not in org_secrets:
            return False
        del org_secrets[name]
        store[org_id] = org_secrets
        _save_file_store(store)
        return True

    row = await db.fetch_one(
        "SELECT id FROM org_secrets WHERE org_id = %s AND name = %s",
        (org_id, name),
    )
    if not row:
        return False
    await db.execute(
        "DELETE FROM org_secrets WHERE org_id = %s AND name = %s",
        (org_id, name),
    )
    return True
