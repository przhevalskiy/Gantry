"""Dev auth bypass — local-only unauthenticated API access."""
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.deps import require_api_key
from api.routes.projects import router as projects_router


def test_unauthenticated_request_allowed_in_dev_bypass(monkeypatch):
    monkeypatch.setattr("api.deps.GANTRY_DEV_AUTH_BYPASS", True)

    app = FastAPI()
    app.include_router(projects_router)

    with patch("api.routes.projects.projects_repo.list_projects", new=AsyncMock(return_value=[])):
        client = TestClient(app)
        response = client.get("/v1/projects")

    assert response.status_code == 200
    assert response.json() == {"projects": []}
