from __future__ import annotations

from api import db


async def get_settings(org_id: str) -> dict:
    if not db.is_available():
        return {"org_id": org_id, "brand_name": "Gantry", "accent_color": "#f97316"}
    row = await db.fetch_one("SELECT * FROM org_settings WHERE org_id = %s", (org_id,))
    if not row:
        return {"org_id": org_id, "brand_name": "Gantry", "accent_color": "#f97316"}
    return {
        "org_id": str(row["org_id"]),
        "brand_name": row.get("brand_name") or "Gantry",
        "logo_url": row.get("logo_url"),
        "support_email": row.get("support_email"),
        "accent_color": row.get("accent_color") or "#f97316",
    }


async def update_settings(org_id: str, **kwargs) -> dict:
    if not db.is_available():
        return await get_settings(org_id)

    current = await get_settings(org_id)
    brand_name = kwargs.get("brand_name", current.get("brand_name"))
    logo_url = kwargs.get("logo_url", current.get("logo_url"))
    support_email = kwargs.get("support_email", current.get("support_email"))
    accent_color = kwargs.get("accent_color", current.get("accent_color"))

    await db.execute(
        """
        INSERT INTO org_settings (org_id, brand_name, logo_url, support_email, accent_color)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (org_id) DO UPDATE SET
            brand_name = EXCLUDED.brand_name,
            logo_url = EXCLUDED.logo_url,
            support_email = EXCLUDED.support_email,
            accent_color = EXCLUDED.accent_color,
            updated_at = now()
        """,
        (org_id, brand_name, logo_url, support_email, accent_color),
    )
    return await get_settings(org_id)
