from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.deps import require_any_scope, require_scope
from api.repositories import projects as projects_repo

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
