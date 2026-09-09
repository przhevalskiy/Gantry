"""Agentex citizen catalog, L-levels, HITL audit fallback — no live Agentex/Temporal."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from project.schema.complexity import TIER_LEVELS, TIER_PARAMS, params_for_tier
from project.schema.crew import (
    CREW_AGENTS,
    FOREMAN_ACP_NAME,
    HITL_CHECKPOINTS,
    TIER_AUTONOMY,
    autonomy_for_tier,
    catalog_payload,
    get_agent,
    get_checkpoint,
    workflow_names,
)

ROOT = Path(__file__).resolve().parents[1]


def test_foreman_is_only_acp_entrypoint():
    acp = [a for a in CREW_AGENTS if a["entrypoint"] == "acp"]
    assert len(acp) == 1
    assert acp[0]["name"] == FOREMAN_ACP_NAME == "swarm-factory"
    assert acp[0]["workflow"] == "swarm-factory"
    children = [a for a in CREW_AGENTS if a["entrypoint"] == "temporal_child"]
    assert len(children) == len(CREW_AGENTS) - 1
    assert all(a["acp_name"] == FOREMAN_ACP_NAME for a in CREW_AGENTS)


def test_crew_names_and_workflows_unique():
    names = [a["name"] for a in CREW_AGENTS]
    workflows = [a["workflow"] for a in CREW_AGENTS]
    assert len(names) == len(set(names))
    assert len(workflows) == len(set(workflows))
    assert get_agent("gantry-builder")["workflow"] == "BuilderAgent"
    assert get_agent("missing") is None


def test_tier_maps_to_agentex_l_levels():
    assert TIER_LEVELS == {0: "L2", 1: "L3", 2: "L4", 3: "L5"}
    assert autonomy_for_tier(-1) is None
    assert autonomy_for_tier(2) == "L4"
    for tier, params in TIER_PARAMS.items():
        merged = params_for_tier(tier)
        assert merged["max_parallel_tracks"] == params["max_parallel_tracks"]
        assert merged["autonomy_level"] == TIER_AUTONOMY[tier]["level"]


def test_hitl_checkpoints_have_signals():
    ids = [c["id"] for c in HITL_CHECKPOINTS]
    assert ids == ["pm_clarification", "architect_plan", "max_heals", "devops"]
    assert get_checkpoint("architect_plan")["signal"] == "approve"
    assert get_checkpoint("pm_clarification")["signal"] == "submit"
    assert get_checkpoint("nope") is None
    assert TIER_AUTONOMY[3]["hitl"][-1] == "devops"


def test_catalog_payload_structured():
    payload = catalog_payload(agentex_base_url="http://agentex:5003")
    assert payload["orchestration"] == "temporal_children"
    assert payload["acp_agent"] == "swarm-factory"
    assert "task/create" in payload["acp"]["rpc_method"]
    assert FOREMAN_ACP_NAME in payload["acp"]["url"]
    assert len(payload["agents"]) == len(CREW_AGENTS)


def test_helm_agent_name_matches_acp():
    values = (ROOT / "deploy/helm/gantry/values.yaml").read_text()
    cmap = (ROOT / "deploy/helm/gantry/templates/configmap.yaml").read_text()
    assert "agentName: swarm-factory" in values
    assert "GANTRY_AGENT_NAME" in cmap
    assert "AGENT_NAME" in cmap
    text = (ROOT / "manifest.yaml").read_text()
    assert "acp_type: async" in text
    assert "name: swarm-factory" in text
    for wf in workflow_names():
        assert f"name: {wf}" in text


@pytest.mark.asyncio
async def test_audit_file_fallback_scoped(tmp_path, monkeypatch):
    monkeypatch.setenv("GANTRY_HOME", str(tmp_path / ".gantry"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    from api.repositories import audit as audit_repo

    await audit_repo.record(
        org_id="org_a",
        action="hitl.approve_plan",
        key_id="key_1",
        resource_type="task",
        resource_id="task_1",
        metadata={"checkpoint": "architect_plan"},
    )
    await audit_repo.record(
        org_id="org_b",
        action="hitl.approve_plan",
        resource_type="task",
        resource_id="task_2",
    )
    a = await audit_repo.list_entries(org_id="org_a", resource_id="task_1")
    assert len(a) == 1
    assert a[0]["action"] == "hitl.approve_plan"
    assert a[0]["metadata"]["checkpoint"] == "architect_plan"
    b = await audit_repo.list_entries(org_id="org_b")
    assert len(b) == 1
    assert b[0]["resource_id"] == "task_2"
    empty = await audit_repo.list_entries(org_id="org_a", action="task.submitted")
    assert empty == []
    path = tmp_path / ".gantry" / "audit.jsonl"
    assert path.exists()
    line = json.loads(path.read_text().splitlines()[0])
    assert line["org_id"] == "org_a"


def test_workflow_defn_names_match_catalog_and_worker():
    import re

    names: set[str] = set()
    for path in (ROOT / "workflows").rglob("*.py"):
        names.update(re.findall(r'@workflow\.defn\(name="([^"]+)"\)', path.read_text()))
    assert set(workflow_names()) == names
    worker = (ROOT / "worker.py").read_text()
    for cls in (
        "SwarmOrchestrator",
        "PMAgent",
        "ArchitectAgent",
        "BuilderAgent",
        "InspectorAgent",
        "ReviewerAgent",
        "SecurityAgent",
        "DevOpsAgent",
        "ApprovalWorkflow",
        "ClarificationWorkflow",
    ):
        assert cls in worker


def test_i7_foreman_composes_temporal_children_not_acp():
    text = (ROOT / "workflows" / "swarm_orchestrator.py").read_text()
    assert "execute_child_workflow" in text
    assert "task/create" not in text
    assert 'acp_type="async"' in (ROOT / "project" / "acp.py").read_text()
    assert 'acp_type="async"' in (ROOT / "project" / "schema" / "acp.py").read_text()


def test_sdk_and_docs_surfaces():
    py = (ROOT / "sdk" / "python" / "gantry" / "resources.py").read_text()
    assert "def hitl" in py
    assert "def stream_events" in py
    assert "class Agents" in py
    ts = (ROOT / "sdk" / "typescript" / "src" / "resources.ts").read_text()
    assert "async hitl" in ts
    assert "streamEvents" in ts
    assert "export class Agents" in ts
    assert "self.agents = Agents" in (ROOT / "sdk" / "python" / "gantry" / "client.py").read_text()
    readme = (ROOT / "README.md").read_text()
    assert "GET /v1/agents" in readme
    assert "L2" in readme and "L5" in readme
    assert "H-PAR" in readme
    api_md = (ROOT / "docs" / "api.md").read_text()
    assert "/v1/agents" in api_md
    assert "/hitl" in api_md
    assert not (ROOT / "ui").exists(), "legacy ui/ removed — use apps/web"
    web_readme = (ROOT / "apps" / "web" / "README.md").read_text()
    assert "SSE" in web_readme or "/v1/" in web_readme
    assert "client.agents" in (ROOT / "sdk" / "python" / "README.md").read_text()
    assert "hitl(" in (ROOT / "sdk" / "python" / "README.md").read_text()
    assert "stream_events" in (ROOT / "sdk" / "python" / "README.md").read_text()
    assert "client.agents" in (ROOT / "sdk" / "typescript" / "README.md").read_text()


def test_agents_and_hitl_routes_without_api_main():
    from unittest.mock import AsyncMock, patch

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from api.deps import require_api_key
    from api.routes.agents import router as agents_router
    from api.routes.tasks import router as tasks_router

    app = FastAPI()
    app.include_router(agents_router)
    app.include_router(tasks_router)

    async def _key():
        return {"id": "k1", "org_id": "org_a", "scopes": ["admin"]}

    app.dependency_overrides[require_api_key] = _key
    client = TestClient(app)

    listed = client.get("/v1/agents")
    assert listed.status_code == 200
    body = listed.json()
    assert body["acp_agent"] == "swarm-factory"
    assert "/agents/name/swarm-factory/rpc" in body["acp"]["url"]
    assert body["orchestration"] == "temporal_children"
    assert any(
        a["name"] == "gantry-builder" and a["entrypoint"] == "temporal_child"
        for a in body["agents"]
    )


    one = client.get("/v1/agents/gantry-builder")
    assert one.status_code == 200
    assert "not independently ACP" in one.json()["invoke"]
    assert client.get("/v1/agents/no-such-agent").status_code == 404

    with patch(
        "api.routes.tasks.tasks_repo.get_task_meta",
        new=AsyncMock(return_value=None),
    ):
        missing = client.post(
            "/v1/tasks/t1/hitl",
            json={"checkpoint": "architect_plan", "workflow_id": "w", "approved": True},
        )
        assert missing.status_code == 404

    with patch(
        "api.routes.tasks.tasks_repo.get_task_meta",
        new=AsyncMock(return_value={"id": "t1"}),
    ):
        unknown = client.post(
            "/v1/tasks/t1/hitl",
            json={"checkpoint": "nope", "workflow_id": "w"},
        )
        assert unknown.status_code == 422

        with (
            patch("api.routes.tasks.temporal_client.signal_workflow", new=AsyncMock()) as sig,
            patch("api.routes.tasks.audit_repo.record", new=AsyncMock()) as rec,
        ):
            ok = client.post(
                "/v1/tasks/t1/hitl",
                json={
                    "checkpoint": "architect_plan",
                    "workflow_id": "wf-approve",
                    "approved": True,
                },
            )
            assert ok.status_code == 200
            data = ok.json()
            assert data["acp_event"] == "hitl.approve_plan"
            assert data["signal"] == "approve"
            sig.assert_awaited_once()
            rec.assert_awaited_once()

            clarify = client.post(
                "/v1/tasks/t1/hitl",
                json={"checkpoint": "pm_clarification", "workflow_id": "wf-q"},
            )
            assert clarify.status_code == 422

        with patch(
            "api.routes.tasks.audit_repo.list_entries",
            new=AsyncMock(
                return_value=[
                    {"action": "hitl.approve_plan", "resource_id": "t1"},
                    {"action": "task.submitted", "resource_id": "t1"},
                ]
            ),
        ):
            events = client.get("/v1/tasks/t1/hitl")
            assert events.status_code == 200
            assert events.json()["count"] == 1


def test_list_tasks_route_merges_repo_and_agentex():
    from unittest.mock import AsyncMock, patch

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from api.deps import require_api_key
    from api.routes.tasks import router as tasks_router

    app = FastAPI()
    app.include_router(tasks_router)

    async def _key():
        return {"id": "k1", "org_id": "org_a", "scopes": ["tasks:read"]}

    app.dependency_overrides[require_api_key] = _key
    client = TestClient(app)

    rows = [
        (
            "task-1",
            {
                "org_id": "org_a",
                "project_id": "p1",
                "goal": "Build todo app",
                "tier": 1,
                "created_at": "2026-09-09T12:00:00+00:00",
            },
        ),
    ]
    agentex_tasks = [
        {
            "id": "task-1",
            "status": "RUNNING",
            "created_at": "2026-09-09T12:00:00+00:00",
            "params": {"query": "Build todo app"},
        },
    ]

    with (
        patch("api.routes.tasks.tasks_repo.list_tasks", new=AsyncMock(return_value=rows)),
        patch("api.routes.tasks.agentex_client.list_tasks", new=AsyncMock(return_value=agentex_tasks)),
    ):
        resp = client.get("/v1/tasks")

    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    assert body["tasks"][0]["task_id"] == "task-1"
    assert body["tasks"][0]["status"] == "RUNNING"
    assert body["tasks"][0]["goal"] == "Build todo app"
