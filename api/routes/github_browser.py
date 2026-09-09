"""GitHub repo browser — list repos and read files for linked hubspaces."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from api.clients import github as github_client
from api.deps import require_any_scope
from api.repositories import projects as projects_repo
from api.services import github_tokens

router = APIRouter(prefix="/v1/github", tags=["GitHub Browser"])


class ListReposRequest(BaseModel):
    q: str = ""
    page: int = 1
    per_page: int = 30
    github_token: str | None = None


async def _resolve_browse_token(
    org_id: str,
    project: dict | None,
    header_token: str | None,
    body_token: str | None,
) -> str:
    token = (body_token or header_token or "").strip()
    if token:
        return token
    return await github_tokens.resolve_token(org_id=org_id, project=project)


async def _project(org_id: str, project_id: str) -> dict:
    project = await projects_repo.get_project(project_id, org_id=org_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    return project


@router.get("/repos")
async def list_repos(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
    project_id: str | None = Query(default=None),
    x_github_token: str | None = Header(default=None, alias="X-Github-Token"),
    key: dict = Depends(require_any_scope("projects:read", "projects:write")),
):
    """List GitHub repos accessible to the org or user PAT."""
    project = await _project(key["org_id"], project_id) if project_id else None
    token = await _resolve_browse_token(key["org_id"], project, x_github_token, None)
    if not token:
        raise HTTPException(
            status_code=503,
            detail="GitHub token not configured — set GH_TOKEN, org secret, or X-Github-Token",
        )
    try:
        repos = await github_client.list_user_repos(token, q=q, page=page, per_page=per_page)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"repos": repos}


@router.post("/repos/search")
async def search_repos(
    body: ListReposRequest,
    x_github_token: str | None = Header(default=None, alias="X-Github-Token"),
    key: dict = Depends(require_any_scope("projects:read", "projects:write")),
):
    """List/search repos using optional user PAT in body or header."""
    token = await _resolve_browse_token(key["org_id"], None, x_github_token, body.github_token)
    if not token:
        raise HTTPException(status_code=503, detail="GitHub token not configured")
    try:
        repos = await github_client.list_user_repos(
            token, q=body.q, page=body.page, per_page=body.per_page,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"repos": repos}


@router.get("/projects/{project_id}/tree")
async def github_project_tree(
    project_id: str,
    branch: str = Query(default="main"),
    key: dict = Depends(require_any_scope("projects:read", "projects:write")),
):
    project = await _project(key["org_id"], project_id)
    owner = project.get("github_owner")
    repo = project.get("github_repo")
    if not owner or not repo:
        raise HTTPException(status_code=422, detail="hubspace has no linked GitHub repo")
    token = await github_tokens.resolve_token(org_id=key["org_id"], project=project)
    if not token:
        raise HTTPException(status_code=503, detail="GitHub token not configured")
    try:
        files = await github_client.get_repo_tree(owner, repo, token, branch=branch)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"files": files, "branch": branch}


@router.get("/projects/{project_id}/file")
async def github_project_file(
    project_id: str,
    path: str = Query(..., min_length=1),
    branch: str = Query(default="main"),
    key: dict = Depends(require_any_scope("projects:read", "projects:write")),
):
    project = await _project(key["org_id"], project_id)
    owner = project.get("github_owner")
    repo = project.get("github_repo")
    if not owner or not repo:
        raise HTTPException(status_code=422, detail="hubspace has no linked GitHub repo")
    token = await github_tokens.resolve_token(org_id=key["org_id"], project=project)
    if not token:
        raise HTTPException(status_code=503, detail="GitHub token not configured")
    try:
        content = await github_client.get_repo_file_content(
            owner, repo, path.lstrip("/"), token, branch=branch,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"path": path, "content": content, "branch": branch}
