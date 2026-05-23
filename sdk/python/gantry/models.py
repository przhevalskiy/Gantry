from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal, Optional, Union

TaskStatus = Literal[
    "queued", "running", "waiting_approval",
    "completed", "failed", "cancelled", "terminated", "timeout",
]


@dataclass
class Task:
    task_id: str
    status: TaskStatus
    project_id: Optional[str] = None
    source: Optional[str] = None
    pr_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @property
    def is_done(self) -> bool:
        return self.status in ("completed", "failed", "cancelled", "terminated", "timeout")

    @property
    def succeeded(self) -> bool:
        return self.status == "completed"


@dataclass
class BulkResult:
    goal: str
    task_id: Optional[str] = None
    status: Optional[str] = None
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        return self.task_id is not None


@dataclass
class BulkResponse:
    project_id: str
    submitted: int
    failed: int
    results: list[BulkResult]


@dataclass
class Project:
    id: str
    name: str
    github_url: Optional[str] = None
    github_owner: Optional[str] = None
    github_repo: Optional[str] = None
    created_at: Optional[str] = None
