"""Signed state tokens for GitHub App install → org linking."""
from __future__ import annotations

import hashlib
import hmac
import secrets

from api.config import GANTRY_INSTALL_STATE_SECRET


def _secret() -> bytes:
    key = GANTRY_INSTALL_STATE_SECRET or "gantry-dev-install-state"
    return key.encode()


def sign_org_state(org_id: str) -> str:
    nonce = secrets.token_urlsafe(8)
    payload = f"{org_id}:{nonce}"
    sig = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{sig}.{payload}"


def verify_org_state(state: str) -> str | None:
    if not state or "." not in state:
        return None
    sig, payload = state.split(".", 1)
    expected = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expected):
        return None
    org_id, _nonce = payload.split(":", 1)
    return org_id
