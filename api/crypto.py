"""Encrypt/decrypt org secrets at rest."""
from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken

from api.config import GANTRY_SECRETS_KEY


def _fernet() -> Fernet:
    raw = GANTRY_SECRETS_KEY.strip()
    if raw:
        key = raw.encode() if isinstance(raw, str) else raw
        return Fernet(key)
    # Dev-only fallback — never use in production
    derived = base64.urlsafe_b64encode(hashlib.sha256(b"gantry-dev-secrets-v1").digest())
    return Fernet(derived)


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt secret — check GANTRY_SECRETS_KEY") from exc
