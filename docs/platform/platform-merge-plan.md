# Platform merge — implementation plan

**Goal:** One Agentex-native AI infra platform — **Gantry engine + control plane**, **full Gantry web UI** (styling, branding, chat, SSE streaming UX). No legacy Qodex/CoSight domain backend, no second control plane.

**Positioning (horizontal):** Conflict-aware **parallel codegen under an oracle**, with **durable heal** and **bulk** throughput — not “another chat-to-PR agent.”

**Execution rule:** Every step extends existing architecture. **No bandaids** (shims, duplicate endpoints, import hacks, UI-only fixes that bypass `/v1/*`).

---

## 1. Invariants (must hold after every phase)

### Platform (from `PLATFORM_REFACTOR.md`)

| ID | Invariant |
|----|-----------|
| I1 | API works without the UI |
| I2 | Every tenant resource is org-scoped |
| I3 | Structured results, not message scraping (`result.pr_url`, `result.branch`, …) |
| I4 | Secrets shown once |
| I5 | Idempotent migrations |
| I6 | Local dev works without Postgres (file fallback, `GANTRY_HOME` at call time) |
| I7 | Foreman composes **Temporal child workflows** — no ACP `task/create` per crew role |
| I8 | UI is an optional client; public `/v1/*` never proxies to the UI |

### Agentex citizen (from `docs/platform/agentex-citizen.md`)

| ID | Invariant |
|----|-----------|
| C1 | One ACP task entry: `swarm-factory` |
| C2 | Stable crew names + `@workflow.defn` identities in catalog |
| C3 | HITL via REST + audit (`/v1/tasks/{id}/hitl`, `/approve`) |
| C4 | Helm `agentName` / `GANTRY_AGENT_NAME` = `swarm-factory` |

### Merge-specific (this plan)

| ID | Invariant |
|----|-----------|
| M1 | **No Qodex use-case code** — no Hive, GA4/GSC/Emma/Sprout, MarComms/VDR intake, CoSight dashboards |
| M2 | **Single control plane** — UI and integrators talk to Gantry `:8001` `/v1/*`; no Qodex FastAPI `:8000` |
| M3 | **Generic SSE schema** — platform events only; no `intent`, `checklist`, `submitted`, `citations` |
| M4 | **Verticals are playbooks**, not forks — config/templates/connectors plug into engine; no duplicate orchestrator |
| M5 | **Engine before surface** — horizontal capability ships with tests before vertical copy or marketing |
| M6 | **Vercel = static UI only** — Agentex, Temporal, worker stay off Vercel (Hetzner / Helm) |

---

## 2. Strongest horizontal variables

These are the **defensible engine primitives**. Verticals must map to subsets of these — never the reverse.

| ID | Variable | Engine location | What “done” means |
|----|----------|-----------------|-------------------|
| **H-PAR** | Parallel track execution | `workflows/swarm_orchestrator.py`, `workflows/agents/builder.py` | N builders run in waves per Architect plan |
| **H-CON** | Conflict-aware file ownership | `workflows/swarm/track_manager.py` | Colliding `key_files` resolved before parallel wave |
| **H-DEP** | Dependency waves | `track_manager._order_tracks_by_deps` | `depends_on` respected; no blind parallel merge |
| **H-ORA** | Oracle gate (tests/lint/types) | `workflows/agents/inspector.py`, activities | No PR path without inspector pass (tier-dependent) |
| **H-HEAL** | Git-snapshot heal loop | `swarm_orchestrator.py`, `swarm_git_snapshot_*` | Failed oracle → instructions → builder retry |
| **H-REV** | Reviewer → heal | `workflows/agents/reviewer.py` | Logic review re-enters heal, not cosmetic noise |
| **H-BULK** | Bulk task isolation | `api/routes/tasks.py` `/bulk`, quotas | Partial failure OK; per-task org scope + idempotency |
| **H-DUR** | Temporal durability | `worker.py`, Agentex worker | Crash-safe; child workflows unchanged |
| **H-SSE** | Unified run streaming | `GET /v1/tasks/{id}/events` | UI kit consumes one SSE contract |
| **H-HITL** | Named checkpoints + audit | `api/routes/tasks.py`, `project/schema/crew.py` | REST signals; file/DB audit |
| **H-BYOK** | Model router per org | `api/routes/org_settings.py`, `activities/llm_config.py` | Ollama/Groq/Mistral/Anthropic via settings |
| **H-ACP** | Agentex track catalog | `GET /v1/agents`, `manifest.yaml` | L2–L5, crew list, ACP example |

**Marketing headline (horizontal):** *Parallel, oracle-gated codegen with durable heal — at bulk scale.*

---

## 3. Vertical delegation matrix

Verticals **consume** horizontal variables. Do not build a vertical until its required H-* rows are green at the checkpoint.

| Vertical | Priority | Required H-* | Playbook surface (config, not fork) | Defer if missing |
|----------|----------|--------------|--------------------------------------|------------------|
| **V-PLAT** Platform backlog drain | **P0 GTM** | H-BULK, H-PAR, H-CON, H-ORA, H-HEAL, H-DUR, H-SSE | GitHub/Linear/Jira labels → `POST /v1/tasks/bulk`; tier 0–1 default | H-BULK quotas, conflict tests |
| **V-A11Y** Accessibility remediation | **P1 wedge** | H-PAR, H-ORA, H-BULK, H-HEAL, H-HITL | Pipeline adds a11y oracle step; goal templates in playbook YAML | a11y oracle activity |
| **V-MONO** Monorepo feature slices | P2 | H-PAR, H-CON, H-DEP, H-ORA | Architect prompt bias for package boundaries | H-CON tests |
| **V-AGENCY** Multi-repo maintenance | P2 | H-BULK, H-DUR, H-BYOK | One org, many projects; bulk across repos | — |
| **V-AGEX** Agentex ecosystem GTM | P3 | H-ACP, H-DUR, C1–C4 | Cluster docs, ACP invoke; **distribution**, not wedge | — |

**Explicitly out of scope:** MarComms intake, marketing analytics, consumer action gateway (Qodex use cases).

---

## 4. Anti-patterns (reject in code review)

| Anti-pattern | Why forbidden | Do instead |
|--------------|---------------|------------|
| Import helpers from `swarm_orchestrator.py` in tests | Hides wrong module boundary | Import from `workflows/swarm/track_manager.py` |
| New `/api/chat/stream` on Gantry for v1 | Second product surface | Use existing `/v1/tasks` + `/events` SSE |
| Proxy Qodex backend “temporarily” | Violates M2 | Port nothing from Qodex `backend/` except SSE **formatting** utils if needed |
| Vertical-specific `@workflow.defn` | Violates M4 | Playbook config + prompt/tools in activities |
| UI calls Agentex directly for tasks | Violates I8 / split brain | UI → Gantry `/v1/*`; Agentex stays behind API |
| Checklist/intent SSE events | Violates M3 | `status`, `message`, `lifecycle`, `hitl`, `done` |
| Fix `test_track_conflicts` by skipping | Bandaid | Fix public exports in `track_manager.py` |

---

## 5. Phase map

| Phase | Goal | Vertical unlocked |
|-------|------|-------------------|
| **P0** | Engine integrity baseline | — |
| **P1** | Qodex infra extraction (SSE kit) | — |
| **P2** | Unified SSE contract + SDK | H-SSE |
| **P3** | Factory UI on Vercel (strip Next UI) | H-SSE, H-HITL |
| **P4** | Horizontal hardening (CON, BULK, ORA) | **V-PLAT** |
| **P5** | Playbook layer | **V-A11Y**, V-MONO |
| **P6** | Deprecation + GTM docs | V-AGEX |

---

## 6. Gap-audit protocol (every checkpoint)

After the implementer marks a phase **done**, launch **2–3 sprawled agents in parallel**. Each agent files gaps as discrete follow-ups; close gaps **modularly** (one invariant per fix).

| Agent role | Scope | Commands / searches |
|------------|-------|---------------------|
| **G1 — Integrity** | I*, C*, M*, I7, imports, tests | `pytest` targets listed in checkpoint; `rg "execute_child_workflow"`; `rg "task/create"` in `workflows/`; `rg "hive|ga4|cosight|checklist|intent_classifier" -i` |
| **G2 — Contract** | API/SSE/SDK parity | Compare `docs/api.md`, OpenAPI `/docs`, SDK methods, SSE types in UI |
| **G3 — Surface** | UI wiring, docs, deploy | Vercel env vars; no `localhost:8000`; README/runbook; grep `NEXT_PUBLIC` / `VITE_` |

**Checkpoint exit rule:** All three agents report **no open gaps**, or every gap has a tracked fix merged before the next phase starts.

---

## Phase P0 — Engine integrity baseline

**Goal:** Horizontal core tests green; track conflict module boundary correct.

### Deliverables

- [ ] Export `_normalise_path`, `_resolve_track_conflicts` from `workflows/swarm/track_manager.py` only; orchestrator imports from there
- [ ] Fix `tests/test_track_conflicts.py` imports (no import from `swarm_orchestrator`)
- [ ] Add `tests/test_horizontal_contract.py` — documents required H-PAR/H-CON/H-ORA behaviors (pure functions)
- [ ] Confirm `test_agentex_citizen.py` still passes (C1–C4)

### Checkpoint P0

```bash
uv sync --extra dev
.venv/bin/python -m pytest \
  tests/test_track_conflicts.py \
  tests/test_orchestrator_guards.py \
  tests/test_agentex_citizen.py \
  tests/test_horizontal_contract.py \
  -v
```

| Check | Pass criteria |
|-------|---------------|
| P0.1 | `test_track_conflicts.py` collects and passes |
| P0.2 | `rg "from workflows.swarm_orchestrator import _normalise"` → empty |
| P0.3 | `rg "execute_child_workflow" workflows/swarm_orchestrator.py` → present |
| P0.4 | `rg "task/create" workflows/` → empty |

**Gap audit (P0):** G1 runs pytest + I7 grep; G2 verifies `track_manager` is the single source for conflict helpers; G3 N/A.

---

## Phase P1 — Qodex infra extraction (no use cases)

**Goal:** Vendored **infra-only** frontend kit inside Gantry repo; zero domain code.

### Deliverables

- [ ] Create `apps/web/` — Vite + React 19 + Zustand + React Router (match Qodex versions)
- [ ] Port **only**:
  - `SSEClient` async generator (`Qodex/frontend/src/shared/services/sse.ts`)
  - Stream store lifecycle (`startStream`, `appendToStream`, `finalizeStream`, `cancelStream`, `gracefulStop`) — **strip** checklist/intent/submitted
  - `useSmoothStream` (`Qodex/frontend-cosight/src/hooks/useSmoothStream.ts`)
  - UI primitives: Button, Modal, Badge, Spinner, Dropdown, Sidebar shell
- [ ] **Do not port:** `frontend-cosight/`, Hive, Supabase discussions, legacy Qodex chat components, voice, chibi, sample questions
- [ ] Auth: Gantry API key in settings (localStorage) or existing Clerk if retained — **no Supabase requirement for M6/I6**

### Checkpoint P1

```bash
cd apps/web && npm ci && npm run build
rg -i "hive|ga4|emma|sprout|checklist|intent_classifier|cosight" apps/web/src && exit 1 || true
test ! -d apps/web/src/features/intake
test ! -d apps/web/src/features/insights
```

| Check | Pass criteria |
|-------|---------------|
| P1.1 | `apps/web/dist/` builds on CI |
| P1.2 | M1 grep clean (no Qodex domain strings in `apps/web/src`) |
| P1.3 | SSE client has `cancel()` + AbortController |
| P1.4 | No fetch to `:8000` or `/api/chat/stream` |

**Gap audit (P1):** G1 M1/M2 grep; G3 build + bundle size smoke; G2 N/A until wired.

---

## Phase P2 — Unified SSE contract

**Goal:** One platform SSE schema; UI kit consumes Gantry task events (H-SSE).

### Deliverables

- [ ] Document schema in `docs/platform/sse-events.md`:
  - `status`, `lifecycle`, `message`, `hitl` (new emit when HITL pending), `error`, `done`
- [ ] Align `GET /v1/tasks/{id}/events` payloads with schema (extend generator in `api/routes/tasks.py` if needed — **no second stream URL**)
- [ ] Add `apps/web/src/infra/sse/taskEvents.ts` — typed discriminated union matching doc
- [ ] Add `useTaskStream(taskId)` hook wiring to `/v1/tasks/{id}/events` with Bearer token
- [ ] TypeScript SDK: optional `tasks.streamEvents(taskId)` iterator mirroring UI
- [ ] Python SDK: document SSE consumption pattern in README (no duplicate server)

### Checkpoint P2

```bash
.venv/bin/python -m pytest tests/test_task_sse_contract.py -v
cd apps/web && npm test -- --run 2>/dev/null || npm run build
rg "type: 'checklist'|type: 'intent'" apps/web docs/platform/sse-events.md && exit 1 || true
```

| Check | Pass criteria |
|-------|---------------|
| P2.1 | `tests/test_task_sse_contract.py` passes (shape of each event type) |
| P2.2 | M3 — no domain SSE types in repo |
| P2.3 | I3 — `done` event includes structured `result` object |
| P2.4 | I1 — SSE endpoint auth matches `tasks:read` |

**Gap audit (P2):** G2 compares `sse-events.md` ↔ test fixtures ↔ UI types; G1 runs contract test; G3 verifies hook uses `VITE_GANTRY_API_URL`.

---

## Phase P3 — Factory UI on Vercel

**Goal:** Replace optional Next UI with `apps/web` factory lane; HITL + run timeline (M2, I8).

### Deliverables

- [ ] **Factory views only:**
  - Submit — `POST /v1/tasks` (goal, project_id, tier)
  - Run — `useTaskStream` + message timeline
  - HITL cards — `POST /v1/tasks/{id}/hitl` (checkpoints from `project/schema/crew.py`)
  - Agents catalog — `GET /v1/agents`
  - Projects — `GET/POST /v1/projects`
- [ ] Deprecation notice on `ui/` (Next) — README points to `apps/web`
- [ ] Vercel project: root `apps/web`, env `VITE_GANTRY_API_URL`
- [ ] Remove Agentex direct task create from new UI (use Gantry API only)

### Checkpoint P3

```bash
cd apps/web && npm run build
rg "agentex.*task/create|/api/agentex" apps/web/src && exit 1 || true
rg "localhost:8000|/api/chat" apps/web/src && exit 1 || true
.venv/bin/python -m pytest tests/test_agentex_citizen.py::test_agents_and_hitl_routes_without_api_main -v
```

| Check | Pass criteria |
|-------|---------------|
| P3.1 | Manual: submit → run stream → terminal `done` with `result` |
| P3.2 | M2 — all control plane calls go to `:8001/v1/` |
| P3.3 | I8 — no public `/v1` proxy in Vite config |
| P3.4 | C3 — HITL card fires audit entry (`GET .../hitl`) |
| P3.5 | H-HITL visible in UI for tier 2+ checkpoints |

**Gap audit (P3):** G3 full click-path checklist; G2 OpenAPI vs UI fields; G1 I2 org isolation on task poll.

---

## Phase P4 — Horizontal hardening (V-PLAT unlock)

**Goal:** Make **H-CON**, **H-BULK**, **H-ORA** visible and tested — platform backlog vertical ready.

### Deliverables

- [ ] **H-CON:** Log conflict warnings in Foreman report; expose in task `GET` metadata optional `track_warnings[]`
- [ ] **H-BULK:** Integration test — 10 trivial goals, assert isolation (one failure doesn’t block others)
- [ ] **H-ORA:** Document tier → oracle steps in `docs/platform/oracle-tiers.md`
- [ ] **H-BYOK:** Default org settings template for Ollama/Groq (dev) + Anthropic (prod) in `docs/platform/llm-byok.md`
- [ ] README horizontal section: parallel + oracle + bulk (not “AI coder”)
- [ ] SDK `tasks.bulk()` example in README

### Checkpoint P4

```bash
.venv/bin/python -m pytest \
  tests/test_track_conflicts.py \
  tests/test_bulk_isolation.py \
  tests/test_platform_phase0.py \
  -v
```

| Check | Pass criteria |
|-------|---------------|
| P4.1 | H-CON tests cover same-wave collision + dep wave separation |
| P4.2 | H-BULK test: `submitted` + `failed` counts match input |
| P4.3 | I2 — bulk tasks scoped to org; cross-org poll 404 |
| P4.4 | I7 unchanged — grep child workflow composition |
| P4.5 | **V-PLAT** playbook doc: `docs/verticals/platform-backlog.md` (label → bulk API) |

**Gap audit (P4):** G1 runs bulk + conflict suites; G2 verifies quota errors are 429 not 500; G3 docs match API.

---

## Phase P5 — Playbook layer (V-A11Y, V-MONO)

**Goal:** Verticals as **config + prompts + oracle extensions** (M4).

### Deliverables

- [ ] Add `playbooks/` tree:
  ```
  playbooks/
    platform-backlog/   # V-PLAT — goal templates, label hints
    a11y-remediation/   # V-A11Y — WCAG goal patterns, a11y oracle config
    monorepo-slice/     # V-MONO — architect prompt overlay
  ```
- [ ] Playbook selector on `POST /v1/tasks` optional field `playbook: string` → merges pipeline config (no new workflow)
- [ ] **V-A11Y:** Inspector activity hook for axe/pa11y or eslint-plugin-jsx-a11y when playbook=`a11y-remediation`
- [ ] **V-MONO:** Architect system overlay for `depends_on` / package boundaries
- [ ] UI: playbook dropdown on submit (defaults to `platform-backlog`)

### Checkpoint P5

```bash
.venv/bin/python -m pytest tests/test_playbooks.py -v
rg "@workflow.defn" playbooks/ && exit 1 || true
```

| Check | Pass criteria |
|-------|---------------|
| P5.1 | Unknown playbook → 422 |
| P5.2 | M4 — playbooks contain **no** Python workflow defs |
| P5.3 | V-A11Y — test fixture repo fails oracle without fix, passes after heal |
| P5.4 | V-MONO — conflict test with two packages, no same-file parallel claim |
| P5.5 | Horizontal matrix in doc matches implemented playbook flags |

**Gap audit (P5):** G1 M4 grep; G2 playbook JSON schema validated in tests; G3 UI playbook labels match backend enum.

---

## Phase P6 — Deprecation + GTM

**Goal:** Single story; Agentex distribution doc updated.

### Deliverables

- [ ] Archive `ui/` (Next) — README “removed in favor of apps/web”
- [ ] Remove references to Qodex Render backend from any merged docs
- [ ] Update `README.md` — horizontal headline + vertical table (V-PLAT primary)
- [ ] Update `docs/platform/agentex-cluster.md` — UI is Vercel `apps/web`
- [ ] `DEPLOYMENT.md` — Vercel root `apps/web` instead of `ui/`

### Checkpoint P6

```bash
rg "Root Directory.*\\bui\\b" DEPLOYMENT.md
rg "hive|CoSight|Qodex intake" README.md docs/ && exit 1 || true
.venv/bin/python -m pytest tests/test_agentex_citizen.py tests/test_playbooks.py -v
```

| Check | Pass criteria |
|-------|---------------|
| P6.1 | DEPLOYMENT.md points to `apps/web` |
| P6.2 | M1 — no domain Qodex marketing in platform docs |
| P6.3 | C1–C4 still pass |
| P6.4 | V-AGEX cluster doc + ACP example unchanged |

**Gap audit (P6):** G3 deploy dry-run; G2 doc link check; G1 full pytest subset.

---

## 7. Master check-stop (release gate)

Run before any external launch:

```bash
# Integrity
.venv/bin/python -m pytest \
  tests/test_track_conflicts.py \
  tests/test_orchestrator_guards.py \
  tests/test_agentex_citizen.py \
  tests/test_horizontal_contract.py \
  tests/test_task_sse_contract.py \
  tests/test_bulk_isolation.py \
  tests/test_playbooks.py \
  tests/test_platform_phase0.py \
  -v

# Invariants grep
rg "task/create" workflows/ && exit 1 || true
rg -i "hive_api|ga4_property|show_checklist" apps/ api/ workflows/ && exit 1 || true
rg "acp_type: async" manifest.yaml project/acp.py
rg "agentName: swarm-factory" deploy/helm/gantry/values.yaml

# UI
cd apps/web && npm run build
```

| Gate | Owner agent |
|------|-------------|
| All pytest green | G1 |
| I7 + C1–C4 + M1–M6 | G1 |
| SSE + SDK + OpenAPI align | G2 |
| Vercel build + env sample | G3 |

---

## 8. Bot execution checklist (copy per session)

```
[ ] Read PLATFORM_REFACTOR.md + this file + agentex-citizen.md
[ ] Confirm current phase from git/log; do not skip phases
[ ] Implement deliverables only for active phase
[ ] Run phase checkpoint commands
[ ] Launch G1 + G2 + G3 gap audits in parallel
[ ] Fix gaps modularly (one invariant per PR)
[ ] Mark phase complete only when all checks pass
[ ] Do not add bandaids listed in §4
```

---

## 9. Horizontal ↔ vertical quick reference

| Sell this horizontal… | …to this vertical first | Playbook id |
|------------------------|-------------------------|-------------|
| Bulk + oracle + heal | Platform eng backlog | `platform-backlog` |
| Oracle + heal + HITL | A11y remediation | `a11y-remediation` |
| CON + DEP + PAR | Monorepo slices | `monorepo-slice` |
| ACP + catalog + REST | Agentex partners | *(no playbook — docs only)* |

**Uniqueness lives in H-PAR + H-CON + H-ORA + H-HEAL + H-BULK together** — not in SSE chrome or Agentex naming alone.

---

## 10. Execution log (2026-09-09)

| Phase | Result |
|-------|--------|
| P0 | `test_track_conflicts` imports `track_manager`; `test_horizontal_contract` added |
| P1–P3 | `apps/web/` Vite factory UI + SSE kit; Vercel `vercel.json`; `ui/` archived |
| P2 | `api/schemas/task_sse.py`, `docs/platform/sse-events.md`, `test_task_sse_contract` |
| P4 | `test_bulk_isolation`, `track_warnings` + `pending_hitl` meta patch, `docs/verticals/platform-backlog.md`, `docs/platform/oracle-tiers.md` |
| P5 | Playbooks + overlays (a11y oracle, monorepo architect), `test_playbook_verticals`, `docs/verticals/README.md` horizontal matrix |
| P6 | README horizontal/vertical, `dev.sh` → `apps/web`, `ui/` removed, release gate script |

**Release gate:** `bash scripts/release_gate.sh` — **77 pytest + invariants + apps/web build** (2026-09-09).

**Gap closure (Qodex UI ↔ Gantry):** [`qodex-gantry-gap-closure.md`](qodex-gantry-gap-closure.md) — HITL, hubspaces, factory copy, run route, Supabase optional.
