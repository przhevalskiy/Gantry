# Agentex citizen — implementation plan

Make Gantry a first-class Agentex citizen: named crew on the track, L1–L5 language, ACP + HITL as Scale-shaped doors. **Do not replace Temporal orchestration.** REST stays the integrator API (`I1`, `I3`, `I8`).

## Invariants (must hold after every phase)

Carried from `PLATFORM_REFACTOR.md`:

| ID | Invariant |
|----|-----------|
| I1 | API works without the UI |
| I2 | Every *tenant* resource is org-scoped |
| I3 | Structured results, not message scraping |
| I4 | Secrets shown once |
| I5 | Idempotent migrations |
| I6 | Local dev works without Postgres |
| I7 | Workflow engine unchanged — Foreman still starts Temporal child workflows |
| I8 | UI is an optional client; `/v1/*` never proxies to the UI |

Citizen-specific:

| ID | Invariant |
|----|-----------|
| C1 | One ACP task entry: `swarm-factory` (Foreman). Sibling Agentex agents call this name. |
| C2 | Each crew role has a stable Agentex/Temporal identity (name + workflow.defn). |
| C3 | HITL is reachable via REST (`/v1/tasks/{id}/hitl` and existing `/approve`), with an audit record (DB or file). |
| C4 | Helm `agentName` matches `GANTRY_AGENT_NAME` / `swarm-factory`. |

## Phases

### P0 — Catalog + ACP hygiene

- Single source of truth: `project/schema/crew.py` (agents, L-levels, HITL checkpoints, ACP invoke).
- Map tiers 0–3 → Agentex L2–L5 in `complexity.py`.
- `manifest.yaml`: `acp_type: async`; list every Temporal workflow the worker already registers.

**Check-stop:** unit tests for catalog, L-level map, unique names; `manifest.yaml` `acp_type` is `async`; every `@workflow.defn` name appears in the manifest.

### P1 — Track API (REST)

- `GET /v1/agents` — full crew catalog + autonomy table + ACP example (auth: `tasks:read`).
- `GET /v1/agents/{name}` — one agent.
- `POST /v1/tasks/{id}/hitl` — checkpoint + signal + payload; audit; keep `POST .../approve`.
- File-backed `audit_repo` when `DATABASE_URL` is unset (`I6`).
- Task responses include `autonomy_level` when tier is known.

**Check-stop:** `pytest` catalog + HITL + audit file fallback; no Temporal/Agentex required.

### P2 — Cluster install

- Helm: `agentex.agentName: swarm-factory`; set `GANTRY_AGENT_NAME` and `AGENT_NAME`.
- `docs/platform/agentex-cluster.md` — add Gantry to an existing Agentex cluster; ACP `task/create` example.

**Check-stop:** Helm values/configmap grep; doc contains ACP JSON-RPC and `C1`.

### P3 — Surfaces

- Python + TypeScript SDKs: `agents.list()`, `tasks.hitl()`.
- UI docs: Agentex + L-levels; API docs endpoints.
- README: two doors (REST + ACP), engine unchanged.

**Check-stop:** SDK methods exist; docs mention L2–L5 and `/v1/agents`.

### Out of scope (I7)

Foreman does **not** compose children via ACP `task/create`. Children stay Temporal child workflows. Independent ACP servers per role are not added in this pass.

## Execution check-stop (2026-08-25)

| Stop | Result |
|------|--------|
| P0 catalog, L-levels, unique names, manifest `acp_type: async`, every `@workflow.defn` in worker + manifest | Pass (`tests/test_agentex_citizen.py`) |
| P1 `GET /v1/agents`, HITL 404/422/200, file-backed audit org isolation | Pass (mini FastAPI, no `api.main` lifespan) |
| P2 Helm `agentName: swarm-factory`, `GANTRY_AGENT_NAME` + `AGENT_NAME` in ConfigMap | Pass |
| P3 SDK `agents`/`hitl`, docs L2–L5 and `/v1/agents` | Pass |
| I7 Foreman uses `execute_child_workflow`, no child `task/create` | Pass |
| C1 Catalog `acp_agent` is always `swarm-factory` (not process `AGENT_NAME`) | Pass |
| I6 Keys/tasks/audit file paths resolve `GANTRY_HOME` at call time | Pass (`tests/test_platform_phase0.py`) |

`tests/test_track_conflicts.py` still fails collection (`_normalise_path` missing) — pre-existing, out of this plan. Live `tests/test_api_smoke.py` needs a running API on `:8001`.

