"""Role pack registry — merge pack roles into the Foreman role map (P3/C2)."""
from __future__ import annotations

from copy import deepcopy
from importlib import import_module
from pathlib import Path
from typing import Any

_PACK_ROOT = Path(__file__).resolve().parent

# Classic SWE seats (schemas/playbooks baseline).
_BASE_ROLES = frozenset({
    "pm",
    "architect",
    "builder",
    "inspector",
    "reviewer",
    "security",
    "devops",
})

_BASE_WORKFLOW_MAP: dict[str, str] = {
    "pm": "PMAgent",
    "architect": "ArchitectAgent",
    "builder": "BuilderAgent",
    "inspector": "InspectorAgent",
    "reviewer": "ReviewerAgent",
    "security": "SecurityAgent",
    "devops": "DevOpsAgent",
}


def discover_packs() -> list[dict[str, Any]]:
    """Load every ``role_packs/*/pack.py`` descriptor (``PACK`` dict)."""
    packs: list[dict[str, Any]] = []
    if not _PACK_ROOT.is_dir():
        return packs
    for child in sorted(_PACK_ROOT.iterdir()):
        if not child.is_dir() or child.name.startswith("_"):
            continue
        pack_mod = child / "pack.py"
        if not pack_mod.is_file():
            continue
        mod = import_module(f"role_packs.{child.name}.pack")
        raw = getattr(mod, "PACK", None)
        if not isinstance(raw, dict):
            continue
        roles = raw.get("roles") or []
        if not isinstance(roles, list):
            continue
        packs.append({
            "id": str(raw.get("id") or child.name),
            "label": str(raw.get("label") or child.name),
            "version": str(raw.get("version") or "1"),
            "path": child,
            "roles": roles,
        })
    return packs


def _pack_roles() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for pack in discover_packs():
        for role in pack["roles"]:
            if not isinstance(role, dict):
                continue
            role_id = str(role.get("id") or "").lower().strip()
            workflow = str(role.get("workflow") or "").strip()
            if not role_id or not workflow:
                continue
            if role_id in _BASE_ROLES:
                raise ValueError(f"role pack must not shadow base role {role_id!r}")
            entry = deepcopy(role)
            entry["id"] = role_id
            entry["workflow"] = workflow
            entry["pack"] = pack["id"]
            entry["pack_version"] = pack["version"]
            out[role_id] = entry
    return out


PACK_ROLES: dict[str, dict[str, Any]] = _pack_roles()


def all_known_roles() -> frozenset[str]:
    return frozenset(_BASE_ROLES | set(PACK_ROLES))


def role_workflow_map() -> dict[str, str]:
    merged = dict(_BASE_WORKFLOW_MAP)
    for role_id, entry in PACK_ROLES.items():
        merged[role_id] = entry["workflow"]
    return merged


def pack_catalog_entries() -> list[dict[str, Any]]:
    """Catalog rows for GET /v1/agents — temporal_child, same ACP citizen (C1)."""
    rows: list[dict[str, Any]] = []
    for role_id, entry in sorted(PACK_ROLES.items()):
        rows.append({
            "name": str(entry.get("catalog_name") or f"gantry-{role_id.replace('_', '-')}"),
            "role": str(entry.get("label") or role_id),
            "workflow": entry["workflow"],
            "acp_name": "swarm-factory",
            "entrypoint": "temporal_child",
            "level": str(entry.get("level") or "L4"),
            "description": str(
                entry.get("description") or f"Role pack specialist ({entry['pack']})."
            ),
            "tools": list(entry.get("tools") or []),
            "pack": entry["pack"],
            "pack_version": entry["pack_version"],
        })
    return rows


def load_pack_workflows() -> list[type]:
    """Import workflow classes declared by packs for worker registration."""
    classes: list[type] = []
    for pack in discover_packs():
        for role in pack["roles"]:
            module_path = role.get("module")
            class_name = role.get("class")
            if not module_path or not class_name:
                continue
            mod = import_module(str(module_path))
            classes.append(getattr(mod, str(class_name)))
    return classes
