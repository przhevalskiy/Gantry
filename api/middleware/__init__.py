"""Rate limit + audit middleware for the Gantry API."""
from __future__ import annotations

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from api.middleware import rate_limit as rate_limiter
from api.repositories import keys as keys_repo

log = structlog.get_logger(__name__)

_SKIP_PREFIXES = ("/health", "/status", "/docs", "/redoc", "/openapi.json")
_SKIP_EXACT = {"/v1/tasks/"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith(_SKIP_PREFIXES) or any(
            path.startswith(p) and path.endswith("/source") for p in ("/v1/tasks/",)
        ):
            return await call_next(request)

        org_id: str | None = None
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            record = await keys_repo.authenticate(token)
            if record:
                org_id = record["org_id"]
                request.state.api_key = record

        if org_id:
            allowed, limit = await rate_limiter.check_rate_limit(org_id)
            if not allowed:
                log.warning("rate_limit_exceeded", org_id=org_id, path=path)
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Rate limit exceeded — {limit} requests/minute per org",
                        "limit": limit,
                    },
                    headers={"Retry-After": "60"},
                )

        return await call_next(request)
