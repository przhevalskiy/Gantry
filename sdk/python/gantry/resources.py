from __future__ import annotations
import time
from typing import Optional
from .models import Task, Project, BulkResult, BulkResponse
from ._http import HttpClient


def _task(data: dict) -> Task:
    return Task(
        task_id=data["task_id"],
        status=data.get("status", "queued"),
        project_id=data.get("project_id"),
        source=data.get("source"),
        pr_url=data.get("pr_url"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
    )


def _project(data: dict) -> Project:
    p = data.get("project", data)
    return Project(
        id=p["id"],
        name=p["name"],
        github_url=p.get("github_url"),
        github_owner=p.get("github_owner"),
        github_repo=p.get("github_repo"),
        created_at=p.get("created_at"),
    )


class Tasks:
    def __init__(self, http: HttpClient):
        self._http = http

    def submit(
        self,
        goal: str,
        project_id: str,
        *,
        branch_prefix: str = "swarm",
        tier: int = -1,
        github_token: Optional[str] = None,
        webhook_url: Optional[str] = None,
    ) -> Task:
        payload: dict = {
            "goal": goal,
            "project_id": project_id,
            "branch_prefix": branch_prefix,
            "tier": tier,
        }
        if github_token:
            payload["github_token"] = github_token
        if webhook_url:
            payload["webhook_url"] = webhook_url
        data = self._http.post("/v1/tasks", json=payload)
        return _task(data)

    def get(self, task_id: str) -> Task:
        data = self._http.get(f"/v1/tasks/{task_id}")
        return _task(data)

    def messages(self, task_id: str) -> list[dict]:
        data = self._http.get(f"/v1/tasks/{task_id}/messages")
        return data.get("messages", [])

    def wait(
        self,
        task_id: str,
        *,
        timeout: float = 1800.0,
        poll_interval: float = 10.0,
    ) -> Task:
        """Poll until terminal status or timeout. Raises TimeoutError on expiry."""
        deadline = time.monotonic() + timeout
        while True:
            task = self.get(task_id)
            if task.is_done:
                return task
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(f"Task {task_id} did not complete within {timeout}s")
            time.sleep(min(poll_interval, remaining))

    def terminate(self, task_id: str) -> None:
        self._http.delete(f"/v1/tasks/{task_id}")

    def bulk(
        self,
        goals: list[str],
        project_id: str,
        *,
        branch_prefix: str = "swarm",
        tier: int = -1,
        github_token: Optional[str] = None,
        webhook_url: Optional[str] = None,
    ) -> BulkResponse:
        """Submit up to 50 tasks in parallel. Returns partial results on failure."""
        payload: dict = {
            "project_id": project_id,
            "tasks": [{"goal": g} for g in goals],
            "branch_prefix": branch_prefix,
            "tier": tier,
        }
        if github_token:
            payload["github_token"] = github_token
        if webhook_url:
            payload["webhook_url"] = webhook_url
        data = self._http.post("/v1/tasks/bulk", json=payload)
        results = [
            BulkResult(
                goal=r["goal"],
                task_id=r.get("task_id"),
                status=r.get("status"),
                error=r.get("error"),
            )
            for r in data.get("results", [])
        ]
        return BulkResponse(
            project_id=data["project_id"],
            submitted=data["submitted"],
            failed=data["failed"],
            results=results,
        )

    def approve(self, task_id: str, *, workflow_id: Optional[str] = None) -> None:
        self._http.post(f"/v1/tasks/{task_id}/approve", json={
            "workflow_id": workflow_id or task_id,
            "approved": True,
        })


class Projects:
    def __init__(self, http: HttpClient):
        self._http = http

    def list(self) -> list[Project]:
        data = self._http.get("/v1/projects")
        return [_project({"project": p}) for p in data.get("projects", [])]

    def get(self, project_id: str) -> Project:
        data = self._http.get(f"/v1/projects/{project_id}")
        return _project(data)

    def create(self, name: str, *, github_url: Optional[str] = None) -> Project:
        payload: dict = {"name": name}
        if github_url:
            payload["github_url"] = github_url
        data = self._http.post("/v1/projects", json=payload)
        return _project(data)

    def update(self, project_id: str, *, name: Optional[str] = None, github_url: Optional[str] = None) -> Project:
        payload: dict = {}
        if name is not None:
            payload["name"] = name
        if github_url is not None:
            payload["github_url"] = github_url
        data = self._http.patch(f"/v1/projects/{project_id}", json=payload)
        return _project(data)
