"""Org firm-pack install state — DB or GANTRY_HOME file fallback (I6)."""
from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path
from typing import Any

from api import db
from schemas.firm_packs import (
    DEFAULT_PACK_MAX_TASKS_PER_DAY,
    FIRM_PACKS,
    get_pack,
    list_pack_catalog,
    playbook_to_pack,
)


def _file_path() -> Path:
    return Path(os.getenv("GANTRY_HOME", str(Path.home() / ".gantry"))) / "org_firm_packs.json"


def _load_file() -> dict[str, Any]:
    path = _file_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def _save_file(data: dict[str, Any]) -> None:
    path = _file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def _row(
    *,
    org_id: str,
    pack_id: str,
    version: str,
    enabled: bool,
    max_tasks_per_day: int,
    installed: bool,
    installed_at: str | None = None,
    updated_at: str | None = None,
) -> dict[str, Any]:
    catalog = get_pack(pack_id, version if version else None)
    return {
        "org_id": org_id,
        "pack_id": pack_id,
        "version": version,
        "ref": catalog["ref"],
        "label": catalog["label"],
        "description": catalog["description"],
        "roles": list(catalog["roles"]),
        "playbooks": list(catalog["playbooks"]),
        "default_playbook": catalog["default_playbook"],
        "auto_enabled": bool(catalog.get("auto_enabled")),
        "enabled": enabled,
        "installed": installed,
        "max_tasks_per_day": max_tasks_per_day,
        "installed_at": installed_at,
        "updated_at": updated_at,
    }


def _file_installs(org_id: str) -> dict[str, dict[str, Any]]:
    return dict(_load_file().get(org_id) or {})


async def list_org_packs(*, org_id: str) -> list[dict[str, Any]]:
    """Catalog + org install/enable state for every known firm pack."""
    installs: dict[str, dict[str, Any]] = {}
    if db.is_available():
        rows = await db.fetch_all(
            "SELECT * FROM org_firm_packs WHERE org_id = %s",
            (org_id,),
        )
        for row in rows:
            installs[str(row["pack_id"])] = {
                "version": str(row["version"]),
                "enabled": bool(row["enabled"]),
                "max_tasks_per_day": int(row["max_tasks_per_day"]),
                "installed_at": row["installed_at"].isoformat()
                if hasattr(row.get("installed_at"), "isoformat")
                else row.get("installed_at"),
                "updated_at": row["updated_at"].isoformat()
                if hasattr(row.get("updated_at"), "isoformat")
                else row.get("updated_at"),
            }
    else:
        installs = _file_installs(org_id)

    out: list[dict[str, Any]] = []
    for pack in list_pack_catalog():
        pack_id = pack["id"]
        inst = installs.get(pack_id)
        auto = bool(pack.get("auto_enabled"))
        if inst:
            out.append(
                _row(
                    org_id=org_id,
                    pack_id=pack_id,
                    version=str(inst.get("version") or pack["version"]),
                    enabled=bool(inst.get("enabled", True)),
                    max_tasks_per_day=int(
                        inst.get("max_tasks_per_day", DEFAULT_PACK_MAX_TASKS_PER_DAY)
                    ),
                    installed=True,
                    installed_at=inst.get("installed_at"),
                    updated_at=inst.get("updated_at"),
                )
            )
        else:
            out.append(
                _row(
                    org_id=org_id,
                    pack_id=pack_id,
                    version=str(pack["version"]),
                    enabled=auto,
                    max_tasks_per_day=DEFAULT_PACK_MAX_TASKS_PER_DAY,
                    installed=False,
                )
            )
    return out


async def get_org_pack(*, org_id: str, pack_id: str) -> dict[str, Any] | None:
    if pack_id not in FIRM_PACKS:
        return None
    for row in await list_org_packs(org_id=org_id):
        if row["pack_id"] == pack_id:
            return row
    return None


async def install_pack(
    *,
    org_id: str,
    pack_id: str,
    version: str | None = None,
    max_tasks_per_day: int | None = None,
) -> dict[str, Any]:
    pack = get_pack(pack_id, version)
    ver = str(pack["version"])
    quota = (
        int(max_tasks_per_day)
        if max_tasks_per_day is not None
        else DEFAULT_PACK_MAX_TASKS_PER_DAY
    )
    if quota < 1 or quota > 10_000:
        raise ValueError("max_tasks_per_day must be 1–10000")

    if db.is_available():
        await db.execute(
            """
            INSERT INTO org_firm_packs (org_id, pack_id, version, enabled, max_tasks_per_day)
            VALUES (%s::uuid, %s, %s, true, %s)
            ON CONFLICT (org_id, pack_id) DO UPDATE SET
                version = EXCLUDED.version,
                enabled = true,
                max_tasks_per_day = EXCLUDED.max_tasks_per_day,
                updated_at = now()
            """,
            (org_id, pack_id, ver, quota),
        )
    else:
        data = _load_file()
        org = dict(data.get(org_id) or {})
        org[pack_id] = {
            "version": ver,
            "enabled": True,
            "max_tasks_per_day": quota,
            "installed_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
        }
        data[org_id] = org
        _save_file(data)

    # Ensure pack playbooks exist for the org (system seed is idempotent).
    from api.repositories import playbooks as playbooks_repo

    await playbooks_repo.seed_system_playbooks(org_id)

    row = await get_org_pack(org_id=org_id, pack_id=pack_id)
    assert row is not None
    return row


async def update_pack(
    *,
    org_id: str,
    pack_id: str,
    enabled: bool | None = None,
    max_tasks_per_day: int | None = None,
) -> dict[str, Any]:
    if pack_id not in FIRM_PACKS:
        raise ValueError(f"unknown firm pack: {pack_id}")
    current = await get_org_pack(org_id=org_id, pack_id=pack_id)
    if not current or not current.get("installed"):
        # Auto-enabled packs can be patched by installing first.
        if enabled is False or max_tasks_per_day is not None or enabled is True:
            await install_pack(org_id=org_id, pack_id=pack_id, max_tasks_per_day=max_tasks_per_day)
            current = await get_org_pack(org_id=org_id, pack_id=pack_id)
    if not current:
        raise ValueError(f"firm pack not installed: {pack_id}")

    new_enabled = current["enabled"] if enabled is None else bool(enabled)
    new_quota = (
        current["max_tasks_per_day"]
        if max_tasks_per_day is None
        else int(max_tasks_per_day)
    )
    if new_quota < 1 or new_quota > 10_000:
        raise ValueError("max_tasks_per_day must be 1–10000")

    if db.is_available():
        await db.execute(
            """
            UPDATE org_firm_packs
            SET enabled = %s, max_tasks_per_day = %s, updated_at = now()
            WHERE org_id = %s::uuid AND pack_id = %s
            """,
            (new_enabled, new_quota, org_id, pack_id),
        )
    else:
        data = _load_file()
        org = dict(data.get(org_id) or {})
        row = dict(org.get(pack_id) or {})
        row["enabled"] = new_enabled
        row["max_tasks_per_day"] = new_quota
        row["updated_at"] = date.today().isoformat()
        row.setdefault("version", current["version"])
        row.setdefault("installed_at", date.today().isoformat())
        org[pack_id] = row
        data[org_id] = org
        _save_file(data)

    updated = await get_org_pack(org_id=org_id, pack_id=pack_id)
    assert updated is not None
    return updated


async def uninstall_pack(*, org_id: str, pack_id: str) -> bool:
    """Disable + remove install row. Auto-enabled packs fall back to catalog defaults."""
    if pack_id not in FIRM_PACKS:
        return False
    if db.is_available():
        await db.execute(
            "DELETE FROM org_firm_packs WHERE org_id = %s::uuid AND pack_id = %s",
            (org_id, pack_id),
        )
        return True
    data = _load_file()
    org = dict(data.get(org_id) or {})
    if pack_id not in org:
        return False
    del org[pack_id]
    data[org_id] = org
    _save_file(data)
    return True


async def assert_playbook_pack_allowed(*, org_id: str, playbook_slug: str) -> str | None:
    """Raise ValueError if playbook's pack is explicitly disabled. Return pack_id or None.

    Uninstalled packs remain usable for back-compat (system playbooks). Install is
    required for per-pack quotas and catalog enablement UX (Phase E).
    """
    pack_id = playbook_to_pack(playbook_slug)
    if not pack_id:
        return None
    state = await get_org_pack(org_id=org_id, pack_id=pack_id)
    if state and state.get("installed") and not state.get("enabled"):
        raise ValueError(
            f"firm pack {pack_id!r} is disabled for this org — "
            f"enable it via POST /v1/packs/{pack_id}/install or PATCH /v1/packs/{pack_id}"
        )
    return pack_id


async def count_pack_tasks_today(*, org_id: str, pack_id: str) -> int:
    """Count today's tasks that used a playbook owned by this pack."""
    if not db.is_available():
        return 0
    playbooks = list(FIRM_PACKS.get(pack_id, {}).get("playbooks") or [])
    if not playbooks:
        return 0
    row = await db.fetch_one(
        """
        SELECT COUNT(*) AS count FROM api_tasks
        WHERE org_id = %s
          AND created_at::date = CURRENT_DATE
          AND meta->>'playbook' = ANY(%s)
        """,
        (org_id, playbooks),
    )
    return int(row["count"]) if row else 0


async def assert_pack_quota(*, org_id: str, pack_id: str) -> None:
    state = await get_org_pack(org_id=org_id, pack_id=pack_id)
    if not state:
        return
    limit = int(state.get("max_tasks_per_day") or DEFAULT_PACK_MAX_TASKS_PER_DAY)
    used = await count_pack_tasks_today(org_id=org_id, pack_id=pack_id)
    if used >= limit:
        raise ValueError(
            f"firm pack {pack_id!r} daily quota exceeded ({used}/{limit})"
        )
