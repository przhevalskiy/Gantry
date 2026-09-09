from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from api.deps import require_any_scope, require_scope
from api.repositories import projects as projects_repo
from api.services.project_files import project_root, resolve_project_file, walk_project_files

router = APIRouter(prefix="/v1/projects", tags=["Projects"])


class CreateProjectRequest(BaseModel):
    name: str
    github_url: str | None = None
    linear_team_id: str | None = None
    jira_project_key: str | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    github_url: str | None = None
    linear_team_id: str | None = None
    jira_project_key: str | None = None


class WriteProjectFileRequest(BaseModel):
    path: str
    content: str


@router.get("")
async def list_projects(key: dict = Depends(require_any_scope("projects:read", "projects:write"))):
    projects = await projects_repo.list_projects(org_id=key["org_id"])
    return {"projects": projects}


@router.get("/{project_id}")
async def get_project(project_id: str, key: dict = Depends(require_any_scope("projects:read", "projects:write"))):
    project = await projects_repo.get_project(project_id, org_id=key["org_id"])
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    return {"project": project}


@router.post("", status_code=201)
async def create_project(body: CreateProjectRequest, key: dict = Depends(require_scope("projects:write"))):
    try:
        project = await projects_repo.create_project(
            body.name,
            org_id=key["org_id"],
            user_id="api",
            github_url=body.github_url,
            linear_team_id=body.linear_team_id,
            jira_project_key=body.jira_project_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"project": project}


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    body: UpdateProjectRequest,
    key: dict = Depends(require_scope("projects:write")),
):
    project = await projects_repo.update_project(
        project_id,
        org_id=key["org_id"],
        name=body.name,
        github_url=body.github_url,
        linear_team_id=body.linear_team_id,
        jira_project_key=body.jira_project_key,
    )
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    return {"project": project}


@router.get("/{project_id}/files/tree")
async def project_files_tree(
    project_id: str,
    key: dict = Depends(require_any_scope("projects:read", "projects:write")),
):
    """Return workspace file paths for a hubspace (local repo_path)."""
    project = await projects_repo.get_project(project_id, org_id=key["org_id"])
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    root = project_root(project)
    return JSONResponse({"files": walk_project_files(root), "source": "workspace"})


@router.get("/{project_id}/files/content")
async def project_files_content(
    project_id: str,
    path: str = Query(..., min_length=1),
    key: dict = Depends(require_any_scope("projects:read", "projects:write")),
):
    """Return a single file from the hubspace workspace."""
    project = await projects_repo.get_project(project_id, org_id=key["org_id"])
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    target = resolve_project_file(project, path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    try:
        content = target.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return JSONResponse({"path": path, "content": content, "source": "workspace"})


@router.put("/{project_id}/files/content")
async def project_files_write(
    project_id: str,
    body: WriteProjectFileRequest,
    key: dict = Depends(require_scope("projects:write")),
):
    """Write a file in the hubspace workspace (IDE save)."""
    project = await projects_repo.get_project(project_id, org_id=key["org_id"])
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    target = resolve_project_file(project, body.path)
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        target.write_text(body.content, encoding="utf-8")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return JSONResponse({"path": body.path, "ok": True, "source": "workspace"})


@router.get("/{project_id}/memory")
async def get_project_memory(project_id: str, key: dict = Depends(require_any_scope("projects:read", "projects:write"))):
    """Return durable memory (facts + episodes) for a project."""
    from fastapi.responses import JSONResponse
    import json
    from pathlib import Path

    project = await projects_repo.get_project(project_id, org_id=key["org_id"])
    if not project:
        raise HTTPException(status_code=404, detail="project not found")

    repo_path = project.get("repo_path")
    if not repo_path:
        raise HTTPException(status_code=404, detail="project has no repo path")

    mem_dir = Path(repo_path) / ".gantry" / "memory"
    facts: dict = {}
    facts_path = mem_dir / "facts.json"
    if facts_path.exists():
        try:
            facts = json.loads(facts_path.read_text())
        except Exception:
            facts = {}

    episodes: list = []
    episodes_total = 0
    episodes_path = mem_dir / "episodes.jsonl"
    if episodes_path.exists():
        try:
            all_eps = [
                json.loads(line)
                for line in episodes_path.read_text().splitlines()
                if line.strip()
            ]
            episodes_total = len(all_eps)
            episodes = list(reversed(all_eps[-20:]))
        except Exception:
            episodes = []

    return JSONResponse({
        "project_id": project_id,
        "repo_path": repo_path,
        "facts": facts,
        "episodes": episodes,
        "facts_count": len(facts),
        "episodes_count": episodes_total,
    })
