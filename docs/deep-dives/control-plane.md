# Deep dive: control plane

The FastAPI app (`api/main.py`) is the tenant control plane. It authenticates org keys, stores task metadata, fans out webhooks/SSE, and submits work to Agentex. It does not execute Builder loops.

---

## Auth model

- Header: `Authorization: Bearer gantry_<64 hex>`
- Keys hash-stored (**I4**); plaintext returned once on `POST /v1/keys`
- First key: bootstrap when no keys exist (optional `X-Gantry-Bootstrap-Token` if `GANTRY_BOOTSTRAP_TOKEN` set)
- Dev: `GANTRY_DEV_AUTH_BYPASS` synthesizes an admin key (local only)

### Scopes

| Scope | Use |
|-------|-----|
| `admin` | All scopes + key/org admin |
| `tasks:read` / `tasks:write` | Task surfaces |
| `projects:read` / `projects:write` | Projects / workspaces |
| `secrets:read` / `secrets:write` | Org secrets |

`admin` satisfies any scope check.

---

## Tenancy (I2)

`api_key` → `org_id` → projects, tasks, packs, quotas, webhooks, audit. Cross-org reads/writes are rejected in repositories.

---

## Public vs internal

| Surface | Audience |
|---------|----------|
| `/health`, `/status` | Unauthenticated probes |
| `/v1/*` | Integrators (Bearer) |
| `/internal/*`, `/internal/db/*` | Worker + trusted infra (internal key / network trust) |

Worker push paths (`builds`, task status, meta) are the primary I3 path — see [`../platform/event-model.md`](../platform/event-model.md).

---

## Quotas, usage, audit

- `GET/PATCH /v1/quotas` — org limits  
- `GET /v1/usage` — consumption ledger  
- `GET /v1/audit` — key actions (create task, HITL, key create, …)  
- Pack-level `max_tasks_per_day` on install  

---

## Webhooks

Org webhooks (`/v1/webhooks`) fire on task lifecycle transitions after structured status apply. Per-task `webhook_url` also supported on submit.

---

## UI-helper routes (not a product UI)

| Area | Routes | Note |
|------|--------|------|
| Preferences / UI state | `/internal/db/ui-state`, `/preferences` | Orphaned after FE removal; still mounted |
| GitHub browser | `/v1/github/repos`, tree, file | Repo picker helpers (API-key auth; useful without UI) |
| Task source | `GET /v1/tasks/{id}/source` | **Unauthenticated** ingress meta helper |
| GitHub App setup | `GET /v1/integrations/github/setup` | Redirects to `GANTRY_WEB_URL` — no in-repo settings page |

These do not imply a shipped frontend. Product UI remains deferred.

---

## Local without Postgres (I6)

Repositories fall back to file storage when `DATABASE_URL` is unset. Same route surface; not for multi-tenant production.
