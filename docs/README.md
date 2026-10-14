# Gantry documentation

**Product:** a silicon engineering firm — one Foreman (`swarm-factory`), staffed Operators, API-first control plane.  
**Promise:** retain a practice → file a work order → receive a structured change artifact (`pr` \| `branch` \| `patch` \| `report`).  
**Surface today:** REST `/v1/*` + SDKs + webhooks. **No in-repo web UI.**

Start here before any full-stack / frontend work. Brand under [`brand/`](./brand/) is locked with this set; frontend rebuild is deferred until both are treated as truth.

---

## Core docs (read in order)

| Doc | What it covers |
|-----|----------------|
| [`architecture.md`](./architecture.md) | System layout: API → Agentex → Temporal Foreman → workers |
| [`platform.md`](./platform.md) | Invariants I1–I8, citizen C1–C4, product P1–P4, concepts |
| [`use-cases.md`](./use-cases.md) | Who uses Gantry and how (headless, CI, ticketing, future UI) |
| [`api.md`](./api.md) | **Current** REST API — auth, scopes, every mounted route |

## Technical deep dives

| Doc | Topic |
|-----|--------|
| [`deep-dives/swarm-factory.md`](./deep-dives/swarm-factory.md) | Foreman DAG, tiers, heal, artifact types |
| [`deep-dives/hitl-and-sse.md`](./deep-dives/hitl-and-sse.md) | HITL checkpoints, SSE event contract |
| [`deep-dives/playbooks-and-packs.md`](./deep-dives/playbooks-and-packs.md) | Job packets + firm packs |
| [`deep-dives/control-plane.md`](./deep-dives/control-plane.md) | Tenancy, keys, quotas, webhooks, internal routes |

## Platform reference (still current)

| Doc | Topic |
|-----|--------|
| [`platform/event-model.md`](./platform/event-model.md) | Push-primary status sync (I3) |
| [`platform/sse-events.md`](./platform/sse-events.md) | SSE event types |
| [`platform/oracle-tiers.md`](./platform/oracle-tiers.md) | Tier → oracle matrix |
| [`platform/agentex-citizen.md`](./platform/agentex-citizen.md) | One ACP citizen (`swarm-factory`) |
| [`platform/agentex-cluster.md`](./platform/agentex-cluster.md) | Join an Agentex cluster |
| [`platform/llm-byok.md`](./platform/llm-byok.md) | BYOK / LLM config |
| [`platform/scaling-workers.md`](./platform/scaling-workers.md) | Worker scaling |
| [`platform/composable-crew-roadmap.md`](./platform/composable-crew-roadmap.md) | Phases A–E (implemented) |
| [`platform/frontend-structure.md`](./platform/frontend-structure.md) | Exact `apps/web` tree + IA remap |
| [`platform/frontend-architecture.md`](./platform/frontend-architecture.md) | FE restart baseline + slice order |

## Brand (future client)

[`brand/README.md`](./brand/README.md) — firm positioning, Operators, Muse-like messaging direction. Rebuild FE only after brand + backend are locked.

## Integrations & verticals

| Doc | Topic |
|-----|--------|
| [`integrations/github-app.md`](./integrations/github-app.md) | GitHub App |
| [`integrations/github-issues.md`](./integrations/github-issues.md) | Issues → tasks |
| [`integrations/linear.md`](./integrations/linear.md) | Linear webhook |
| [`integrations/jira.md`](./integrations/jira.md) | Jira webhook |
| [`github-integration.md`](./github-integration.md) | GitHub overview |
| [`verticals/README.md`](./verticals/README.md) | Vertical playbooks |

## Ops

| Doc | Topic |
|-----|--------|
| [`../DEPLOYMENT.md`](../DEPLOYMENT.md) | API + worker + Agentex deploy (no static UI) |
| [`../GANTRY_THESIS.md`](../GANTRY_THESIS.md) | Product thesis |

---

## What was removed

Obsolete browser-agent roadmaps, Qodex gap plans, Vercel/`apps/web` hosting plans, and stack-debloat checklists were deleted. Do not resurrect them. Live OpenAPI: `http://localhost:8001/docs` when the API is running.
