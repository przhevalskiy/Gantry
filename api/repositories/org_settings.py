from __future__ import annotations

import json
from pathlib import Path

from api import db


def _file_settings_path() -> Path:
    import os

    return Path(os.getenv("GANTRY_HOME", str(Path.home() / ".gantry"))) / "org_settings.json"


def _load_file_settings(org_id: str) -> dict:
    path = _file_settings_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except Exception:
        return {}
    return data.get(org_id, {})


def _save_file_settings(org_id: str, settings: dict) -> None:
    path = _file_settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if path.exists():
        try:
            data = json.loads(path.read_text())
        except Exception:
            data = {}
    data[org_id] = settings
    path.write_text(json.dumps(data, indent=2))


def _defaults(org_id: str) -> dict:
    return {
        "org_id": org_id,
        "brand_name": "Gantry",
        "accent_color": "#f97316",
        "llm_provider": "anthropic",
        "llm_api_key_secret": None,
        "llm_sonnet_model": None,
        "llm_haiku_model": None,
        "llm_openai_base_url": None,
    }


async def get_settings(org_id: str) -> dict:
    if not db.is_available():
        stored = _load_file_settings(org_id)
        return {**_defaults(org_id), **stored}

    row = await db.fetch_one("SELECT * FROM org_settings WHERE org_id = %s", (org_id,))
    if not row:
        return _defaults(org_id)
    return {
        "org_id": str(row["org_id"]),
        "brand_name": row.get("brand_name") or "Gantry",
        "logo_url": row.get("logo_url"),
        "support_email": row.get("support_email"),
        "accent_color": row.get("accent_color") or "#f97316",
        "llm_provider": row.get("llm_provider") or "anthropic",
        "llm_api_key_secret": row.get("llm_api_key_secret"),
        "llm_sonnet_model": row.get("llm_sonnet_model"),
        "llm_haiku_model": row.get("llm_haiku_model"),
        "llm_openai_base_url": row.get("llm_openai_base_url"),
    }


async def update_settings(org_id: str, **kwargs) -> dict:
    if not db.is_available():
        current = {**_defaults(org_id), **_load_file_settings(org_id), **kwargs}
        _save_file_settings(org_id, current)
        return current

    current = await get_settings(org_id)
    merged = {**current, **{k: v for k, v in kwargs.items() if v is not None or k.startswith("llm_")}}

    await db.execute(
        """
        INSERT INTO org_settings (
            org_id, brand_name, logo_url, support_email, accent_color,
            llm_provider, llm_api_key_secret, llm_sonnet_model, llm_haiku_model, llm_openai_base_url
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (org_id) DO UPDATE SET
            brand_name = EXCLUDED.brand_name,
            logo_url = EXCLUDED.logo_url,
            support_email = EXCLUDED.support_email,
            accent_color = EXCLUDED.accent_color,
            llm_provider = EXCLUDED.llm_provider,
            llm_api_key_secret = EXCLUDED.llm_api_key_secret,
            llm_sonnet_model = EXCLUDED.llm_sonnet_model,
            llm_haiku_model = EXCLUDED.llm_haiku_model,
            llm_openai_base_url = EXCLUDED.llm_openai_base_url,
            updated_at = now()
        """,
        (
            org_id,
            merged.get("brand_name"),
            merged.get("logo_url"),
            merged.get("support_email"),
            merged.get("accent_color"),
            merged.get("llm_provider"),
            merged.get("llm_api_key_secret"),
            merged.get("llm_sonnet_model"),
            merged.get("llm_haiku_model"),
            merged.get("llm_openai_base_url"),
        ),
    )
    return await get_settings(org_id)
