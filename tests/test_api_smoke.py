"""
API smoke tests — verify the Gantry API is healthy and all routes respond correctly.
Run against a live local server:

    ./dev.sh
    pytest tests/test_api_smoke.py -v

Or against production:

    GANTRY_API_URL=https://api.gantry.dev \
    GANTRY_API_KEY=gantry_... \
    pytest tests/test_api_smoke.py -v
"""
import os
import pytest
import httpx

BASE = os.environ.get("GANTRY_API_URL", "http://localhost:8001")
API_KEY = os.environ.get("GANTRY_API_KEY", "")

AUTH = {"Authorization": f"Bearer {API_KEY}"} if API_KEY else {}


def get(path: str, **kwargs) -> httpx.Response:
    return httpx.get(f"{BASE}{path}", headers=AUTH, timeout=10, **kwargs)


def post(path: str, json: dict | None = None, **kwargs) -> httpx.Response:
    return httpx.post(f"{BASE}{path}", headers=AUTH, json=json or {}, timeout=10, **kwargs)


def delete(path: str, **kwargs) -> httpx.Response:
    return httpx.delete(f"{BASE}{path}", headers=AUTH, timeout=10, **kwargs)


def test_health():
    r = get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok" or data.get("ok") is True


def test_docs_reachable():
    r = httpx.get(f"{BASE}/docs", timeout=10)
    assert r.status_code == 200


def test_tasks_requires_auth():
    health = httpx.get(f"{BASE}/health", timeout=10)
    if health.status_code == 200 and health.json().get("dev_auth_bypass"):
        pytest.skip("GANTRY_DEV_AUTH_BYPASS enabled on server")
    r = httpx.get(f"{BASE}/v1/tasks/nonexistent", timeout=10)
    assert r.status_code in (401, 403)


def test_invalid_key_rejected():
    health = httpx.get(f"{BASE}/health", timeout=10)
    if health.status_code == 200 and health.json().get("dev_auth_bypass"):
        pytest.skip("GANTRY_DEV_AUTH_BYPASS enabled on server")
    r = httpx.get(
        f"{BASE}/v1/projects",
        headers={"Authorization": "Bearer gantry_invalid"},
        timeout=10,
    )
    assert r.status_code == 401


def test_create_and_revoke_key():
    r = httpx.post(f"{BASE}/v1/keys", json={"name": "smoke-test-key"}, timeout=10)
    assert r.status_code == 201, r.text
    data = r.json()
    assert "key" in data
    assert data["key"].startswith("gantry_")
    assert "org_id" in data
    key_id = data["id"]
    plaintext = data["key"]

    r = httpx.get(
        f"{BASE}/v1/keys",
        headers={"Authorization": f"Bearer {plaintext}"},
        timeout=10,
    )
    assert r.status_code == 200
    ids = [k["id"] for k in r.json().get("keys", [])]
    assert key_id in ids

    r = httpx.delete(
        f"{BASE}/v1/keys/{key_id}",
        headers={"Authorization": f"Bearer {plaintext}"},
        timeout=10,
    )
    assert r.status_code == 204


@pytest.mark.skipif(not API_KEY, reason="GANTRY_API_KEY not set")
def test_list_projects():
    r = get("/v1/projects")
    assert r.status_code == 200
    assert "projects" in r.json()


@pytest.mark.skipif(not API_KEY, reason="GANTRY_API_KEY not set")
def test_create_and_update_project():
    r = post("/v1/projects", json={"name": "smoke-test-project", "github_url": "https://github.com/gantry/test"})
    assert r.status_code == 201, r.text
    project = r.json().get("project", r.json())
    pid = project.get("id")
    assert pid

    r = httpx.patch(
        f"{BASE}/v1/projects/{pid}",
        headers=AUTH,
        json={"name": "smoke-test-project-updated"},
        timeout=10,
    )
    assert r.status_code == 200, r.text


def test_task_source_unknown_returns_ui():
    r = httpx.get(f"{BASE}/v1/tasks/nonexistent-task-id/source", timeout=10)
    assert r.status_code == 200
    assert r.json().get("source") == "ui"


@pytest.mark.skipif(not API_KEY, reason="GANTRY_API_KEY not set")
def test_webhook_ping():
    r = post("/v1/webhooks/test", json={"url": "https://httpbin.org/post"})
    assert r.status_code in (200, 502), r.text


def test_github_webhook_rejects_missing_signature():
    r = httpx.post(
        f"{BASE}/v1/integrations/github/webhook",
        json={"action": "labeled", "issue": {}, "repository": {}, "label": {}},
        headers={"X-GitHub-Event": "issues"},
        timeout=10,
    )
    assert r.status_code in (202, 401), r.text
