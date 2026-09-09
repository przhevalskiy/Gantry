"""Thin GitHub REST API client for posting issue comments."""
import httpx
import structlog

from api.config import GH_TOKEN

log = structlog.get_logger(__name__)

_BASE = "https://api.github.com"
_SKIP = {".git", "node_modules", ".next", "dist", "build", "__pycache__", ".venv", "coverage", ".gantry"}


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def list_user_repos(
    token: str,
    *,
    q: str = "",
    page: int = 1,
    per_page: int = 30,
) -> list[dict]:
    """List or search repos accessible to the token."""
    if not token:
        return []
    params: dict = {"per_page": per_page, "page": page}
    if q:
        url = "/search/repositories"
        params["q"] = f"{q} user:@me"
        params["sort"] = "updated"
    else:
        url = "/user/repos"
        params["sort"] = "pushed"
        params["affiliation"] = "owner,collaborator,organization_member"
    async with httpx.AsyncClient(base_url=_BASE, timeout=20) as client:
        resp = await client.get(url, params=params, headers=_headers(token))
        resp.raise_for_status()
        data = resp.json()
    repos = data.get("items", data) if q else data
    return [
        {
            "id": r.get("id"),
            "full_name": r.get("full_name"),
            "name": r.get("name"),
            "owner": (r.get("owner") or {}).get("login"),
            "private": r.get("private"),
            "description": r.get("description"),
            "html_url": r.get("html_url"),
            "clone_url": r.get("clone_url"),
            "default_branch": r.get("default_branch") or "main",
            "pushed_at": r.get("pushed_at"),
            "language": r.get("language"),
        }
        for r in repos
    ]


async def get_repo_tree(
    owner: str,
    repo: str,
    token: str,
    *,
    branch: str = "main",
) -> list[str]:
    if not token:
        return []
    async with httpx.AsyncClient(base_url=_BASE, timeout=20) as client:
        resp = await client.get(
            f"/repos/{owner}/{repo}/git/trees/{branch}",
            params={"recursive": "1"},
            headers=_headers(token),
        )
        if resp.status_code == 404:
            ref = await client.get(
                f"/repos/{owner}/{repo}/git/ref/heads/{branch}",
                headers=_headers(token),
            )
            if not ref.is_success:
                return []
            sha = ref.json().get("object", {}).get("sha")
            if not sha:
                return []
            resp = await client.get(
                f"/repos/{owner}/{repo}/git/trees/{sha}",
                params={"recursive": "1"},
                headers=_headers(token),
            )
        resp.raise_for_status()
        data = resp.json()
    files: list[str] = []
    for item in data.get("tree", []):
        if item.get("type") != "blob":
            continue
        path = item.get("path", "")
        if not path or any(part in _SKIP for part in path.split("/")):
            continue
        if path.startswith("."):
            continue
        files.append(path)
    return sorted(files)


async def get_repo_file_content(
    owner: str,
    repo: str,
    path: str,
    token: str,
    *,
    branch: str = "main",
) -> str:
    if not token:
        raise RuntimeError("no github token")
    async with httpx.AsyncClient(base_url=_BASE, timeout=20) as client:
        resp = await client.get(
            f"/repos/{owner}/{repo}/contents/{path}",
            params={"ref": branch},
            headers=_headers(token),
        )
        resp.raise_for_status()
        data = resp.json()
    import base64

    raw = data.get("content", "")
    if data.get("encoding") == "base64" and raw:
        return base64.b64decode(raw).decode("utf-8", errors="replace")
    return str(raw)


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
