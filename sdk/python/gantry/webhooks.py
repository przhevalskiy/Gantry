"""Verify Gantry webhook signatures."""
from __future__ import annotations

import hmac
import hashlib


def verify_webhook_signature(body: bytes, header: str, secret: str) -> bool:
    """Verify X-Gantry-Signature header against the webhook secret."""
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)
