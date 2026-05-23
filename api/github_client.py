"""Thin GitHub REST API client for posting issue comments."""
import httpx
import structlog

from api.config import GH_TOKEN

log = structlog.get_logger(__name__)

_BASE = "https://api.github.com"


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def post_issue_comment(owner: str, repo: str, issue_number: int, body: str, token: str = "") -> bool:
    tok = token or GH_TOKEN
    if not tok:
        log.warning("github_no_token", owner=owner, repo=repo)
        return False
    async with httpx.AsyncClient(base_url=_BASE, timeout=10) as client:
        resp = await client.post(
            f"/repos/{owner}/{repo}/issues/{issue_number}/comments",
            json={"body": body},
            headers=_headers(tok),
        )
        if not resp.is_success:
            log.warning("github_comment_failed", status=resp.status_code, detail=resp.text[:200])
            return False
    return True
