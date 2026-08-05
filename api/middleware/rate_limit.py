"""In-memory sliding-window rate limiter per org."""
from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque

from api.repositories.quotas import DEFAULT_REQUESTS_PER_MINUTE, get_quotas

_lock = asyncio.Lock()
_windows: dict[str, deque[float]] = defaultdict(deque)


async def check_rate_limit(org_id: str) -> tuple[bool, int]:
    """Return (allowed, limit). Uses org quota or default."""
    quotas = await get_quotas(org_id)
    limit = quotas.requests_per_minute or DEFAULT_REQUESTS_PER_MINUTE
    now = time.monotonic()
    window_start = now - 60.0

    async with _lock:
        bucket = _windows[org_id]
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= limit:
            return False, limit
        bucket.append(now)
        return True, limit


def reset() -> None:
    """Test helper."""
    _windows.clear()
