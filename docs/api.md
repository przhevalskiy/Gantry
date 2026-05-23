# Monolift REST API

Base URL: `https://api.monolift.dev`  
Local dev: `http://localhost:8001`  
Interactive docs: `https://api.monolift.dev/docs`

---

## Authentication

All `/v1/` endpoints require a Bearer token:

```
Authorization: Bearer gantry_<64 hex chars>
```

Create a key in the dashboard (Agents → API tab) or via the API:

```bash
curl -X POST https://api.monolift.dev/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "my-key"}'
```

Keys are shown once on creation. Store them securely.

---

## Keys

### `POST /keys`
Create an API key. No auth required (bootstrap endpoint).

```json
{ "name": "ci-pipeline" }
```

Response `201`:
```json
{ "id": "key_abc", "key": "gantry_...", "name": "ci-pipeline", "created_at": "..." }
```

### `GET /keys`
List all active keys (masked).

### `DELETE /keys/:id`
Revoke a key. Returns `204`.

---

## Projects

### `GET /v1/projects`
List all projects.

### `GET /v1/projects/:id`
Get a single project.

### `POST /v1/projects`
Create a project.

```json
{ "name": "my-app", "github_url": "https://github.com/org/repo" }
```

### `PATCH /v1/projects/:id`
Update a project's name or GitHub URL.

```json
{ "github_url": "https://github.com/org/new-repo" }
```

---

## Tasks

### `POST /v1/tasks`
Submit an engineering task.

```json
{
  "goal": "Add rate limiting to POST /v1/tasks",
  "project_id": "proj_abc",
  "branch_prefix": "swarm",
  "tier": -1,
  "github_token": "ghp_...",
  "webhook_url": "https://your-server.com/webhooks/monolift"
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `goal` | ✓ | — | Engineering goal in plain English |
| `project_id` | ✓ | — | ID of the linked project |
| `branch_prefix` | | `swarm` | Git branch prefix |
| `tier` | | `-1` (auto) | Model tier: 0=Haiku, 1=Sonnet, 2=Opus |
| `github_token` | | `GH_TOKEN` from env | Override the GitHub token for this task |
| `webhook_url` | | — | URL to POST when task completes |

Response `201`:
```json
{ "task_id": "task_xyz", "status": "queued", "project_id": "proj_abc" }
```

### `POST /v1/tasks/bulk`
Submit up to 50 tasks in parallel. Returns immediately — partial failure is fine.

```json
{
  "project_id": "proj_abc",
  "tasks": [
    { "goal": "Add rate limiting to POST /v1/tasks" },
    { "goal": "Write tests for the auth module" },
    { "goal": "Fix the N+1 query in project listing", "tier": 2 }
  ],
  "webhook_url": "https://your-server.com/hooks/monolift"
}
```

Per-task fields (`branch_prefix`, `tier`, `webhook_url`) override the top-level defaults.

Response `202`:
```json
{
  "project_id": "proj_abc",
  "submitted": 2,
  "failed": 1,
  "results": [
    { "goal": "Add rate limiting...", "task_id": "task_abc", "status": "queued" },
    { "goal": "Write tests...", "task_id": "task_def", "status": "queued" },
    { "goal": "Fix the N+1...", "error": "Agentex error: ..." }
  ]
}
```

### `GET /v1/tasks/:id`
Poll task status.

```json
{
  "task_id": "task_xyz",
  "status": "completed",
  "pr_url": "https://github.com/org/repo/pull/42",
  "project_id": "proj_abc",
  "source": "api",
  "created_at": "2026-05-23T10:00:00Z",
  "updated_at": "2026-05-23T10:18:00Z"
}
```

Status values: `queued` · `running` · `waiting_approval` · `completed` · `failed` · `cancelled` · `terminated` · `timeout`

### `GET /v1/tasks/:id/messages`
Stream agent activity messages.

```json
{ "task_id": "task_xyz", "messages": [ { "role": "assistant", "content": "..." } ] }
```

### `GET /v1/tasks/:id/source`
Returns source metadata. No auth required.

```json
{ "source": "github_issues", "github_owner": "org", "github_repo": "repo", "github_issue_number": 42 }
```

### `DELETE /v1/tasks/:id`
Terminate a running task. Returns `204`.

### `POST /v1/tasks/:id/approve`
Send a human-in-the-loop approval signal.

```json
{ "workflow_id": "task_xyz", "approved": true }
```

---

## Webhooks

When you pass `webhook_url` to `POST /v1/tasks`, Monolift POSTs to that URL when the task reaches a terminal state.

### Payload

```json
{
  "event": "task.completed",
  "task_id": "task_xyz",
  "project_id": "proj_abc",
  "source": "api",
  "pr_url": "https://github.com/org/repo/pull/42"
}
```

### Events

| Event | When |
|---|---|
| `task.completed` | PR opened successfully |
| `task.failed` | Task ended with error, timeout, or termination |

### Signature

Every delivery includes `X-Gantry-Signature: sha256=<hmac>`.

Verify in Python:
```python
import hmac, hashlib

def verify(body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)
```

### Retry policy

Failed deliveries are retried up to 3 times with delays of 2s, 5s, and 10s.

### `POST /v1/webhooks/test`
Send a test ping to a URL.

```json
{ "url": "https://your-server.com/webhooks/test" }
```

---

## GitHub Integration

See [github-integration.md](github-integration.md) for the full setup guide.

### `POST /v1/integrations/github/webhook`
Receives GitHub webhook events. Configure this URL in your repo settings.

Verifies `X-Hub-Signature-256` against `GITHUB_WEBHOOK_SECRET`.

Triggers on: `issues` event + `labeled` action + label `gantry`.

---

## Errors

| Status | Meaning |
|---|---|
| `401` | Invalid or missing API key |
| `403` | No Authorization header |
| `404` | Resource not found |
| `422` | Validation error — check request body |
| `502` | Upstream error (Agentex or GitHub unreachable) |

All errors return `{ "detail": "..." }`.
