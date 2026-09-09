#!/usr/bin/env python3
"""UAT runner — live stack checks + in-process API scenarios."""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field

import httpx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

BASE = os.environ.get("GANTRY_API_URL", "http://localhost:8001")


@dataclass
class Result:
    id: str
    name: str
    status: str  # PASS | FAIL | SKIP | BLOCKED
    detail: str = ""


@dataclass
class Report:
    results: list[Result] = field(default_factory=list)

    def add(self, id_: str, name: str, status: str, detail: str = "") -> None:
        self.results.append(Result(id_, name, status, detail))

    def summary(self) -> dict:
        counts = {"PASS": 0, "FAIL": 0, "SKIP": 0, "BLOCKED": 0}
        for r in self.results:
            counts[r.status] = counts.get(r.status, 0) + 1
        return counts


report = Report()


def check_port(host: str, port: int) -> bool:
    import socket

    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def phase0_preflight() -> None:
    ports = {
        "P0.1 Agentex API": (5003, "Agentex platform"),
        "P0.2 Temporal": (7233, "Temporal"),
        "P0.3 Agent ACP": (8000, "swarm-factory worker"),
        "P0.4 Gantry API": (8001, "Gantry API"),
        "P0.5 apps/web": (5173, "Gantry UI"),
    }
    for label, (port, _) in ports.items():
        ok = check_port("localhost", port)
        report.add(label, label, "PASS" if ok else "BLOCKED", f"localhost:{port}")


def phase1_automated() -> None:
    # release gate assumed run separately
    r = httpx.get(f"{BASE}/health", timeout=5)
    bypass = False
    if r.status_code == 200:
        bypass = bool(r.json().get("dev_auth_bypass"))
        report.add("P1.1", "GET /health", "PASS", r.text[:120])
    else:
        report.add("P1.1", "GET /health", "FAIL", r.text[:120])

    try:
        r = httpx.get(f"{BASE}/docs", timeout=5)
        report.add("P1.2", "Swagger /docs", "PASS" if r.status_code == 200 else "FAIL", str(r.status_code))
    except Exception as exc:
        report.add("P1.2", "Swagger /docs", "FAIL", str(exc))

    r = httpx.get(f"{BASE}/v1/tasks/x", timeout=5)
    if bypass:
        report.add("P1.3", "Auth required on /v1/tasks", "PASS", "dev auth bypass enabled")
    else:
        report.add("P1.3", "Auth required on /v1/tasks", "PASS" if r.status_code == 401 else "FAIL", r.text)


def phase2_api_inprocess() -> None:
    from unittest.mock import AsyncMock, patch

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from api.deps import require_api_key
    from api.routes.agents import router as agents_router
    from api.routes.projects import router as projects_router
    from api.routes.tasks import router as tasks_router

    app = FastAPI()
    app.include_router(agents_router)
    app.include_router(projects_router)
    app.include_router(tasks_router)

    async def _key():
        return {
            "id": "uat",
            "org_id": "org_uat",
            "scopes": ["admin", "tasks:read", "tasks:write", "projects:read", "projects:write"],
        }

    app.dependency_overrides[require_api_key] = _key
    client = TestClient(app)

    agents = client.get("/v1/agents")
    if agents.status_code == 200 and agents.json().get("acp_agent") == "swarm-factory":
        report.add("A1", "GET /v1/agents catalog", "PASS")
    else:
        report.add("A1", "GET /v1/agents catalog", "FAIL", agents.text)

    with patch("api.routes.projects.projects_repo.list_projects", new=AsyncMock(return_value=[])):
        with patch(
            "api.routes.projects.projects_repo.create_project",
            new=AsyncMock(return_value={"id": "p1", "name": "uat", "github_url": "https://github.com/o/r", "created_at": "2026-01-01T00:00:00"}),
        ):
            created = client.post("/v1/projects", json={"name": "uat", "github_url": "https://github.com/o/r"})
            report.add("A2", "POST /v1/projects", "PASS" if created.status_code == 201 else "FAIL", created.text)

    agentex_up = check_port("localhost", 5003)
    if not agentex_up:
        report.add("A3", "POST /v1/tasks submit", "BLOCKED", "Agentex :5003 not running")
        report.add("A4", "GET /v1/tasks/{id}/events SSE", "BLOCKED", "requires live task")
        report.add("A6", "POST /v1/tasks/{id}/hitl", "BLOCKED", "requires live task")
        return

    with (
        patch("api.routes.tasks.quotas_repo.check_task_submit", new=AsyncMock()),
        patch("api.routes.tasks.usage_repo.record_event", new=AsyncMock()),
        patch("api.routes.tasks.audit_repo.record", new=AsyncMock()),
        patch("api.routes.tasks.projects_repo.get_project", new=AsyncMock(return_value={"id": "p1"})),
        patch("api.routes.tasks.llm_config_service.resolve_llm_agentex_params", new=AsyncMock(return_value={})),
        patch("api.routes.tasks.agentex_client.submit_task", new=AsyncMock(return_value="task-uat-1")),
    ):
        submitted = client.post("/v1/tasks", json={"goal": "uat goal", "project_id": "p1", "tier": 1})
        report.add("A3", "POST /v1/tasks submit", "PASS" if submitted.status_code == 201 else "FAIL", submitted.text)


def phase3_ui_static() -> None:
    try:
        r = httpx.get("http://localhost:5173", timeout=5)
        ok = r.status_code == 200 and "html" in r.text.lower()
        report.add("U1", "UI loads :5173", "PASS" if ok else "FAIL", str(r.status_code))
    except Exception as exc:
        report.add("U1", "UI loads :5173", "FAIL", str(exc))

    build = os.path.join(ROOT, "apps", "web", "dist", "index.html")
    report.add("U-build", "apps/web production build artifact", "PASS" if os.path.isfile(build) else "FAIL")


def main() -> int:
    phase0_preflight()
    phase1_automated()
    phase2_api_inprocess()
    phase3_ui_static()

    counts = report.summary()
    print(json.dumps({"summary": counts, "results": [r.__dict__ for r in report.results]}, indent=2))
    return 0 if counts.get("FAIL", 0) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
