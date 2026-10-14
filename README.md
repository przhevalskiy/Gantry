# Gantry

**A silicon engineering firm you retain — API-first, one front desk, durable engagements.**

You put a practice on retainer, file a work order (`POST /v1/tasks`) against a GitHub-linked project, and receive a **structured change artifact** (`pr` \| `branch` \| `patch` \| `report`). A Temporal Foreman staffs specialized Operators for the run; integrators use REST, webhooks, and SDKs. There is **no in-repo web UI** today — the product core is the control plane + worker (I8). Brand: [`docs/brand/`](docs/brand/).

---

## What this is

Gantry is one firm with three layers:

```
Client (SDK / curl / CI / future UI)  →  api/ (control plane)  →  Agentex  →  Temporal worker (Foreman + Operators)
```

| Layer | Firm role | Path |
|-------|-----------|------|
| **Foreman** | Front desk / managing partner — only ACP entry (`swarm-factory`) | `workflows/` + `activities/` + `worker.py` |
| **Operators** | Staffed seats (PM, Architect, Builders, Inspector, Reviewer, Security, DevOps) as Temporal children — not separate ACP bots | same worker |
| **Control plane** | Matter filing, keys, quotas, HITL, webhooks, SSE | `api/` |
| **UI** | Optional client of `/v1/*` (deferred) | [`docs/brand/`](docs/brand/) · [`docs/platform/frontend-architecture.md`](docs/platform/frontend-architecture.md) |

| Concept | Meaning |
|---------|---------|
| **Firm** | One ACP citizen: `swarm-factory` |
| **Practice** | Firm pack on retainer (`swe-factory@1`, …) via `/v1/packs` |
| **Engagement / brief** | Playbook (job packet: seats, stages, artifact) |
| **Work order** | `POST /v1/tasks` (or `playbooks.run`) |
| **Deliverable** | Structured `result` — not a chat farewell |

**Primary interface:** `POST /v1/tasks` on the Gantry API (`:8001`). The API works without a UI (I1 / P1).

**Agency browser extensions** live in a separate repo: [agency-extension-hub](https://github.com/przhevalskiy/agency-extension-hub).

---

## What this is not

| Gantry | Not |
|--------|-----|
| Retain a firm → file engagements → get artifacts | Deploy / befriend a marketplace of chat bots |
| One Foreman staffs Operators inside a run | N separately hosted ACP “bots” per role |
| Durable async pipeline with HITL gates | Synchronous IDE pair programming (Cursor / Copilot / Claude Code) |
| Deliverable: `pr` \| `branch` \| `patch` \| `report` | Product identity = “opened a PR” |
| API + SDKs are the product (UI optional) | Dashboard-required core ops |

Brand detail: [`docs/brand/README.md`](docs/brand/README.md) · [`docs/platform.md`](docs/platform.md).

---

## Pipeline — default SWE engagement

Each work order is one Temporal workflow (`swarm-factory`). The **Foreman** composes Operator child workflows — they are not separate ACP targets (C1 / I7).

```
PM → Architect → Builders (parallel) → Inspector ↺ → Reviewer → Security → DevOps
```

| Stage | Firm seat | Responsibility |
|-------|-----------|----------------|
| **PM** | Engagement lead | Goal enrichment; optional clarification HITL (tier ≥ 1) |
| **Architect** | Tech lead | Repo map, parallel track plan, conflict resolution; plan HITL (tier ≥ 2) |
| **Builder** | Implementation | Tool-using LLM loop: read → edit → `verify_build` → `finish_build` |
| **Inspector** | QA / build gate | Tests, lint, types; emits heal instructions on failure |
| **Reviewer** | Senior review | Diff / logic review; bugs re-enter the heal loop |
| **Security** | Security review | Secret/CVE scan; can block ship |
| **DevOps** | Delivery | Branch, commit, push; close with artifact (`pr` \| `branch` \| `patch` \| `report`) |

Heal cycles retry Builder from a git snapshot. Wrong plans return to Architect before burning more cycles. Client touchpoints are named HITL checkpoints (clarify, approve plan, continue after max heals, approve deploy) — partner approvals via REST, not companion chat.

This DAG is the **full-service SWE practice** default. Playbooks may mute seats, change artifact policy, or add oracle overlays without forking the engine. Crew catalog: `GET /v1/agents`. Only **`swarm-factory`** accepts ACP `task/create`.

Details: [`docs/architecture.md`](docs/architecture.md) · [`docs/platform.md`](docs/platform.md) · [`docs/deep-dives/swarm-factory.md`](docs/deep-dives/swarm-factory.md) · [`docs/brand/persona-the-firm.md`](docs/brand/persona-the-firm.md)

---

## Complexity tiers

Tier controls parallelism, heal budget, optional agents, and HITL gates. Auto-classified from the goal, or override on submit.

| Tier | Label | Agentex autonomy | Parallel tracks | Heal cycles | Reviewer / Security | HITL |
|------|-------|------------------|-----------------|-------------|---------------------|------|
| 0 | Micro | L2 | 1 | 0 | off | none |
| 1 | Lightweight | L3 | 1 | 1 | off | PM clarification |
| 2 | Standard | L4 | 2 | 2 | on | + architect plan |
| 3 | Full Crew | L5 | 4 | 2 | on | + devops |

Pass `tier` and optional `pipeline` overrides on `POST /v1/tasks`:

```json
{
  "goal": "Add health check endpoint",
  "project_id": "proj_abc",
  "tier": 2,
  "pipeline": {
    "max_parallel_tracks": 2,
    "max_heal_cycles": 2,
    "disable_agents": ["pm"]
  }
}
```

**Playbooks** are engagement briefs / job packets (`platform-backlog`, `a11y-remediation`, `monorepo-slice`) — stages, seats, artifact — without forking the engine. **Firm packs** are practices on retainer (`swe-factory@1`, `migration-runner@1`) via `GET/POST /v1/packs`. Still one ACP citizen. See [`docs/deep-dives/playbooks-and-packs.md`](docs/deep-dives/playbooks-and-packs.md).

---

## Control plane API

Base URL: `http://localhost:8001` (dev) · Swagger: `/docs` · Health: `/health`

All `/v1/*` routes require `Authorization: Bearer gantry_…`.

### Headless quick start

```bash
# Create a key (bootstrap — see docs for production hardening)
curl -X POST http://localhost:8001/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "bootstrap"}'

export GANTRY_API_KEY=gantry_...

# Link a GitHub repo
curl -X POST http://localhost:8001/v1/projects \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-service", "github_url": "https://github.com/org/repo"}'

# Submit a task
curl -X POST http://localhost:8001/v1/tasks \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: deploy-001" \
  -d '{"goal": "Add health check endpoint", "project_id": "<id>"}'

# Poll status + structured result
curl http://localhost:8001/v1/tasks/<task_id> \
  -H "Authorization: Bearer $GANTRY_API_KEY"

# Stream run events (SSE)
curl -N http://localhost:8001/v1/tasks/<task_id>/events \
  -H "Authorization: Bearer $GANTRY_API_KEY"
```

SSE event types: `status`, `lifecycle`, `message`, `hitl`, `error`, `done`. Schema: [`docs/platform/sse-events.md`](docs/platform/sse-events.md).

The SSE endpoint aggregates Agentex task status and messages with Gantry metadata (lifecycle webhooks fired, pending HITL). It is a **polling adapter**, not a native workflow event bus.

### Surface map

| Area | Endpoints |
|------|-----------|
| **Tasks** | `POST /v1/tasks`, `POST /v1/tasks/bulk`, `GET /v1/tasks/{id}`, `GET /v1/tasks/{id}/events`, `POST /v1/tasks/{id}/hitl`, `POST /v1/tasks/{id}/approve` |
| **Agents** | `GET /v1/agents`, `GET /v1/agents/{name}` |
| **Projects** | `GET/POST/PATCH /v1/projects`, `GET /v1/projects/{id}/memory` |
| **Keys / secrets / webhooks / quotas / audit / usage / settings** | See [`docs/api.md`](docs/api.md) |
| **Integrations** | GitHub, Linear, Jira webhooks under `/v1/integrations/*` |

Full reference: [`docs/api.md`](docs/api.md)

---

## Web UI

**Not in this repository.** Product surface is the API + SDKs. Brand and restart notes for a future client: [`docs/brand/`](docs/brand/) · [`docs/platform/frontend-architecture.md`](docs/platform/frontend-architecture.md).

---

## SDKs

**Python** — [`sdk/python/`](sdk/python/)

```python
from gantry import GantryClient

client = GantryClient(api_key="...", base_url="http://localhost:8001")
task = client.tasks.submit("Add rate limiting", project_id="proj_abc")
result = client.tasks.wait(task.task_id)
print(result.pr_url)
```

**TypeScript** — [`sdk/typescript/`](sdk/typescript/)

```typescript
import { GantryClient } from "@gantry/sdk";

const client = new GantryClient({ apiKey: "...", baseUrl: "http://localhost:8001" });
const task = await client.tasks.create({ goal: "Add rate limiting", projectId: "proj_abc" });
const result = await client.tasks.wait(task.id);
```

---

## Local development

### Prerequisites

- Python 3.12+ and [uv](https://github.com/astral-sh/uv)
- [Temporal CLI](https://docs.temporal.io/cli) (or Temporal via Agentex Docker)
- [Scale Agentex](https://github.com/scaleapi/scale-agentex) platform — `scale-agentex/agentex` via Docker Compose

### Setup

```bash
cp .env.example .env
# Required for worker: ANTHROPIC_API_KEY
# Optional: GH_TOKEN, DATABASE_URL, GANTRY_SECRETS_KEY

uv sync
```

### Run

```bash
./dev.sh              # Temporal, Agentex (if needed), worker, API :8001
./dev.sh --status     # port check
./dev.sh --stop       # tear down local processes
./dev.sh --platform   # restart Agentex Docker first
```

| Service | Port |
|---------|------|
| Agentex API | 5003 |
| Agent ACP (`swarm-factory`) | 8000 |
| Gantry API | 8001 |
| Temporal | 7233 |

API docs: [http://localhost:8001/docs](http://localhost:8001/docs).

Verification: `bash scripts/release_gate.sh`

---

## Deployment

- **Helm:** [`deploy/helm/gantry/`](deploy/helm/gantry/)
- **Agentex cluster:** [`docs/platform/agentex-cluster.md`](docs/platform/agentex-cluster.md)
- **Worker scaling:** [`docs/platform/scaling-workers.md`](docs/platform/scaling-workers.md)

Agentex, Temporal, and the worker stay off static hosting. No in-repo static frontend.

---

## Repository layout

```
Gantry/
├── api/                    # FastAPI control plane (:8001)
│   ├── routes/             # /v1/tasks, projects, keys, agents, …
│   ├── repositories/       # org-scoped storage (Postgres or file fallback)
│   ├── clients/            # Agentex + Temporal httpx wrappers
│   └── services/           # poller, webhooks, task event emission
│
├── workflows/              # Temporal workflows
│   ├── swarm_orchestrator.py # Foreman (swarm-factory)
│   ├── child_workflow.py     # HITL approval + clarification
│   ├── agents/               # PM, Architect, Builder, Inspector, …
│   └── swarm/                # track planning, healing, reporting
│
├── activities/             # Temporal activities (side effects)
│   ├── agents/               # LLM planner steps per role
│   ├── tools/                # file, git, shell, security, web
│   ├── data/                 # memory, symbol index, quality score
│   └── infra/                # manifest, trace, db patch
│
├── project/                  # Agent config, planner, tools, schemas
│   ├── acp.py                # FastACP → Temporal
│   └── schema/               # crew catalog, playbooks, complexity tiers
│
├── sdk/python/               # gantry-sdk
├── sdk/typescript/           # @gantry/sdk
├── playbooks/                # Vertical YAML presets
├── manifest.yaml             # Agentex agent manifest (swarm-factory)
├── worker.py                 # Temporal worker bootstrap
├── dev.sh                    # local launcher
└── docs/                     # Architecture, platform, API, deep dives, brand
```

Docs index: [`docs/README.md`](docs/README.md) · Invariants: [`docs/platform.md`](docs/platform.md)

---

## Horizontal capabilities

These are the engine primitives vertical playbooks plug into — not UI features.

| Code | Capability |
|------|------------|
| **H-PAR** | Parallel Builder tracks from Architect plan |
| **H-CON** | Conflict resolution on overlapping `key_files` |
| **H-DEP** | Dependency-ordered track waves |
| **H-ORA** | Inspector (+ playbook oracles) gates quality |
| **H-HEAL** | Inspector/Reviewer → Builder retry loops |
| **H-BULK** | `POST /v1/tasks/bulk` — isolated runs, partial failure OK |
| **H-HITL** | Named checkpoints via REST + SSE `hitl` events |
| **H-SSE** | `GET /v1/tasks/{id}/events` for UI and SDK streaming |
| **H-DUR** | Temporal durability — crash-safe replay |
| **H-BYOK** | Per-org LLM keys via `/v1/settings` |
| **H-ACP** | Single ACP entry; crew as Temporal children |

---

## GitHub auth

Tasks need a GitHub token to clone and push. Options:

1. **Per-task** — pass `github_token` or `github_token_secret` on submit
2. **Org secret** — store via `POST /v1/secrets`, reference by name
3. **GitHub App** — preferred for integrations ([`docs/integrations/github-app.md`](docs/integrations/github-app.md))

Projects store the repo URL (`POST /v1/projects`). The worker clones that repo and closes the engagement with the playbook’s artifact policy (often a PR; also branch / patch / report).

---

## Memory

Cross-run learning uses a local facts store and episodic log (`.gantry/memory/` on the worker host). Architects query prior episodes before planning. Readable via `GET /v1/projects/{id}/memory`.

---

## Positioning docs

- Docs index: [`docs/README.md`](docs/README.md)
- Firm persona / brand: [`docs/brand/`](docs/brand/) · [`docs/brand/persona-the-firm.md`](docs/brand/persona-the-firm.md)
- Architecture / platform / API: [`docs/architecture.md`](docs/architecture.md) · [`docs/platform.md`](docs/platform.md) · [`docs/api.md`](docs/api.md)
- Product thesis: [`GANTRY_THESIS.md`](GANTRY_THESIS.md)
