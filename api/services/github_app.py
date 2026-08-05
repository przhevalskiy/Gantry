"""GitHub App authentication — JWT minting and installation access tokens."""
from __future__ import annotations

import time
from typing import Any

import httpx
import jwt
import structlog

from api.config import (
    GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_SLUG,
)

log = structlog.get_logger(__name__)

_GITHUB_API = "https://api.github.com"
_token_cache: dict[int, tuple[str, float]] = {}


def is_configured() -> bool:
    return bool(GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY)


def _private_key_pem() -> str:
    key = GITHUB_APP_PRIVATE_KEY
    if "\\n" in key:
        key = key.replace("\\n", "\n")
    return key


def create_app_jwt(*, now: int | None = None) -> str:
    """Create a short-lived JWT for GitHub App authentication."""
    if not is_configured():
        raise RuntimeError("GitHub App is not configured (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY)")

    issued_at = now or int(time.time())
    payload = {
        "iat": issued_at - 60,
        "exp": issued_at + 600,
        "iss": GITHUB_APP_ID,
    }
    return jwt.encode(payload, _private_key_pem(), algorithm="RS256")


def install_url(state: str) -> str:
    slug = GITHUB_APP_SLUG or "gantry"
    return f"https://github.com/apps/{slug}/installations/new?state={state}"


async def fetch_installation(installation_id: int) -> dict[str, Any]:
    app_jwt = create_app_jwt()
    async with httpx.AsyncClient(base_url=_GITHUB_API, timeout=15) as client:
        resp = await client.get(
            f"/app/installations/{installation_id}",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_installation_token(installation_id: int) -> str:
    """Return a cached installation access token (valid ~1 hour on GitHub)."""
    cached = _token_cache.get(installation_id)
    if cached and cached[1] > time.time() + 60:
        return cached[0]

    app_jwt = create_app_jwt()
    async with httpx.AsyncClient(base_url=_GITHUB_API, timeout=15) as client:
        resp = await client.post(
            f"/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    token = data["token"]
    expires_at = data.get("expires_at")
    expiry_ts = time.time() + 3500
    if expires_at:
        from datetime import datetime, timezone

        try:
            expiry_ts = datetime.fromisoformat(expires_at.replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass

    _token_cache[installation_id] = (token, expiry_ts)
    log.debug("github_installation_token_minted", installation_id=installation_id)
    return token
