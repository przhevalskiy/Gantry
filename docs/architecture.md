# Architecture

Gantry is a **silicon engineering firm** implemented as an API-first control plane over one Agentex citizen (`swarm-factory`). The Foreman staffs Operator child workflows for each engagement. There is no in-repo product UI; clients are SDKs, curl, CI, ticketing webhooks, or a future optional frontend.

Firm mapping: [`brand/persona-the-firm.md`](./brand/persona-the-firm.md) · Product rules: [`platform.md`](./platform.md)

```
Client (SDK / curl / CI / future UI)
        │  Authorization: Bearer gantry_…   ← file a work order
        ▼
   api/  control plane  (:8001)
        │  ACP task/create → Agentex
        ▼
   Agentex  (:5003)  +  Temporal
        │
        ▼
   worker.py  — Foreman (swarm-factory) staffs Operators
        │
        ├── PM → Architect → Builders∥ → Inspector ↺
        ├── Reviewer → Security → DevOps → artifact
        └── activities: repo tools, LLM, verify, git, delivery
```

---

## Layers

| Layer | Path | Firm role |
|-------|------|-----------|
| **Control plane** | `api/` | Matter filing — keys, projects, tasks, playbooks, packs, quotas, audit, webhooks, HITL, SSE. Does **not** run agent loops. |
| **Citizen entry** | `manifest.yaml`, Agentex ACP | Front desk — only ACP target: **`swarm-factory`**. |
| **Engine** | `workflows/`, `activities/`, `worker.py` | Foreman composes Operator Temporal children. |
| **Schemas** | `schemas/` (`crew.py`, `playbooks.py`, `firm_packs.py`) | Practices, briefs, crew catalog. |
| **SDKs** | `sdk/python`, `sdk/typescript` | Thin clients over `/v1/*`. |
| **UI** | *(none)* | Deferred optional client. [`platform/frontend-architecture.md`](./platform/frontend-architecture.md) · [`brand/`](./brand/). |

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

Optional client: `apps/web` (greenfield scaffold — [`platform/frontend-structure.md`](./platform/frontend-structure.md)). Removed: legacy `ui/`, root demo SPA, Vercel UI deploy scripts.

---

## Data plane

| Store | Used for |
|-------|----------|
| **Postgres** (`DATABASE_URL`) | Orgs, keys, projects, tasks, builds, packs, quotas, audit (production) |
| **File fallback** | Same API surface when DB unset (**I6**) |
| **Redis** | Agentex / Temporal ecosystem; SSE fan-out helpers as configured |
| **Git workspaces** | Per-task clone on worker for builders |

---

## Two doors in, one firm

| Door | Who | Entry |
|------|-----|--------|
| **REST** | Integrators, future UI | `POST /v1/tasks` — file a work order |
| **ACP** | Sibling Agentex agents | `task/create` → `swarm-factory` |

Both doors land on the **same** Foreman. Never add a second ACP task agent for a playbook or “bot” (**C1**, **P2**).

---

## Related

- Firm persona: [`brand/persona-the-firm.md`](./brand/persona-the-firm.md)
- Invariants: [`platform.md`](./platform.md)
- Live routes: [`api.md`](./api.md)
- Foreman deep dive: [`deep-dives/swarm-factory.md`](./deep-dives/swarm-factory.md)
- Event push model: [`platform/event-model.md`](./platform/event-model.md)
