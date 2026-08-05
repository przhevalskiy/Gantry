from __future__ import annotations

from api import db

DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001"
DEFAULT_ORG_SLUG = "default"


async def get_default_org_id() -> str:
    if not db.is_available():
        return DEFAULT_ORG_ID
    row = await db.fetch_one(
        "SELECT id FROM organizations WHERE slug = %s",
        (DEFAULT_ORG_SLUG,),
    )
    return str(row["id"]) if row else DEFAULT_ORG_ID


async def ensure_default_org() -> str:
    if not db.is_available():
        return DEFAULT_ORG_ID
    row = await db.fetch_one(
        "SELECT id FROM organizations WHERE slug = %s",
        (DEFAULT_ORG_SLUG,),
    )
    if row:
        return str(row["id"])
    row = await db.fetch_one(
        """
        INSERT INTO organizations (id, name, slug)
        VALUES (%s, %s, %s)
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
        """,
        (DEFAULT_ORG_ID, "Default Organization", DEFAULT_ORG_SLUG),
    )
    return str(row["id"])
