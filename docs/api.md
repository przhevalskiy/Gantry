# Gantry REST API (current)

**Source of truth:** mounted routers in `api/main.py` + `api/routes/*`.  
**Interactive:** `http://localhost:8001/docs` (Swagger) when the API is running.  
**Base URL (dev):** `http://localhost:8001`  
**Base URL (prod example):** `https://api.gantry.dev`

This document reflects the **in-tree API after `apps/web` removal**. There is no dashboard dependency.

---

## Authentication

All `/v1/*` routes require:

```
Authorization: Bearer gantry_<64 hex chars>
```

| Mechanism | Behavior |
|-----------|----------|
| API key | SHA-256 hashed at rest; plaintext shown **once** on create (I4) |
| Bootstrap | If no keys exist, `POST /v1/keys` may create the first key (optional `X-Gantry-Bootstrap-Token`) |
| Dev bypass | `GANTRY_DEV_AUTH_BYPASS=1` — local only |

### Scopes

`admin` · `tasks:read` · `tasks:write` · `projects:read` · `projects:write` · `secrets:read` · `secrets:write`

`admin` implies every scope.

### Create a key

```bash
curl -X POST http://localhost:8001/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "bootstrap", "scopes": ["admin"]}'
```

Response includes `"key": "gantry_…"` — store it; it is not returned again.

---

## Unauthenticated

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness + DB flag |
| `GET` | `/status` | Component health (DB, Agentex, Temporal config) + active task count |
| `GET` | `/docs`, `/redoc`, `/openapi.json` | OpenAPI UI |

---

## Keys — `/v1/keys`

| Method | Path | Scope | Purpose |
|--------|------|-------|---------|
| `POST` | `/v1/keys` | bootstrap / admin | Create key (plaintext once) |
| `GET` | `/v1/keys` | admin | List keys (masked) |
| `DELETE` | `/v1/keys/{key_id}` | admin | Revoke |

---

## Projects — `/v1/projects`

GitHub-linked work units (alias: workspaces).

| Method | Path | Scope | Purpose |
|--------|------|-------|---------|
| `GET` | `/v1/projects` | projects:read | List |
| `GET` | `/v1/projects/{id}` | projects:read | Get |
| `POST` | `/v1/projects` | projects:write | Create `{ name, github_url, … }` |
| `PATCH` | `/v1/projects/{id}` | projects:write | Update |
| `DELETE` | `/v1/projects/{id}` | projects:write | Delete |
| `GET` | `/v1/projects/{id}/artifacts` | projects:read | List artifacts |
| `GET` | `/v1/projects/{id}/files/tree` | projects:read | File tree |
| `GET` | `/v1/projects/{id}/files/content` | projects:read | File content |
| `PUT` | `/v1/projects/{id}/files/content` | projects:write | Write file |
| `GET` | `/v1/projects/{id}/memory` | projects:read | Project memory |

---

## Workspaces — `/v1/workspaces`

Parallel surface to projects (same org scoping). Task submit accepts `project_id` **or** `workspace_id`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/workspaces` | List |
| `GET` | `/v1/workspaces/{id}` | Get |
| `POST` | `/v1/workspaces` | Create |
| `PATCH` | `/v1/workspaces/{id}` | Update |
| `DELETE` | `/v1/workspaces/{id}` | Delete |
| `GET` | `/v1/workspaces/{id}/artifacts` | Artifacts |
| `GET` | `/v1/workspaces/{id}/files/tree` | Tree |
| `GET` | `/v1/workspaces/{id}/files/content` | Read file |
| `PUT` | `/v1/workspaces/{id}/files/content` | Write file |

---

## Tasks — `/v1/tasks`

Primary product surface (**P1**).

### Submit

`POST /v1/tasks` → `201`  
Scope: `tasks:write`

```json
{
  "goal": "Add health check endpoint",
  "project_id": "proj_abc",
  "tier": 2,
  "playbook": "platform-backlog",
  "branch_prefix": "swarm",
  "webhook_url": "https://example.com/hook",
  "pipeline": {
    "max_parallel_tracks": 2,
    "max_heal_cycles": 2,
    "disable_agents": []
  },
  "llm": null,
  "artifact_ids": [],
  "include_workspace_brief": true
}
```

`workspace_id` may replace `project_id`. Tier `-1` = auto-classify.

### Bulk

`POST /v1/tasks/bulk` → `202` — array of goals on one project.

### Read / stream / control

| Method | Path | Scope | Purpose |
|--------|------|-------|---------|
| `GET` | `/v1/tasks` | tasks:read | List (org-scoped filters) |
| `GET` | `/v1/tasks/{id}` | tasks:read | Status + structured `result` |
| `GET` | `/v1/tasks/{id}/events` | tasks:read | **SSE** lifecycle stream |
| `GET` | `/v1/tasks/{id}/report` | tasks:read | Run report |
| `GET` | `/v1/tasks/{id}/messages` | tasks:read | Agent messages (observability) |
| `GET` | `/v1/tasks/{id}/traces` | tasks:read | Traces |
| `GET` | `/v1/tasks/{id}/source` | **none** | Ingress meta (`source`, github owner/repo); unauthenticated helper |
| `DELETE` | `/v1/tasks/{id}` | tasks:write | Cancel / terminate |
| `POST` | `/v1/tasks/{id}/followup` | tasks:write | Follow-up message into run |
| `POST` | `/v1/tasks/{id}/approve` | tasks:write | Legacy HITL approve |
| `POST` | `/v1/tasks/{id}/hitl` | tasks:write | HITL decision |
| `GET` | `/v1/tasks/{id}/hitl` | tasks:read | Pending HITL |

Terminal statuses: `completed`, `failed`, `cancelled`, `terminated`, `timeout`.

Structured result (I3) typically includes `pr_url`, `branch`, `artifact_type`, quality fields when present.

SSE event types: [`platform/sse-events.md`](./platform/sse-events.md).

---

## Agents — `/v1/agents`

| Method | Path | Scope | Purpose |
|--------|------|-------|---------|
| `GET` | `/v1/agents` | tasks:read | Crew catalog + autonomy + ACP example |
| `GET` | `/v1/agents/{name}` | tasks:read | One role |

Only **`swarm-factory`** is a valid ACP `task/create` target (**C1**).

---

## Playbooks — `/v1/playbooks`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/playbooks` | List |
| `GET` | `/v1/playbooks/{id}` | Get |
| `POST` | `/v1/playbooks` | Create org playbook |
| `PATCH` | `/v1/playbooks/{id}` | Update |
| `DELETE` | `/v1/playbooks/{id}` | Delete |
| `POST` | `/v1/playbooks/run` | Run playbook → creates task |

Deep dive: [`deep-dives/playbooks-and-packs.md`](./deep-dives/playbooks-and-packs.md).

---

## Firm packs — `/v1/packs`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/packs` | Catalog + install/quota state |
| `GET` | `/v1/packs/{pack_ref}` | Detail |
| `POST` | `/v1/packs/{pack_ref}/install` | Install / enable |
| `PATCH` | `/v1/packs/{pack_ref}` | Enable flag / daily quota |
| `DELETE` | `/v1/packs/{pack_ref}` | Uninstall row |

---

## Artifacts — `/v1/artifacts`

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/artifacts` | Upload |
| `GET` | `/v1/artifacts/{id}` | Download / meta |
| `DELETE` | `/v1/artifacts/{id}` | Delete |

Attach via `artifact_ids` on task submit.

---

## Secrets — `/v1/secrets`

| Method | Path | Scope | Purpose |
|--------|------|-------|---------|
| `POST` | `/v1/secrets` | secrets:write | Store named secret |
| `GET` | `/v1/secrets` | secrets:read | List names (not values) |
| `DELETE` | `/v1/secrets/{name}` | secrets:write | Delete |

Used for GitHub tokens / BYOK references (`github_token_secret`, LLM config).

---

## Org settings, quotas, usage, audit, webhooks

| Method | Path | Purpose |
|--------|------|---------|
| `GET` / `PATCH` | `/v1/settings` | Org settings |
| `GET` / `PATCH` | `/v1/quotas` | Org quotas |
| `GET` | `/v1/usage` | Usage ledger |
| `GET` | `/v1/audit` | Audit log |
| `POST` | `/v1/webhooks` | Register org webhook |
| `GET` | `/v1/webhooks` | List |
| `DELETE` | `/v1/webhooks/{id}` | Delete |
| `POST` | `/v1/webhooks/test` | Test delivery |

---

## GitHub integration — `/v1/integrations/github`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/integrations/github/install` | Start App install |
| `GET` | `/v1/integrations/github/setup` | Setup callback (redirects via `GANTRY_WEB_URL` — no in-repo UI target today) |
| `GET` | `/v1/integrations/github/installations` | List installs |
| `DELETE` | `/v1/integrations/github/installations/{id}` | Remove |
| `POST` | `/v1/integrations/github/webhook` | GitHub webhook receiver |

Docs: [`integrations/github-app.md`](./integrations/github-app.md), [`github-integration.md`](./github-integration.md).

### GitHub browser helpers — `/v1/github`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/github/repos` | List accessible repos |
| `POST` | `/v1/github/repos/search` | Search |
| `GET` | `/v1/github/projects/{id}/tree` | Tree |
| `GET` | `/v1/github/projects/{id}/file` | File |

Helpers for future clients / tooling — not a shipped UI.

---

## Other integrations

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/integrations/linear/webhook` | Linear ingress |
| `POST` | `/v1/integrations/jira/webhook` | Jira ingress |

---

## Internal (worker / infra)

Not for public integrators. Protected by internal auth.

### `/internal`

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/internal/signal` | Temporal / HITL signal bridge |
| `GET` | `/internal/files/tree` | Worker file tree |
| `GET` | `/internal/files/content` | Worker file content |
| `GET` | `/internal/traces` | Traces |
| `GET` | `/internal/projects/{id}/memory` | Memory |

### `/internal/db`

| Method | Path | Purpose |
|--------|------|---------|
| `GET/POST/PATCH/DELETE` | `/internal/db/projects…` | Project DB sync |
| `POST` | `/internal/db/builds` | **Primary** structured result upsert (I3) |
| `GET` | `/internal/db/projects/{id}/builds` | Builds |
| `GET` | `/internal/db/tasks/{id}/build` | Build for task |
| `PATCH` | `/internal/db/tasks/{id}/meta` | Task meta |
| `POST` | `/internal/db/tasks/{id}/status` | Lifecycle push |
| `GET/PUT` | `/internal/db/ui-state` | Orphaned FE tab state (still mounted; unused without a client) |
| `GET/PUT` | `/internal/db/preferences` | Orphaned FE preferences |

---

## Headless quick start

```bash
export API=http://localhost:8001

# 1. Key
curl -s -X POST $API/v1/keys -H 'Content-Type: application/json' \
  -d '{"name":"dev"}' | tee /tmp/gantry-key.json
export GANTRY_API_KEY=$(python -c "import json;print(json.load(open('/tmp/gantry-key.json'))['key'])")

# 2. Project
curl -s -X POST $API/v1/projects \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"name":"demo","github_url":"https://github.com/org/repo"}'

# 3. Task
curl -s -X POST $API/v1/tasks \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"goal":"Add README section for health checks","project_id":"proj_…","tier":1}'

# 4. Poll
curl -s $API/v1/tasks/TASK_ID -H "Authorization: Bearer $GANTRY_API_KEY"
```

Requires Agentex + Temporal + worker for execution. API alone can create keys/projects/task rows depending on config.

---

## SDKs

- Python: `sdk/python/`
- TypeScript: `sdk/typescript/`

Both target this `/v1` surface. Prefer SDK helpers for HITL and playbooks when available.

---

## Related

- Architecture: [`architecture.md`](./architecture.md)
- Platform invariants: [`platform.md`](./platform.md)
- HITL/SSE: [`deep-dives/hitl-and-sse.md`](./deep-dives/hitl-and-sse.md)
- Event model: [`platform/event-model.md`](./platform/event-model.md)
