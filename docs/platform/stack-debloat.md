# Stack de-bloat plan

Cut accidental weight without changing the factory engine (I7) or API-first invariants (I1, I8).

## Goals

1. Remove unused direct dependencies and orphan scaffolding.
2. Keep Agentex/Temporal cost where the SDK and platform require it.
3. Document the correct **Agentex citizen** boundary so infra tax is not mistaken for Gantry product surface.

## Phases

| Phase | Change | Status |
|-------|--------|--------|
| **P1** | Drop unused Python deps: `playwright`, `tavily-python`, `beautifulsoup4`, `lxml`, direct `scale-gp` | Done (this PR) |
| **P2** | Delete root demo frontend (`package.json` legal-compliance-app, Tic-Tac-Toe `index.html`, `vite.config.js`, root lock) | Done (this PR) |
| **P3** | Trim web: remove `recharts`, `papaparse`, `html-to-image`, `html2canvas`, `@supabase/supabase-js`; local `AuthUser` | Done (this PR) |
| **P4** | Ops: prefer one deploy path doc (compose/systemd primary; Helm secondary); no new packaging | Doc only (this PR) |
| **P5** | Freeze `apps/web` feature growth; treat as run console (I8) | Policy — ongoing |
| **P6** | Worker push status/lifecycle; demote Agentex poller to 60s fallback | Done |

## What we are not changing

- Temporal Foreman + child workflows (I7)
- FastAPI control plane + org-scoped tenancy (I1–I2)
- Dual SDK surface (thin; API-first)
- Agentex as the ACP/Temporal host for the worker

Playbook/crew evolution (composable firm packs without becoming chat bots):
[`composable-crew-roadmap.md`](./composable-crew-roadmap.md).

---

## Agentex separation — correct vs current

### What the Agentex SDK / citizen model expects

```
┌─────────────────────────────────────────────────────────┐
│ Agentex cluster (platform dependency — not Gantry)      │
│   Agentex API :5003                                     │
│   Temporal (+ Temporal Postgres)                        │
│   Redis · Agentex Postgres · Mongo                      │
└──────────────────────────▲──────────────────────────────┘
                           │ ACP task/create · Temporal
┌──────────────────────────┴──────────────────────────────┐
│ Gantry agent (citizen)                                  │
│   manifest.yaml · project/acp.py (FastACP)              │
│   worker.py (AgentexWorker) · workflows/ · activities/  │
│   Only ACP entry: swarm-factory (C1); children Temporal │
└──────────────────────────▲──────────────────────────────┘
                           │ HTTP submit / structured result
┌──────────────────────────┴──────────────────────────────┐
│ Gantry control plane (Gantry-owned)                     │
│   api/ FastAPI · org keys · projects · quotas · audit   │
│   Gantry DATABASE_URL (or GANTRY_HOME file fallback I6) │
│   apps/web optional client → /v1/* only (I8)            │
└─────────────────────────────────────────────────────────┘
```

| Concern | Owner | Store / runtime |
|---------|--------|-----------------|
| Task queue, workflow durability, ACP RPC | **Agentex** | Temporal, Redis, Agentex PG, Mongo |
| Crew execution (plan/build/heal/PR) | **Gantry agent** | Worker process on Agentex Temporal |
| Tenancy, API keys, quotas, webhooks, structured `result` | **Gantry API** | Gantry Postgres *or* files |
| Operator UI | **Optional** | Static SPA → Gantry API only |

Invariants from [`agentex-citizen.md`](./agentex-citizen.md): **C1** one ACP entry `swarm-factory`; **I7** children are Temporal, not per-role ACP servers; **I1** API works without UI.

### What Gantry does today (mostly correct, some blur)

| Area | Correct? | Notes |
|------|----------|--------|
| Worker uses `AgentexWorker` + FastACP | Yes | True citizen pattern |
| Foreman composes Temporal children, not ACP | Yes | I7 / C1 |
| Control plane submits via Agentex HTTP RPC | Yes | `api/clients/agentex.py` |
| Structured results via `db_upsert_build` into Gantry DB | Yes | I3 preferred path |
| Separate Gantry `DATABASE_URL` from Agentex Postgres | Yes | Two DBs is **correct separation**, not duplicate product state |
| `deploy/agentex/` vendors Agentex for bootstrap | OK (labeled) | Bundle vs `AGENTEX_MODE=external` attach; see [`agentex/README.md`](../../deploy/agentex/README.md) |
| Worker push + slow fallback poller | Yes | Primary: `db_notify_task_status` / `db_upsert_build`; poller 60s safety net ([`event-model.md`](./event-model.md)) |
| Direct deps `playwright` / `tavily` / `bs4` / `scale-gp` | Wrong | Unused; `scale-gp` already transitive via `agentex-sdk` |
| Optional UI ~16k LOC + Supabase types | Overbuilt | Auth is API-key; UI should stay a thin run console |

### Infra tax — what to accept vs isolate

**Accept (Agentex tax):** Temporal + Redis + Agentex Postgres + Mongo while remaining an Agentex citizen. Also accept `agentex-sdk`’s heavy transitive tree (`scale-gp`, litellm, etc.) — that cost is the platform SDK, not Gantry inventing stacks.

**Isolate (Gantry-owned):** Only Gantry tenancy DB (or files), API process, worker process, optional UI. Do not put tenant keys/quotas in Agentex Mongo/Postgres. Do not run Gantry API inside the Agentex container.

**Do not confuse:** “Four databases in docker-compose” ≠ “Gantry needs four databases.” Three (Temporal PG, Agentex PG, Mongo) + Redis belong to Agentex; one optional Postgres belongs to Gantry.

### Target attachment modes

1. **Shared Agentex cluster (preferred at scale):** Point `AGENTEX_BASE_URL` / `TEMPORAL_ADDRESS` at existing platform; run only `gantry-api` + `gantry-worker` (+ Gantry DB). See [`agentex-cluster.md`](./agentex-cluster.md).
2. **Bundled self-host (CX22 path):** `deploy/agentex/docker-compose.yml` brings Agentex up for convenience (`AGENTEX_MODE=bundle`).

---

## Verification

```bash
# Python lock still resolves without dropped packages
uv lock

# Web builds without removed packages
cd apps/web && npm ci && npm run build

# Platform / citizen tests (no live Agentex required)
pytest tests/test_agentex_citizen.py tests/test_platform_phase0.py -q
```
