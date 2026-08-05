# Gantry Platform Refactor

Pivot **#3 — Developer platform / API-first.** Gantry becomes durable SWE pipeline infrastructure that platform teams embed in portals, CI, and ticketing — not a consumer UI product.

---

## Invariants (must always hold)

These rules are non-negotiable across every phase. Violating any one is a regression.

| # | Invariant | Rationale |
|---|---|---|
| I1 | **API works without the UI** | Platform customers never depend on Vercel or Next.js for core operations |
| I2 | **Every resource is org-scoped** | API key → org → projects/tasks/keys. No cross-tenant reads or writes |
| I3 | **Structured results, not message scraping** | Integrators get `result.pr_url`, `result.branch`, etc. — never regex over agent chat |
| I4 | **Secrets shown once** | API key plaintext returned only at creation; only hashes stored |
| I5 | **Idempotent migrations** | All SQL uses `IF NOT EXISTS` / safe `ALTER`; migrate script is re-runnable |
| I6 | **Local dev works without Postgres** | File-backed fallback when `DATABASE_URL` is unset; same API surface |
| I7 | **Workflow engine unchanged** | Temporal + Agentex orchestration is not replaced — only the control plane |
| I8 | **UI is an optional client** | Next.js may call internal routes; public `/v1/*` never proxies to UI |

---

## Phase map

| Phase | Goal | Exit criteria |
|---|---|---|
| **0** | Decouple control plane | curl-only: create key → project → task → poll structured result |
| **1** | Integrator-ready | Org webhooks, idempotency, secrets, usage ledger, GitHub Action |
| **2** | Platform-grade | Quotas, SSE events, audit log, GitHub App, horizontal scaling docs |
| **3** | Distribution | Terraform provider, Linear/Jira integrations, self-hosted Helm chart |

---

## Phase 0 — Decouple control plane

**Goal:** API is the product. Zero UI dependency for `/v1/*`.

### Checklist

#### 0.1 Schema & tenancy
- [x] `002_platform.sql` — `organizations`, `api_keys`, `api_tasks` tables
- [x] `org_id` on `projects` and `builds`
- [x] Default org seeded; existing rows backfilled
- [x] Migrate JSON api keys → Postgres when DB available

#### 0.2 Repository layer
- [x] `api/repositories/` — shared DB + file fallback
- [x] `organizations.py` — default org bootstrap
- [x] `keys.py` — authenticate returns `{id, org_id, scopes, name}`
- [x] `projects.py` — CRUD scoped by `org_id`
- [x] `tasks.py` — task metadata + webhook state
- [x] `builds.py` — upsert structured results

#### 0.3 Route refactor
- [x] `/v1/projects` — direct repository (no UI proxy)
- [x] `/v1/tasks` — verify project belongs to caller's org
- [x] `/v1/tasks/{id}` — return `result` object from builds/tasks tables
- [x] `/v1/keys` — require admin key or bootstrap token when keys exist
- [x] `/v1/integrations/github/webhook` — find project via repository, not UI

#### 0.4 Runtime
- [x] Poller started in API lifespan (webhook delivery)
- [x] Poller upserts `builds` row on terminal status
- [x] `/health` returns `{status, ok, db}`

#### 0.5 Branding & docs
- [x] SDK default base URL → `https://api.gantry.dev` (configurable)
- [x] `docs/api.md` references Gantry, not Monolift
- [x] Smoke tests use `/v1/keys` paths

#### 0.6 Verification
- [x] `pytest tests/test_platform_phase0.py -v` passes (no server)
- [ ] `pytest tests/test_api_smoke.py -v` passes (live server optional)

### Phase 0 checkpoint commands

```bash
# 1. Apply schema (production / local Postgres)
DATABASE_URL=postgresql://... python scripts/migrate_db.py

# 2. Bootstrap first API key (no keys yet)
curl -X POST http://localhost:8001/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "bootstrap"}'

# 3. Full headless flow
export GANTRY_API_KEY=gantry_...
curl -X POST http://localhost:8001/v1/projects \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-repo", "github_url": "https://github.com/org/repo"}'

curl -X POST http://localhost:8001/v1/tasks \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: deploy-2026-08-04-001" \
  -d '{"goal": "Add health check endpoint", "project_id": "<id>"}'

curl http://localhost:8001/v1/tasks/<task_id> \
  -H "Authorization: Bearer $GANTRY_API_KEY"
# Expect: status + result object (null until terminal)

curl http://localhost:8001/v1/usage \
  -H "Authorization: Bearer $GANTRY_API_KEY"
```

**Phase 0 status:** implemented — `pytest tests/test_platform_phase0.py` (5/5 passing)

---

## Phase 1 — Integrator-ready

**Goal:** Platform team wires Gantry into CI in one afternoon.

### Checklist

- [x] `POST /v1/webhooks` — org-level webhook registration with event filters
- [x] Webhook events: `task.queued`, `task.started`, `task.waiting_approval`, `task.completed`, `task.failed`
- [x] `GET /v1/tasks/{id}/report` — structured build report (minimal)
- [x] `Idempotency-Key` header on `POST /v1/tasks`
- [x] `POST /v1/secrets` — encrypted GitHub PAT storage (reference by `github_token_secret`)
- [x] `GET /v1/usage` — task events per org (basic ledger)
- [x] SDK webhook verification helpers (Python + TypeScript)
- [x] Official GitHub Action: `.github/actions/gantry-submit`
- [x] Reference integration doc: `docs/integrations/github-issues.md`

**Phase 1 status:** complete — org webhooks, lifecycle events, secrets, idempotency, usage, GitHub Action, integration guide

### Phase 1 checkpoint

GitHub Issue labeled `gantry` → task submitted → org webhook fires `task.completed` with `result.pr_url` → zero UI interaction.

---

## Phase 2 — Platform-grade

**Goal:** Safe for a 200-engineer org.

### Checklist

- [x] Per-org quotas: concurrent tasks, tasks/day, bulk size, requests/minute
- [x] API rate limiting (in-memory sliding window per org)
- [x] `GET /v1/tasks/{id}/events` — SSE stage stream
- [x] `GET /v1/audit` — key usage audit log
- [x] Key scopes enforced: `tasks:read/write`, `projects:read/write`, `secrets:read/write`, `admin`
- [x] GitHub App installation (replace PAT-per-task) — see Phase 3 / `docs/integrations/github-app.md`
- [x] Worker horizontal scaling guide — `docs/platform/scaling-workers.md`
- [x] Public status page — `GET /status`
- [ ] Stripe or manual invoicing wired to usage ledger — deferred

**Phase 2 status:** complete (core) — quotas, rate limits, SSE, audit, scopes, status page, scaling guide

---

## Phase 3 — Distribution

**Goal:** Default agent-pipeline infra layer.

### Checklist

- [x] Terraform module — `terraform/modules/gantry/` (Helm release wrapper)
- [x] Linear / Jira native integrations — `/v1/integrations/linear|jira/webhook`
- [x] Self-hosted Helm chart — `deploy/helm/gantry/`
- [x] Pipeline customization API — `pipeline` on `POST /v1/tasks`, `disable_agents` in orchestrator
- [x] White-label embedding option — `GET/PATCH /v1/settings`
- [x] GitHub App installation (replace PAT-per-task) — `/v1/integrations/github/install`
- [ ] Stripe or manual invoicing wired to usage ledger — deferred

**Phase 3 status:** complete (core) — Linear/Jira, Helm, Terraform, pipeline config, white-label settings

---

## Deprioritized (do not build during platform pivot)

- Homepage greenfield suggestion chips ("Build a chess game")
- Live task feed UI polish
- Consumer onboarding flows
- Research agent (old ROADMAP browser workflow)

---

## Success metrics

| Metric | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|
| API-only task submissions | >50% | >90% | >95% |
| Time to first PR (integrator) | — | <2 hours | <1 hour |
| Webhook delivery success | — | >99% | >99.5% |
| Design partners on API | 0 | 2–3 | 5+ |
