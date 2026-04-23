# Gantry — Production Architecture Plan

## What Agentex Actually Is

Agentex is a **Scale AI open-source framework** (Apache 2.0). There is no hosted cloud
endpoint to point at — you own and deploy the full stack. The Enterprise Edition exists
but is sold through Scale's GenAI Platform via sales demo only.

This means production is entirely self-hosted. No vendor lock-in, no licensing fees.

---

## Current State (Local)

All services run via `./dev.sh` on a single machine:

| Service | Role | Port |
|---|---|---|
| Agentex API | FastAPI — task/message/agent management | 5003 |
| Postgres | Tasks, events, agents, spans, checkpoints | 5432 |
| MongoDB | `adk.messages` + `adk.state` (owned by Agentex) | 27017 |
| Redis | Caching, auth token cache, streams | 6379 |
| Temporal | Durable workflow orchestration | 7233 |
| Temporal Postgres | Temporal's own state (separate DB) | 5433 |
| Python swarm worker | SwarmOrchestrator + all agents | 8000 |
| gantry-ui | Next.js frontend | 3000 |

---

## What Gantry Owns vs What Agentex Owns

**Agentex owns:**
- `agents`, `tasks`, `events`, `spans`, `agent_api_keys`, `agent_task_tracker` tables
- `adk.messages` (MongoDB) — activity feed
- `adk.state` (MongoDB) — per-task agent memory
- LangGraph checkpoint tables
- The ACP protocol layer (FastACP on :8000)
- Temporal worker management (AgentexWorker)
- All Alembic migrations in `scale-agentex/`

**Gantry owns:**
- All swarm workflows (`SwarmOrchestrator`, `ArchitectAgent`, `BuilderAgent`, etc.)
- All swarm activities (`swarm_write_file`, `swarm_run_command`, etc.)
- The planner/LLM logic
- gantry-ui
- The `projects` table (to be added via Agentex Alembic migration)

---

## Target Production Stack

Everything is an env var swap — no code changes required for the infrastructure migration.

| Local (Docker) | Production | Est. Cost |
|---|---|---|
| `agentex-postgres` | **Supabase Postgres** | Free → $25/mo |
| `agentex-mongodb` | **MongoDB Atlas** | Free tier (Agentex owns this, can't eliminate) |
| `agentex-redis` | **Upstash Redis** | Free → $10/mo |
| `agentex-temporal` | **Temporal Cloud** | $25/mo (or self-hosted VPS ~$10/mo) |
| Temporal Postgres | Included in Temporal Cloud | — |
| Agentex API | **Fly.io / Railway container** | ~$10/mo |
| Python swarm worker | **Fly.io / Railway container** | ~$7/mo |
| gantry-ui | **Vercel** | Free tier |
| Project files | **Persistent volume** → Supabase Storage (Phase 3) | Free → $0.021/GB |

**Estimated production cost: ~$30–50/mo at small scale**

---

## Environment Variable Swap

```bash
# Local (.env)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentex
MONGODB_URI=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379
TEMPORAL_ADDRESS=localhost:7233
GANTRY_FILES_BASE=~/.gantry/projects

# Production (.env.production)
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
MONGODB_URI=mongodb+srv://[user]:[password]@[cluster].mongodb.net/agentex
REDIS_URL=rediss://:[token]@[endpoint].upstash.io:6380
TEMPORAL_ADDRESS=[namespace].tmprl.cloud:7233
GANTRY_FILES_BASE=/mnt/gantry/projects  # persistent volume mount
```

---

## Agentex SDK — Persistence Primitives

Agentex exposes 5 primitives. Gantry uses them as follows:

| Data | SDK Primitive | Backend | Notes |
|---|---|---|---|
| Activity feed / messages | `adk.messages` | MongoDB | Already wired |
| Per-task foreman memory | `adk.state` | MongoDB | 16 MB limit per state object |
| Build params, repo path | `task.params` JSONB | Postgres | Already on every task |
| Workflow replay | Checkpoints | Postgres | Managed by Temporal |
| Project registry | Alembic migration → `projects` table | Postgres | Only new store needed |

### Agentex Database Tables (do not modify directly)

```
agents              agent definitions and ACP URLs
tasks               task instances (status, params, agent_id)
events              immutable audit log (sequence_id autoincrement)
spans               OpenTelemetry-style traces
agent_api_keys      hashed API keys per agent
agent_task_tracker  last processed event per agent/task
checkpoints         LangGraph workflow state blobs
```

### Projects Table (one Alembic migration to add)

Added to `scale-agentex/agentex/database/migrations/` alongside Agentex's own tables.

```sql
create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  repo_path   text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

Phase 4 adds `user_id uuid references users(id)` when multi-user auth is ready.

---

## Deployment Architecture

The `manifest.yaml` `deployment` section generates **Kubernetes manifests via Helm**.
`agentex agents deploy` builds a Docker image and deploys it as a K8s pod.

```
manifest.yaml + environments.yaml
        ↓
agentex agents build   →  Docker image pushed to registry
agentex agents deploy  →  Helm chart → K8s Deployment + Service + Secrets
```

Production containers needed:
1. **Agentex API** — the FastAPI backend (currently in `scale-agentex/agentex/`)
2. **Agentex Temporal worker** — Agentex's own internal worker
3. **Gantry swarm worker** — `project/run_worker.py` (your agent code)

All three need access to the same `DATABASE_URL`, `MONGODB_URI`, `REDIS_URL`, `TEMPORAL_ADDRESS`.

---

## MongoDB — The Awkward Dependency

MongoDB cannot be eliminated without forking Agentex. It is used by:
- `adk.messages` — every message in the activity feed
- `adk.state` — foreman conversation history, per-task agent memory

**Production path:** MongoDB Atlas free tier (512 MB) covers early scale.
Eliminating it requires migrating Agentex's message/state stores to JSONB columns in
Postgres — a significant Agentex platform change, tracked as a future dependency.

---

## File Storage

Currently: swarm writes files to `repo_path` on the worker's local disk.

| Phase | Storage | Change required |
|---|---|---|
| Phase 1 | Worker disk, internal managed path | None — just set `GANTRY_FILES_BASE` |
| Phase 2 | Persistent volume on Fly.io / Railway | Mount volume, update `GANTRY_FILES_BASE` |
| Phase 3 | Supabase Storage (S3-compatible) | New `swarm_write_file` / `swarm_read_file` adapters |

---

## What Needs to Be Built

### Phase 1 — Internal project management (build now)
- [ ] Alembic migration adding `projects` table to Agentex Postgres
- [ ] `POST /api/projects` Next.js route — create project, mkdir internal path
- [ ] `GET /api/projects` Next.js route — list all projects
- [ ] `ProjectRepository` class wrapping the API routes
- [ ] Remove `swarmRepoPat` from `agent-config-store` and settings UI
- [ ] Project selector pill (bottom-left of search input)
- [ ] Derive `repo_path` from selected project, pass to swarm as task param

### Phase 2 — Production deployment
- [ ] Provision Supabase, run `alembic upgrade head` against it
- [ ] Provision MongoDB Atlas cluster
- [ ] Provision Upstash Redis
- [ ] Sign up for Temporal Cloud (or spin up Hetzner VPS for self-hosted Temporal)
- [ ] Write `Dockerfile` for Keystone swarm worker
- [ ] Deploy Agentex API container to Fly.io / Railway
- [ ] Deploy Keystone swarm worker container with persistent volume
- [ ] Deploy keystone-ui to Vercel with production env vars
- [ ] Configure `manifest.yaml` with production registry and resource limits

### Phase 3 — Cloud file storage
- [ ] Supabase Storage bucket for project files
- [ ] New `swarm_write_file` / `swarm_read_file` activity implementations using Supabase Storage SDK
- [ ] Update file explorer API routes (`/api/tree`, `/api/files`) to read from Supabase Storage
- [ ] Migrate existing projects from disk to Supabase Storage

### Phase 4 — Multi-user
- [ ] Add `user_id` column to `projects` table (Alembic migration)
- [ ] Supabase Auth integration in gantry-ui
- [ ] Row-level security on `projects` table
- [ ] Scope project listing and task creation per authenticated user
- [ ] API key management UI per user

---

## Notes

- **MongoDB is a hard dependency** — Agentex owns it. Do not plan to eliminate it before
  Phase 3 at the earliest. MongoDB Atlas free tier covers early production.
- **Temporal Cloud vs self-hosted** — Temporal Cloud ($25/mo) is the simplest path.
  A single Hetzner VPS (~$10/mo) running `docker-compose` is viable if cost is a concern.
- **The swarm worker cannot be serverless** — Temporal workflows require a persistent
  long-running worker process. Use a container with a persistent volume, not a Lambda/function.
- **Agentex is Apache 2.0** — no licensing cost, no vendor relationship required.
  Fork it if you need to make changes to the platform layer.
- **K8s is optional for early production** — Fly.io and Railway both run Docker containers
  without requiring a K8s cluster. Use K8s only when you need multi-region or autoscaling.
