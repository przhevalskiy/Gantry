from fastapi import Depends, Header, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.config import GANTRY_BOOTSTRAP_TOKEN
from api.repositories import keys as keys_repo

_bearer = HTTPBearer(auto_error=False)

VALID_SCOPES = frozenset({
    "admin",
    "tasks:read",
    "tasks:write",
    "projects:read",
    "projects:write",
    "secrets:read",
    "secrets:write",
})


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


async def require_api_key(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")
    record = await keys_repo.authenticate(credentials.credentials)
    if not record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return record


async def require_admin_key(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
    x_gantry_bootstrap_token: str | None = Header(default=None, alias="X-Gantry-Bootstrap-Token"),
) -> dict | None:
    """Admin key required unless bootstrapping the first key."""
    if not await keys_repo.has_any_key():
        if GANTRY_BOOTSTRAP_TOKEN and x_gantry_bootstrap_token != GANTRY_BOOTSTRAP_TOKEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bootstrap token required to create the first API key",
            )
        return None

    if x_gantry_bootstrap_token and GANTRY_BOOTSTRAP_TOKEN and x_gantry_bootstrap_token == GANTRY_BOOTSTRAP_TOKEN:
        return None

    key = await require_api_key(credentials)
    scopes = key.get("scopes") or []
    if "admin" not in scopes:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin scope required")
    return key


def require_scope(scope: str):
    async def _checker(key: dict = Depends(require_api_key)) -> dict:
        scopes = key.get("scopes") or []
        if scope not in scopes and "admin" not in scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{scope} scope required",
            )
        return key

    return _checker


def require_any_scope(*scopes: str):
    async def _checker(key: dict = Depends(require_api_key)) -> dict:
        key_scopes = set(key.get("scopes") or [])
        if "admin" in key_scopes:
            return key
        if not key_scopes.intersection(scopes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"one of {', '.join(scopes)} scopes required",
            )
        return key

    return _checker
