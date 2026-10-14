# Architecture

Gantry is an **API-first control plane** over a durable Temporal crew that runs as one Agentex citizen (`swarm-factory`). There is no in-repo product UI; clients are SDKs, curl, CI, ticketing webhooks, or a future optional frontend.

```
Integrator (SDK / curl / CI / future UI)
        │  Authorization: Bearer gantry_…
        ▼
   api/  FastAPI control plane  (:8001)
        │  ACP task/create → Agentex
        ▼
   Agentex  (:5003)  +  Temporal
        │
        ▼
   worker.py  — Foreman workflow (swarm-factory)
        │
        ├── PM → Architect → Builders∥ → Inspector ↺
        ├── Reviewer → Security → DevOps
        └── activities: repo tools, LLM, verify, git, PR
```

---

## Layers

| Layer | Path | Role |
|-------|------|------|
| **Control plane** | `api/` | Org-scoped keys, projects/workspaces, tasks, playbooks, packs, quotas, audit, webhooks, HITL, SSE. Submits work via Agentex ACP; does **not** run agent loops. |
| **Citizen entry** | `manifest.yaml`, Agentex ACP | Single task target: **`swarm-factory`**. |
| **Engine** | `workflows/`, `activities/`, `worker.py` | Temporal Foreman composes child workflows. LLM + repo tools execute here. |
| **Schemas** | `schemas/` (`crew.py`, `playbooks.py`, `firm_packs.py`) | Catalog, tiers, playbook overlays, pack contracts. |
| **SDKs** | `sdk/python`, `sdk/typescript` | Thin clients over `/v1/*`. |
| **UI** | *(none)* | Deferred. See [`platform/frontend-architecture.md`](./platform/frontend-architecture.md) and [`brand/`](./brand/). |

---

## Request path (happy path)

1. Client `POST /v1/tasks` with `goal` + `project_id` (or `workspace_id`), optional `playbook` / `tier` / `pipeline` / `llm`.
2. API authenticates key → org, checks quota, resolves playbook overlays, creates `api_tasks` row.
3. API calls Agentex ACP `task/create` against agent **`swarm-factory`**.
4. Worker runs Foreman Temporal workflow; stages run as child workflows / activities.
5. Worker pushes status and structured build via `/internal/db/…` (preferred). Poller is fallback only.
6. Client polls `GET /v1/tasks/{id}`, streams `GET /v1/tasks/{id}/events`, or receives org webhooks.
7. Terminal payload includes structured `result` (`pr_url`, `branch`, `artifact_type`, …) — **I3**.

---

## Directory map (product-relevant)

```
api/                 FastAPI app, routes, repos, services
workflows/           Foreman + child agent workflows
activities/          LLM, git, verify, notify, tools
schemas/             Crew catalog, playbooks, firm packs
project/             Agentex project config / ACP glue
sdk/                 Python + TypeScript clients
deploy/              VPS / compose / Helm / smoke (API+worker)
docs/                This documentation set
scripts/             migrate, release_gate, stubs
tests/               Contract + unit tests
```

Removed / non-product: `apps/web` (deleted), legacy `ui/`, root demo SPA, Vercel UI deploy scripts.

---

## Data plane

| Store | Used for |
|-------|----------|
| **Postgres** (`DATABASE_URL`) | Orgs, keys, projects, tasks, builds, packs, quotas, audit (production) |
| **File fallback** | Same API surface when DB unset (**I6**) |
| **Redis** | Agentex / Temporal ecosystem; SSE fan-out helpers as configured |
| **Git workspaces** | Per-task clone on worker for builders |

---

## Two doors in, one factory

| Door | Who | Entry |
|------|-----|--------|
| **REST** | Integrators, future UI | `POST /v1/tasks` on Gantry API |
| **ACP** | Sibling Agentex agents | `task/create` → `swarm-factory` |

Both doors land on the **same** Foreman. Never add a second ACP task agent for a playbook or “bot” (**C1**, **P2**).

---

## Related

- Invariants: [`platform.md`](./platform.md)
- Live routes: [`api.md`](./api.md)
- Foreman deep dive: [`deep-dives/swarm-factory.md`](./deep-dives/swarm-factory.md)
- Event push model: [`platform/event-model.md`](./platform/event-model.md)
