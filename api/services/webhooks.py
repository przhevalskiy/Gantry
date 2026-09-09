"""Webhook delivery — sign, fire, retry."""
import asyncio
import hashlib
import hmac
import json
import time

import httpx
import structlog

from api.config import WEBHOOK_SECRET_PATH, GANTRY_HOME

log = structlog.get_logger(__name__)

_MAX_RETRIES = 3
_RETRY_DELAYS = [2, 5, 10]


def _get_or_create_secret() -> str:
    import secrets as _secrets
    GANTRY_HOME.mkdir(parents=True, exist_ok=True)
    if not WEBHOOK_SECRET_PATH.exists():
        WEBHOOK_SECRET_PATH.write_text(_secrets.token_hex(32))
    return WEBHOOK_SECRET_PATH.read_text().strip()


def _sign(payload_bytes: bytes) -> str:
    secret = _get_or_create_secret()
    sig = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


async def fire_webhook(
    url: str,
    event: str,
    payload: dict,
    *,
    secret: str | None = None,
) -> bool:
    """Fire a signed webhook. Returns True on success."""
    body = json.dumps({"event": event, **payload}).encode()
    if secret:
        sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        signature = f"sha256={sig}"
    else:
        signature = _sign(body)
    headers = {
        "Content-Type": "application/json",
        "X-Gantry-Event": event,
        "X-Gantry-Signature": signature,
        "X-Gantry-Timestamp": str(int(time.time())),
    }

    for attempt, delay in enumerate([0] + _RETRY_DELAYS[:_MAX_RETRIES - 1]):
        if delay:
            await asyncio.sleep(delay)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, content=body, headers=headers)
            if resp.status_code < 300:
                log.info("webhook_delivered", url=url, lifecycle_event=event, attempt=attempt + 1)
                return True
            log.warning("webhook_non_2xx", url=url, status=resp.status_code, attempt=attempt + 1)
        except Exception as exc:
            log.warning("webhook_error", url=url, error=str(exc), attempt=attempt + 1)

    log.error("webhook_failed_all_retries", url=url, lifecycle_event=event)
    return False
