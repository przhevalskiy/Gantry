from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

import httpx

from api.config import GANTRY_UI_URL
from api.deps import require_api_key

router = APIRouter(prefix="/v1/projects", tags=["Projects"])

_UI_PROJECTS = f"{GANTRY_UI_URL}/api/projects"


class CreateProjectRequest(BaseModel):
    name: str
    github_url: str | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    github_url: str | None = None


async def _proxy_get(path: str = "") -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{_UI_PROJECTS}{path}")
        resp.raise_for_status()
        return resp.json()


async def _proxy_post(body: dict) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(_UI_PROJECTS, json=body)
        if resp.status_code == 422:
            raise HTTPException(status_code=422, detail=resp.json())
        resp.raise_for_status()
        return resp.json()


async def _proxy_patch(body: dict) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.patch(_UI_PROJECTS, json=body)
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail="project not found")
        if resp.status_code == 422:
            raise HTTPException(status_code=422, detail=resp.json())
        resp.raise_for_status()
        return resp.json()


@router.get("")
async def list_projects(_key: dict = Depends(require_api_key)):
    return await _proxy_get()


@router.get("/{project_id}")
async def get_project(project_id: str, _key: dict = Depends(require_api_key)):
    data = await _proxy_get()
    projects = data.get("projects", [])
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    return {"project": project}


@router.post("", status_code=201)
async def create_project(body: CreateProjectRequest, _key: dict = Depends(require_api_key)):
    payload = {"name": body.name}
    if body.github_url:
        payload["github_url"] = body.github_url
    return await _proxy_post(payload)


@router.patch("/{project_id}")
async def update_project(project_id: str, body: UpdateProjectRequest, _key: dict = Depends(require_api_key)):
    payload: dict = {"id": project_id}
    if body.name is not None:
        payload["name"] = body.name
    if body.github_url is not None:
        payload["github_url"] = body.github_url
    return await _proxy_patch(payload)


@router.get("/{project_id}/memory")
async def get_project_memory(project_id: str, _key: dict = Depends(require_api_key)):
    """Return the durable memory (facts + recent episodes) for a project."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{_UI_PROJECTS}/{project_id}/memory")
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail="project not found")
        resp.raise_for_status()
        return resp.json()
