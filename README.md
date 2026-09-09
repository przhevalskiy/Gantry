# Gantry

**Async code-agent platform with a tenant control plane.**

Gantry runs software engineering tasks as durable, orchestrated agent workflows. You submit a goal against a GitHub-linked project; a Temporal pipeline plans the work, writes code in parallel tracks, verifies it, and opens a pull request. Integrators use the REST API, webhooks, and SDKs. The web UI is optional — a run console, not the product core.

---

## What this is

Gantry is three systems wired together:

```
Integrator / apps/web  →  api/ (FastAPI)  →  Agentex  →  Temporal worker (workflows + activities)
```

| Layer | Role |
|-------|------|
| **`workflows/` + `activities/` + `worker.py`** | The engine. One Agentex entry agent (`swarm-factory`) runs a Temporal Foreman workflow that composes child workflows (PM, Architect, Builder, Inspector, Reviewer, Security, DevOps). LLM planner activities call repo tools (read/write/patch, git, tests, symbol index). |
| **`api/`** | The control plane. Org-scoped API keys, projects, task metadata, quotas, audit, webhooks, HITL routing. Submits work to Agentex via ACP `task/create` and polls Agentex for status. Does not execute agent logic itself. |
| **`apps/web/`** | An optional operator UI. Submits tasks through `/v1/tasks`, streams run output from `/v1/tasks/{id}/events`, and surfaces HITL checkpoints. Chat layout is legacy UX; the wire protocol is task-based. |

**Primary artifact:** a **task run** (with optional `result.pr_url`, `result.branch`), not a conversation thread.

**Primary interface:** `POST /v1/tasks` on the Gantry API (`:8001`). The API works without the UI.

---

## What this is not

| Category | Gantry | Cursor / Copilot / Claude Code |
|----------|--------|--------------------------------|
| Interaction | Submit a goal, poll or stream run status | Synchronous pair programming in the editor |
| Unit of work | Durable pipeline run → PR | Interactive edit session |
| Where it runs | Agentex + Temporal worker on your infra | Local IDE / CLI |

The web UI still *looks* like a chat app (discussions, message bubbles, streaming text). Under the hood each message submits a factory task and renders Agentex output. Treat chat as **run observability**, not the domain model.

---

## Pipeline

Each task is one Temporal workflow (`swarm-factory`). The Foreman composes child workflows — they are not separate ACP targets.

```
PM → Architect → Builders (parallel) → Inspector ↺ → Reviewer → Security → DevOps
```

| Stage | Responsibility |
|-------|----------------|
| **PM** | Goal enrichment; optional clarification HITL (tier ≥ 1) |
| **Architect** | Repo map, parallel track plan, conflict resolution on overlapping files |
| **Builder** | Tool-using LLM loop: read → edit → `verify_build` → `finish_build` |
| **Inspector** | Tests, lint, types; emits heal instructions on failure |
| **Reviewer** | Diff review; logic bugs re-enter the heal loop |
| **Security** | Secret/CVE scan; can block PR |
| **DevOps** | Branch, commit, push, open PR |

Heal cycles retry Builder from a git snapshot. If the plan was wrong, Architect re-plans before burning more cycles. Named HITL checkpoints (plan approval, deploy approval, PM clarification) pause the workflow until signalled via REST.

Crew catalog (read-only): `GET /v1/agents`. Only **`swarm-factory`** accepts ACP `task/create`.

Details: [`docs/platform/oracle-tiers.md`](docs/platform/oracle-tiers.md), [`docs/platform/agentex-citizen.md`](docs/platform/agentex-citizen.md)

---

## Complexity tiers

Tier controls parallelism, heal budget, optional agents, and HITL gates. Auto-classified from the goal, or override on submit.

| Tier | Label | Parallel tracks | Heal cycles | Reviewer / Security | HITL |
|------|-------|-----------------|-------------|---------------------|------|
| 0 | Micro | 1 | 0 | off | none |
| 1 | Lightweight | 1 | 1 | off | PM clarification |
| 2 | Standard | 2 | 2 | on | + architect plan |
| 3 | Full Crew | 4 | 2 | on | + devops |

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

**Playbooks** (`playbook: "platform-backlog"`, `a11y-remediation`, `monorepo-slice`) apply vertical presets without forking the engine. See [`docs/verticals/README.md`](docs/verticals/README.md).

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

## Web UI (`apps/web`)

Static Vite + React app. Deployed separately (e.g. Vercel); talks to the Gantry API only.

```
Browser (:5173)  →  Gantry API (:8001)  →  Agentex (:5003)  →  worker
```

| Server-backed | Client-local (browser) |
|---------------|------------------------|
| Projects (hubspaces) | Discussions / sidebar history |
| Task submit + SSE stream | Starters (saved prompts) |
| API key auth | Chat message cache |

Flow: create a **Hubspace** (project + GitHub URL) → **New Task** (types a goal) → UI calls `POST /v1/tasks` → streams `/v1/tasks/{id}/events` into the chat view. **Team** page configures default tier and pipeline flags sent on each submit.

Local dev: `./dev.sh` sets `GANTRY_DEV_AUTH_BYPASS` so the UI skips the API-key modal. Never enable that in production.

UI docs: [`apps/web/README.md`](apps/web/README.md)

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
- Node.js 20+
- [Temporal CLI](https://docs.temporal.io/cli) (or Temporal via Agentex Docker)
- [Scale Agentex](https://github.com/scaleapi/scale-agentex) platform — `scale-agentex/agentex` via Docker Compose

### Setup

```bash
cp .env.example .env
# Required for worker: ANTHROPIC_API_KEY
# Optional: GH_TOKEN, DATABASE_URL, GANTRY_SECRETS_KEY

uv sync
cd apps/web && npm install
```

### Run

```bash
./dev.sh              # Temporal, Agentex (if needed), worker, API :8001, UI :5173
./dev.sh --status     # port check
./dev.sh --stop       # tear down local processes
./dev.sh --platform   # restart Agentex Docker first
```

| Service | Port |
|---------|------|
| Agentex API | 5003 |
| Agent ACP (`swarm-factory`) | 8000 |
| Gantry API | 8001 |
| Factory UI | 5173 |
| Temporal | 7233 |

Open [http://localhost:5173](http://localhost:5173) for the UI, [http://localhost:8001/docs](http://localhost:8001/docs) for the API.

Verification: `bash scripts/release_gate.sh`

---

## Deployment

- **Helm:** [`deploy/helm/gantry/`](deploy/helm/gantry/)
- **Agentex cluster:** [`docs/platform/agentex-cluster.md`](docs/platform/agentex-cluster.md)
- **Worker scaling:** [`docs/platform/scaling-workers.md`](docs/platform/scaling-workers.md)

Agentex, Temporal, and the worker stay off static hosting. Only `apps/web` is a static frontend.

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
├── apps/web/                 # Vite operator UI (optional)
├── sdk/python/               # gantry-sdk
├── sdk/typescript/           # @gantry/sdk
├── playbooks/                # Vertical YAML presets
├── manifest.yaml             # Agentex agent manifest (swarm-factory)
├── worker.py                 # Temporal worker bootstrap
├── dev.sh                    # local launcher
└── docs/                     # API reference, platform invariants, verticals
```

Platform invariants and merge status: [`PLATFORM_REFACTOR.md`](PLATFORM_REFACTOR.md), [`docs/platform/platform-merge-plan.md`](docs/platform/platform-merge-plan.md)

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

Projects store the repo URL (`POST /v1/projects`). The worker clones that repo, builds on a branch, and opens a PR.

---

## Memory

Cross-run learning uses a local facts store and episodic log (`.gantry/memory/` on the worker host). Architects query prior episodes before planning. Readable via `GET /v1/projects/{id}/memory`.

---

## Positioning docs

- Product thesis: [`GANTRY_THESIS.md`](GANTRY_THESIS.md)
- API-first pivot checklist: [`PLATFORM_REFACTOR.md`](PLATFORM_REFACTOR.md)
- Merge plan + invariants: [`docs/platform/platform-merge-plan.md`](docs/platform/platform-merge-plan.md)
