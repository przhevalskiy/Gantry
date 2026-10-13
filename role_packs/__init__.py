"""Role packs — registered Temporal specialists beyond the classic SWE crew (Phase D).

Each pack is data + a workflow module. Playbooks may reference pack roles in
``stages[]``; Foreman still composes them as Temporal children (C1/I7/P3).
"""
from __future__ import annotations

from role_packs.registry import (
    PACK_ROLES,
    all_known_roles,
    load_pack_workflows,
    pack_catalog_entries,
    role_workflow_map,
)

__all__ = [
    "PACK_ROLES",
    "all_known_roles",
    "load_pack_workflows",
    "pack_catalog_entries",
    "role_workflow_map",
]
