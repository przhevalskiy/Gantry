# Frontend technical architecture — modular theater over Gantry API

**Status:** Scaffold for greenfield roadmap (G0–G3)  
**Product direction:** [`../brand/frontend-greenfield.md`](../brand/frontend-greenfield.md)  
**Brand / identity:** [`../brand/README.md`](../brand/README.md) · [`../brand/frontend-agent-representation.md`](../brand/frontend-agent-representation.md)  
**Backend lock:** Phases A–E ([`composable-crew-roadmap.md`](./composable-crew-roadmap.md)) — I1, I7, I8, C1, P1–P4  
**Code:** `apps/web/src/modules/*` + `apps/web/src/app/*` — **legacy `features/*` dropped** (Muse-like L5 theater cutover)

---

## 1. Thesis

The UI is an **optional, fully modular client** of the existing org API. It never owns orchestration.

```
Brand (firm) + Design kit (Operators) + Muse-like engagement
                    │
                    ▼
        apps/web modules (domain packages)
                    │
                    ▼
     gantryClient / SSE / HITL  →  /v1/*
                    │
                    ▼
   FastAPI → Temporal Foreman (swarm-factory) → structured result
```

| Layer | Owns | Does not own |
|-------|------|--------------|
| **Brand** | Vocabulary, firm metaphor, Operator portrait system | Runtime seats |
| **Modules** | Domain UI, local view-models, presentation adapters | Workflow DAG / ACP forks |
| **Kernel** | Auth, HTTP, SSE normalize, shell tokens, invariants | Product copy as SoR |
| **API** | Tasks, playbooks, packs, HITL, artifacts, agents | Browser shadow factory |

One line:

> Modules compose a Muse-grade engagement theater; the backend remains the only factory.

---

## 2. Backend properties the FE must respect

These are **facts of the shipped API**, not aspirational contracts.

| Property | Implication for modules |
|----------|-------------------------|
| **I8** — UI optional client of `/v1/*` | Every primary action has a REST/SSE binding; no local “fake run” as product path |
| **C1 / I7** — one ACP `swarm-factory` | No module invents per-playbook agents or bot marketplace UI |
| **P1** — `POST /v1/tasks` (+ `playbooks.run`) → structured `result` | Engagement climax = artifact from `result`, not chat thank-you |
| **Org-scoped** resources | Kernel carries API key / org context; modules never assume global catalogs |
| **Playbooks = job packets** | Briefs module edits config; cannot mint Temporal roles (P3) |
| **Firm packs = practices** | Practices module install/enable/quota only |
| **HITL via REST + audit (C3)** | HITL cards call `POST /v1/tasks/{id}/hitl` — not prose “please approve” |
| **SSE event model** | Stream types: `status` · `lifecycle` · `message` · `hitl` · `error` · `done` ([`sse-events.md`](./sse-events.md)) |
| **Agents catalog** | `GET /v1/agents` advertises crew seats + autonomy tiers — Operator kit binds here |
| **Workspaces** | Repos / file tree / workspace artifacts — Stage + Workspaces modules |
| **No per-user Muse VM** | Thin client; no hatchling / personal cloud-PC product surface |

### Route → domain ownership

| API surface | Owning module(s) | Greenfield route |
|-------------|------------------|------------------|
| `POST/GET /v1/tasks`, followup, terminate, report, traces | `matters`, `engagement` | `/jobs`, `/jobs/:id` |
| `GET /v1/tasks/{id}/events` (SSE) | `kernel` (transport) → `engagement` (projection) | Engagement thread |
| `POST/GET /v1/tasks/{id}/hitl`, approve | `hitl` | Inline cards |
| `GET/POST/PATCH/DELETE /v1/playbooks`, `POST …/run` | `briefs` | `/briefs` |
| `GET/POST/PATCH/DELETE /v1/packs` | `practices` | `/practices` |
| `GET /v1/agents` | `operators` | `/people` + Floor |
| `GET/POST… /v1/workspaces`, files, artifacts list | `workspaces`, `stage` | `/workspaces` |
| `POST/GET/DELETE /v1/artifacts` | `artifacts` | Artifact dock |
| `GET /v1/settings`, keys, usage, audit | `kernel` / future `org` | Settings (later) |
| Integrator docs (static + SDK) | shell route only | `/develop` |

---

## 3. Modularization rules

### Package shape

Each domain lives under `apps/web/src/modules/<domain>/`:

```
modules/<domain>/
  README.md          # purpose, backend binding, brand vocabulary
  index.ts           # public barrel only
  api.ts             # thin wrappers over gantryClient (optional)
  types.ts           # domain view-models (not raw DTO dump)
  model/             # normalize API → view-model
  components/        # UI owned by this domain
  store.ts           # zustand (or none) — domain-local only
```

### Dependency direction (hard)

```
pages / app shell
    → modules/* (feature domains)
        → modules/kernel
        → modules/operators   (identity kit; presentation)
        → shared/services/gantry  (HTTP/SSE until kernel absorbs)
        → design/tokens
```

| Allowed | Forbidden |
|---------|-----------|
| `engagement` → `operators`, `hitl`, `artifacts`, `kernel` | `practices` → `engagement` internals |
| `matters` → `kernel`, `operators` (roster preview) | `operators` → `engagement` / chat stores |
| `home` → public barrels of matters, practices, briefs, operators | Cross-import of another module’s `store.ts` or private files |
| Legacy `features/*` may call modules | New greenfield code must not deepen `features/chat` debt |

Legacy `features/*` has been **removed**. All surfaces import from `@/modules/*` barrels and `app/pages/*`.

### Naming alignment (brand SoR)

| Code / module | Brand term | Avoid |
|---------------|------------|--------|
| `matters` | Matters / Jobs | Chat sessions, discussions |
| `engagement` | Engagement thread / floor | Companion chat, Muse DM |
| `practices` | Practices (firm packs) | Bot packs, marketplace |
| `briefs` | Briefs (playbooks) | Prompt personas |
| `operators` | Operators / Foreman | Dots, chibis, pets |
| `artifacts` | Deliverables | Replies as success |
| `EngagementEvent` | Atomic feed unit | `ChatMessage` as domain model |

---

## 4. Domain modules

### `kernel` — platform client

**Purpose:** Auth, HTTP facade, SSE subscribe/normalize, shell layout invariants, design-token bridge, deploy env.

**Backend:** `/health`, auth key store, `GET …/events`, shared error mapping.

**Exports (target):** `useGantryApi`, `subscribeTaskEvents`, `SHELL_GREENFIELD_INVARIANTS`, token helpers.

**Brand:** Carries firm shell (wordmark, lavender wash) — not product IA.

---

### `operators` — identity kit

**Purpose:** Operator portrait system, presence field, engagement-floor layout, People directory.

**Backend:** `GET /v1/agents` (+ task traces / lifecycle for presence projection).

**Components:** `OperatorPortrait`, `ForemanPresence`, `EngagementFloor`, `PeopleDirectory`.

**Brand lock:** [`frontend-agent-representation.md`](../brand/frontend-agent-representation.md) — portraits + bezel + presence; no Dots/chibis as primary identity.

**Presence mapping (SSE → field):**

| Signal | Presence |
|--------|----------|
| Role active in lifecycle / traces | `active` (desk light) |
| Pending HITL for seat/checkpoint | `blocked` (amber hold) |
| Stage complete / terminal | `done` |
| Tier ghosts unstaffed L5 seats | `ghost` (preview only) |

---

### `engagement` — Muse-like theater core

**Purpose:** Interruptible firm thread for one job; projects SSE + messages into `EngagementEvent[]`.

**Backend:** task get/messages/followup + SSE; compose submit via matters/briefs APIs.

**Components:** `FirmChat`, `EngagementThread`, `JobComposer`, `ActivitySheet`.

**Atomic model:** `EngagementEvent` — may *render* as a bubble; domain is not “chat message.”

**Identity:** Foreman = conversational anchor; Operators attributed on floor + log lines — never a single pet face hiding the crew.

---

### `hitl` — approval cards

**Purpose:** Deterministic approve/reject UI for checkpoints.

**Backend:** `GET/POST /v1/tasks/{id}/hitl`, `POST …/approve`.

**Components:** `HitlCard`, `HitlSheet`.

**Brand:** Partner approval — crisp cards (Muse Sentinel-like), firm language.

---

### `artifacts` — deliverable climax

**Purpose:** Structured `result` + uploaded artifacts as first-class UI.

**Backend:** task `result`, report, `/v1/artifacts`, workspace artifact lists.

**Components:** `ArtifactCard`, `ArtifactDock`.

**Success criterion:** Job feels finished when the artifact lands — not when the stream stops talking.

---

### `matters` — durable jobs

**Purpose:** Goals-tab analogue — list/filter matters; open engagement.

**Backend:** `GET /v1/tasks`, task summary fields (`status`, `playbook`, `result`, …).

**Routes:** `/jobs`, deep link `/jobs/:id` → engagement page composition.

---

### `practices` — firm packs

**Purpose:** Install / enable / quota practices on retainer.

**Backend:** `/v1/packs*`.

**Route:** `/practices` (legacy `/packs` redirects).

**Brand:** Practice areas — never bot marketplace.

---

### `briefs` — playbooks

**Purpose:** CRUD + run job packets.

**Backend:** `/v1/playbooks*`, `POST /v1/playbooks/run`.

**Route:** `/briefs`.

**Constraint:** UI may edit stages/overlays that the API accepts; cannot invent unregistered Temporal roles (P3).

---

### `workspaces` — repos

**Purpose:** Workspace CRUD, GitHub bind, instructions.

**Backend:** `/v1/workspaces*`, GitHub browser helpers.

**Route:** `/workspaces`.

---

### `stage` — work product surface

**Purpose:** Diff / preview / file tree when the deliverable is code-shaped.

**Backend:** workspace files tree/content, GitHub tree/file, task source.

**Components:** `StagePane`, file tree adapters (may wrap legacy IDE pieces during migration).

---

### `home` — first viewport

**Purpose:** Brand-first open: Foreman presence, composer, practice/brief ideas, active matters ghost.

**Composes:** public APIs of `operators`, `engagement` (composer), `matters`, `practices`, `briefs`.

**Brand test:** First paint without nav still reads **Gantry the firm** ([`frontend-greenfield.md`](../brand/frontend-greenfield.md) acceptance).

---

## 5. Page composition (greenfield IA)

Pages are thin assemblers — not domain owners.

| Route | Assembler | Modules |
|-------|-----------|---------|
| `/` | HomePage | `home`, `operators`, `matters` |
| `/jobs/:id` | EngagementPage | `engagement`, `operators`, `hitl`, `artifacts`, `stage` |
| `/jobs` | MattersPage | `matters` |
| `/practices` | PracticesPage | `practices` |
| `/briefs` | BriefsPage | `briefs` |
| `/people` | PeoplePage | `operators` |
| `/workspaces` | WorkspacesPage | `workspaces` |
| `/develop` | DeveloperPage | docs only (legacy ok) |

### Engagement composition (canonical)

```
┌─ engagement.FirmChat ───────────────────┬─ operators.EngagementFloor ─┐
│  EngagementEvent stream                 │  portraits · presence         │
│  hitl.HitlCard inline                   │  tap → ActivitySheet          │
│  artifacts.ArtifactCard inline          ├─ artifacts.ArtifactDock ──────┤
│  JobComposer (followup / amend)         │  PR · branch · patch · report │
├─ stage.StagePane (optional) ────────────┴───────────────────────────────┘
```

---

## 6. Design system alignment

| Concern | Location | Rule |
|---------|----------|------|
| Tokens | `design/tokens.css` | CSS variables only; no new hardcoded brand hex in modules |
| Shell | `kernel` + existing layout | Soft firm atmosphere; wordmark hero on Home |
| Type | Albert Sans (+ restrained display) | No Inter/Roboto/system as brand face |
| Motion | module-owned, few | Presence on, HITL hold, artifact land (greenfield § Visual) |
| Cards | HITL + interactive only | No decorative card grids in hero |
| Operator kit | `modules/operators` | Single versioned portrait system (`operator-portraits@1` direction) |

Greenfield shell invariants (extend, don’t silently contradict `design/shellInvariants.ts` until cutover):

| Key | Rule |
|-----|------|
| `client` | Thin client of `/v1/*` — I8 |
| `factory` | One `swarm-factory` — no bot marketplace UI |
| `engagement` | Chat-shaped theater; domain model is EngagementEvent + Matter |
| `identity` | Foreman + Operator portraits; no companion-pet product |
| `climax` | Structured artifact from API `result` |
| `ia` | Home · Jobs · Matters · Practices · Briefs · People · Workspaces · Develop |

---

## 7. Data flow

```
User action (composer / HITL / install pack)
        │
        ▼
  module api.ts  →  gantryClient  →  /v1/*
        │
        ▼
  SSE (task events) ──normalize──► EngagementEvent[] / presence / HITL queue
        │
        ▼
  module components render (FirmChat, Floor, HitlCard, ArtifactDock)
        │
        ▼
  done + result ──► ArtifactDock (climax)
```

| View-model | Source |
|------------|--------|
| `MatterSummary` | task list DTO |
| `EngagementEvent` | messages + SSE `message`/`lifecycle`/`hitl`/`done` |
| `OperatorSeat` | agents catalog × playbook stages × live traces |
| `HitlCheckpoint` | `pending_hitl` + SSE `hitl` |
| `Deliverable` | `result` + report + artifact records |
| `Practice` | pack DTO |
| `Brief` | playbook DTO |

---

## 8. Cutover status

| Area | Status |
|------|--------|
| Home / Engagement / Matters / Practices / Briefs / People / Workspaces / Develop | **Shipped (G0/G1 shell)** |
| Operator portraits (CSS kit v0) + Floor + HITL cards + Artifact dock | **Shipped** |
| Real `/v1/tasks` submit, SSE, HITL, packs, playbooks, agents, workspaces | **Wired** |
| Stage (diff/preview) | **Stub module** — G2 |
| Portrait art kit v1 / presence polish | **G2** |
| Legacy `features/*` chat/IDE/console | **Deleted** |
| Legacy routes (`/runs`, `/packs`, `/chat`, …) | Redirect to greenfield IA |

---

## 9. Phased delivery ↔ modules

| Phase | Modules to flesh out | Backend proof |
|-------|----------------------|---------------|
| **G0** | `kernel`, `engagement`, `operators` (floor v0), `hitl`, `artifacts`, `home` | submit task, SSE, HITL, result |
| **G1** | `matters`, `practices`, `briefs` | list tasks, packs CRUD, playbooks.run |
| **G2** | `stage`, `operators` portrait kit v1 | files/diff + presence polish |
| **G3** | Ideas on `home`, org Foreman styling within kit | playbook/pack suggestions; no soul/VM |

---

## 10. Acceptance checks (architecture)

1. **Modular:** A domain change does not require editing another module’s private files.  
2. **Backend-true:** Primary actions map 1:1 to existing `/v1` routes; no shadow orchestrator.  
3. **Brand-true:** Vocabulary and IA match firm guides; Practices ≠ marketplace.  
4. **Identity-true:** Floor shows Operator portraits; Foreman is anchor, not a renameable pet.  
5. **Muse-experience / L5-substance:** Continuous thread + presence + cards + artifacts, with visible crew.  
6. **I8:** Removing `apps/web` does not break API consumers.

---

## 11. Scaffold checklist (repo)

- [x] This document  
- [x] `apps/web/src/modules/*` barrels + domain READMEs  
- [x] Links from brand greenfield + brand README + crew roadmap  
- [x] G0/G1 page assemblers + FirmShell (legacy frontend dropped)  
- [ ] Stage / portrait kit v1 (G2)  
- [ ] ESLint boundary rule (`modules/*` public barrel only) — follow-up  

---

## Summary

Fully modular frontend packages map onto the **existing** Gantry backend properties: one factory, playbooks, packs, HITL, SSE, structured artifacts. Brand strategy, design guidelines, and Operator identity sit in `operators` + shell/`home`; Muse-like engagement lives in `engagement` without adopting Muse’s companion/VM product model.
