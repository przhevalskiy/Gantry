import hashlib
import hmac
import os
import secrets


def generate_api_key() -> str:
    """Return a new plaintext API key. Store only the hash."""
    return "gantry_" + secrets.token_hex(32)


def hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode()).hexdigest()


def verify_key(plaintext: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_key(plaintext), stored_hash)
