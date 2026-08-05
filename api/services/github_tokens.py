"""Resolve GitHub credentials for tasks — App installation token or PAT fallback."""
from __future__ import annotations

import structlog
from fastapi import HTTPException

from api.config import GH_TOKEN
from api.repositories import github_installations as installations_repo
from api.repositories import secrets as secrets_repo
from api.services import github_app

log = structlog.get_logger(__name__)


async def resolve_token(
    *,
    org_id: str,
    project: dict | None = None,
    github_token: str | None = None,
    github_token_secret: str | None = None,
) -> str:
    """
    Resolve a GitHub token for clone/push/comment operations.

    Priority:
      1. Explicit github_token on the request
      2. Named org secret (github_token_secret)
      3. GitHub App installation token for the project's repo
      4. Global GH_TOKEN env var
    """
    if github_token:
        return github_token

    if github_token_secret:
        value = await secrets_repo.get_secret_value(org_id=org_id, name=github_token_secret)
        if not value:
            raise HTTPException(status_code=404, detail=f"secret not found: {github_token_secret}")
        return value

    owner = (project or {}).get("github_owner")
    repo = (project or {}).get("github_repo")
    if owner and repo and github_app.is_configured():
        installation = await installations_repo.find_for_repo(org_id, owner, repo)
        if installation:
            try:
                token = await github_app.get_installation_token(installation["installation_id"])
                log.debug(
                    "github_token_from_app",
                    installation_id=installation["installation_id"],
                    owner=owner,
                    repo=repo,
                )
                return token
            except Exception as exc:
                log.warning(
                    "github_app_token_failed",
                    installation_id=installation["installation_id"],
                    error=str(exc),
                )

    return GH_TOKEN
