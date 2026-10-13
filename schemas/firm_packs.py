"""Firm packs — versioned role set + default playbooks (Phase E).

Packs are product packaging over the one factory (C1). Installing a pack does
not deploy a new ACP agent; it enables seats/playbooks already registered as
Temporal children (P2/P3).
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

# Versioned firm packs. ``ref`` is the public id used in APIs: ``{id}@{version}``.
FIRM_PACKS: dict[str, dict[str, Any]] = {
    "swe-factory": {
        "id": "swe-factory",
        "version": "1",
        "label": "SWE Factory",
        "description": (
            "Classic durable engineering crew — plan, build, verify, secure, ship. "
            "Default job packets for backlog and monorepo slices."
        ),
        "roles": [
            "pm",
            "architect",
            "builder",
            "inspector",
            "reviewer",
            "security",
            "devops",
        ],
        "playbooks": ["platform-backlog", "monorepo-slice"],
        "default_playbook": "platform-backlog",
        # Built-in: available without an explicit install row.
        "auto_enabled": True,
    },
    "migration-runner": {
        "id": "migration-runner",
        "version": "1",
        "label": "Migration Runner",
        "description": (
            "Migration / remediation jobs — branch-first artifacts and the "
            "oracle-a11y Temporal specialist for WCAG-oriented playbooks."
        ),
        "roles": [
            "pm",
            "architect",
            "builder",
            "inspector",
            "reviewer",
            "oracle_a11y",
            "security",
            "devops",
        ],
        "playbooks": ["a11y-remediation"],
        "default_playbook": "a11y-remediation",
        "auto_enabled": False,
    },
}

DEFAULT_PACK_MAX_TASKS_PER_DAY = 200


def pack_ref(pack_id: str, version: str | None = None) -> str:
    pack = FIRM_PACKS.get(pack_id)
    if not pack:
        raise ValueError(f"unknown firm pack: {pack_id}")
    ver = version or str(pack["version"])
    return f"{pack_id}@{ver}"


def parse_pack_ref(ref: str) -> tuple[str, str | None]:
    """Return (pack_id, version|None) from ``id`` or ``id@version``."""
    raw = (ref or "").strip().lower()
    if not raw:
        raise ValueError("pack ref required")
    if "@" in raw:
        pack_id, version = raw.split("@", 1)
        return pack_id.strip(), version.strip() or None
    return raw, None


def get_pack(pack_id: str, version: str | None = None) -> dict[str, Any]:
    pack = FIRM_PACKS.get(pack_id)
    if not pack:
        raise ValueError(f"unknown firm pack: {pack_id}")
    if version and str(version) != str(pack["version"]):
        raise ValueError(
            f"firm pack {pack_id} version {version!r} not found "
            f"(available: {pack['version']})"
        )
    out = deepcopy(pack)
    out["ref"] = pack_ref(pack_id, str(pack["version"]))
    return out


def list_pack_catalog() -> list[dict[str, Any]]:
    return [get_pack(pid) for pid in sorted(FIRM_PACKS)]


def playbook_to_pack(playbook_slug: str) -> str | None:
    """Return pack id that owns this system playbook slug, if any."""
    slug = (playbook_slug or "").strip().lower()
    if not slug:
        return None
    for pack_id, pack in FIRM_PACKS.items():
        if slug in pack.get("playbooks", []):
            return pack_id
    return None


def resolve_run_playbook(*, pack: str | None, playbook: str | None) -> tuple[str | None, str]:
    """Resolve (pack_id|None, playbook_slug) for playbooks.run.

    - pack only → pack.default_playbook
    - playbook only → playbook (pack inferred if system)
    - both → playbook must belong to pack when pack owns playbooks
    """
    pack_id = None
    version = None
    if pack:
        pack_id, version = parse_pack_ref(pack)
        get_pack(pack_id, version)

    if playbook:
        slug = playbook.strip().lower()
        owner = playbook_to_pack(slug)
        if pack_id and owner and owner != pack_id:
            raise ValueError(
                f"playbook {slug!r} belongs to pack {owner!r}, not {pack_id!r}"
            )
        return pack_id or owner, slug

    if pack_id:
        pack_row = get_pack(pack_id, version)
        return pack_id, str(pack_row["default_playbook"])

    raise ValueError("playbook or pack is required")
