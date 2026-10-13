# Composable crew roadmap — playbooks beyond one SWE firm

**Status:** Phase A–E **implemented** (invariant-locked)  
**Problem:** Playbooks were overlays on one hardcoded engineering firm.  
**Goal:** Make playbooks describe **job packets** (seats + artifact) with a data DAG and real Temporal role packs — without chat-bot firms or ACP forks.

### Execution status (no feature drift)

| Phase | Scope | Status |
|-------|--------|--------|
| **A** | Truth, schema (`artifact`/`stages` validate), catalog copy, `artifact_type` on results | **Done** |
| **B** | Artifact policy in DevOps; include/disable seats; structured `artifact_type` | **Done** |
| **C** | Foreman DAG interpreter (`stage_graph` + plan loop; heal/HITL metadata; golden default ≡ current) | **Done** |
| **D** | Role pack contract + `oracle-a11y` Temporal child (`OracleA11yAgent`) | **Done** |
| **E** | Firm packs (`swe-factory@1`, `migration-runner@1`), org install/quota, SDK `playbooks.run`, `/packs` UI | **Done** |

Still true: no per-playbook ACP agents, no Grok-style bot marketplace — packs install into one factory.

Related: [`stack-debloat.md`](./stack-debloat.md) · [`agentex-citizen.md`](./agentex-citizen.md) · [`event-model.md`](./event-model.md) · [`../verticals/README.md`](../verticals/README.md) · [`../brand/README.md`](../brand/README.md) (firm positioning) · `PLATFORM_REFACTOR.md` · `schemas/crew.py` · `schemas/playbooks.py`

---

## 0. Non-negotiable invariants

Every phase must preserve these. A phase that requires violating one is rejected, not “deferred.”

### Platform (from `PLATFORM_REFACTOR.md`)

| ID | Invariant |
|----|-----------|
| **I1** | API works without the UI |
| **I2** | Every tenant resource is org-scoped |
| **I3** | Structured results, not message scraping |
| **I4** | Secrets shown once |
| **I5** | Idempotent migrations |
| **I6** | Local dev works without Postgres |
| **I7** | Workflow engine stays Temporal + Agentex — Foreman composes children; do not replace with N ACP servers |
| **I8** | UI is an optional client of `/v1/*` |

### Agentex citizen

| ID | Invariant |
|----|-----------|
| **C1** | One ACP task entry: `swarm-factory` |
| **C2** | Each crew role has a stable Temporal identity (`workflow.defn` name) |
| **C3** | HITL via REST + audit |
| **C4** | Helm `agentName` matches `swarm-factory` |

### Merge / verticals

| ID | Invariant |
|----|-----------|
| **M4** | Verticals are playbooks (config), not orchestrator forks |
| **M5** | Engine before surface — tests before marketing copy |
| **H-DUR / H-ACP** | Durability and catalog remain the horizontal spine |

### Product invariants (this roadmap)

| ID | Invariant |
|----|-----------|
| **P1** | Primary interface stays `POST /v1/tasks` → structured `result` |
| **P2** | Playbooks never become consumer chat bots or per-playbook ACP agents |
| **P3** | New specialist types must be **data + registered Temporal workers**, not prompt-only lies |
| **P4** | Default artifact may be branch/patch/report; PR is a DevOps capability, not the product identity |

---

## 1. Current architecture (honest)

```
POST /v1/tasks  + optional playbook slug
        │
        ▼
   playbook config overlay
   (tier, tracks, heal, prompt overlays, qa_commands)
        │
        ▼
   ALWAYS the same Foreman DAG:
   PM → Architect → Builders∥ → Inspector ↺ → Reviewer → Security → DevOps
        │
        ▼
   result.pr_url / branch  (push-primary lifecycle)
```

| Layer | What exists | Limitation |
|-------|-------------|------------|
| **Crew** | `schemas/crew.py` `CREW_AGENTS` — 8 fixed Temporal roles | Cannot add a specialist without new Python workflow + worker registration |
| **Pipeline** | `workflows/swarm/pipeline.py` hardcodes stage order | `disable_agents` only mutes seats; DAG is fixed |
| **Playbooks** | Org CRUD + `SYSTEM_PLAYBOOKS` seeds | Overlays only — same firm, different job packet text/knobs |
| **YAML tree** | `playbooks/*/playbook.yaml` | Thin metadata; real logic in Python dicts |
| **Catalog** | `GET /v1/agents` | Advertises the one SWE firm, not composable packs |

**Metaphor debt:** “Silicon companies you deploy together” describes a **future** control plane. Today customers get **one firm with job presets**.

---

## 2. Target architecture

```
Role registry (data)          Playbook (org-scoped)
─────────────────────         ─────────────────────
role_id, workflow,            slug, label
tools allowlist,              stages: [ {role, parallel?,
model tier hints,                        when, hitl?,
prompt profile,                          oracle? } ]
oracle hooks                  artifact: branch|patch|pr|report
        │                              │
        └──────────┬───────────────────┘
                   ▼
         Foreman (generic DAG runner)
         — still ACP name swarm-factory (C1)
         — still Temporal children (I7)
                   ▼
         structured result (I3) + push lifecycle
```

### Concepts

| Concept | Meaning | Not |
|---------|---------|-----|
| **Role** | Registered Temporal specialist with tools + prompts | A chat bot / separate ACP agent |
| **Playbook** | Org-authored DAG + defaults + artifact policy | A forked orchestrator |
| **Firm pack** | Versioned set of roles + default playbook (e.g. `swe-factory@1`, `a11y-migrator@1`) | Independently hosted Grok-style bots |
| **Job** | One `POST /v1/tasks` binding playbook → repo/project | A conversation thread |

### What “compose together” means (invariant-safe)

- Compose **inside one Foreman run** as Temporal children / parallel waves  
- Do **not** compose by deploying N ACP agents that `task/create` each other (violates C1/I7)  
- Catalog may *look* like a firm directory; runtime remains one citizen

---

## 3. Gap analysis

### G1 — Playbook expressiveness (shallow today)

| Gap | Today | Need |
|-----|-------|------|
| Stage graph | Implicit in `pipeline.py` | Explicit `stages[]` in playbook config |
| Role selection | Fixed + `disable_agents` | `include_roles` / stage role refs validated against registry |
| Artifact policy | DevOps always aims at PR | `artifact: { type: branch\|patch\|pr\|report }` |
| Oracles | Prompt overlay + optional `qa_commands` | Named oracle hooks with allowlisted activities |
| Versioning | None | `playbook.version` + immutable published revisions |

### G2 — Crew scalability (one firm type)

| Gap | Today | Need |
|-----|-------|------|
| New specialist | New `workflows/agents/*.py` + manifest + worker | Role registry + **plugin registration contract** (still Python Temporal; no fake roles) |
| Role reuse | Copy-paste prompts/tools | Shared role profiles referenced by many playbooks |
| Cross-domain firms | Impossible without fork | New role packs (e.g. `Migrator`, `OracleA11y`) as **additional** Temporal workflows, composed by data DAG |

### G3 — Foreman genericity

| Gap | Today | Need |
|-----|-------|------|
| Hardcoded stage functions | ~1.2k LOC linear pipeline | Interpreter: resolve stage → `execute_child_workflow(role.workflow, …)` |
| Heal loop | Inspector/Reviewer specific | Stage flag `heal_from: inspector\|reviewer` driven by playbook |
| HITL | Named checkpoints in code | Playbook declares which stages pause + checkpoint id (still C3 REST) |

### G4 — Control plane / product

| Gap | Today | Need |
|-----|-------|------|
| Catalog | Agents = SWE crew | `GET /v1/playbooks` + firm packs; agents list stays Temporal identities (C2) |
| Validation | Light pipeline bounds | Reject unknown roles, cycles, missing oracles (422) |
| Results | PR-centric fields | `result.artifact_type`, `result.branch`, `result.patch_url`, `result.report` (I3) |
| Positioning | Docs still PR-factory heavy | Playbook runner + optional DevOps PR stage |

### G5 — Explicit non-gaps (do not “fix”)

| Temptation | Why rejected |
|------------|--------------|
| Per-playbook ACP agent | Breaks C1 / I7 |
| Prompt-only “new firms” with no Temporal identity | Breaks P3 — catalog lies |
| Chat-native product shell | Breaks P1 / I8 product priority |
| Vertical-specific orchestrator forks | Breaks M4 |

---

## 4. Phased roadmap

### Phase A — Truth & schema (execute first)

**Outcome:** Docs + schemas tell the truth; no runtime rewrite yet.

| Work | Invariants |
|------|------------|
| A1. Document “one firm + job packets” vs target “composable packs” (this file) | M5 |
| A2. Extend playbook JSON schema: optional `stages`, `artifact`, `roles` (ignored by runtime until B) | I1, M4 |
| A3. `result` schema additives: `artifact_type` (default `pr` for back-compat) | I3 |
| A4. Catalog copy: playbooks = job packets; agents = Temporal crew identities | C1–C2 |
| A5. Tests: unknown stage/role in **published** playbooks → 422 when feature flag on | I2 |

**Exit:** Schema + docs + validation tests; old playbooks still run unchanged.

### Phase B — Data-driven mute & artifact (low risk)

**Outcome:** Playbooks control *which seats of the existing firm* run and *what finish means* — still one firm type.

| Work | Invariants |
|------|------------|
| B1. Playbook `pipeline.disable_agents` / `include_agents` merged at submit (source of truth in config, not only request body) | M4, I1 |
| B2. Artifact policy: `branch` (skip PR create), `patch` (bundle diff), `pr` (current), `report` (no git push) | P4, I3 |
| B3. DevOps stage respects artifact policy | I7 (same child, different tools path) |
| B4. Structured result always includes `artifact_type` | I3 |
| B5. Seed playbooks updated: e.g. a11y default `artifact: branch` | M4 |

**Exit:** Org can define “migration job → branch only” without code change; crew roles still fixed.

### Phase C — Foreman DAG interpreter (engine)

**Outcome:** Stage order comes from playbook data for the **existing** role set.

| Work | Invariants |
|------|------------|
| C1. Extract stage runners behind a registry map `role → child workflow` | I7, C2 |
| C2. Playbook `stages[]` drives order; default stages = today’s pipeline (compat) | M4 |
| C3. Heal loop as stage metadata, not only hardcoded Inspector block | H-HEAL |
| C4. HITL checkpoints declared on stages; ids must be in `HITL_CHECKPOINTS` | C3 |
| C5. Property tests: default playbook ≡ current pipeline behavior | M5 |
| C6. **No new ACP names** | C1 |

**Exit:** Reordering/skipping existing roles is data-only; golden-path tests green.

### Phase D — Role packs (real specialization)

**Outcome:** New specialist types become possible **without** forking Foreman — but each type is still a registered Temporal workflow.

| Work | Invariants |
|------|------------|
| D1. Role pack package contract: `roles.yaml` + workflow module + tool allowlist | P3, C2 |
| D2. Worker auto-registers pack workflows; manifest lists them | C2, C4 |
| D3. First pack beyond classic SWE: e.g. `oracle-a11y` or `migrator-batch` (one vertical) | M5 before marketing |
| D4. Playbooks may reference pack roles in `stages[]` | M4 |
| D5. `GET /v1/agents` lists pack roles as `entrypoint: temporal_child` | C1 — still one ACP entry |

**Exit:** At least one non-overlay specialist exists as Temporal child; playbook can schedule it.

### Phase E — Firm packs & distribution

**Outcome:** Product packaging matches the metaphor without becoming Grok Bots.

| Work | Invariants |
|------|------------|
| E1. Versioned firm packs (`swe-factory@1`, `migration-runner@1`) = role set + default playbooks | I2 org install |
| E2. Org enable/disable packs; quotas per pack | I2 |
| E3. SDK: `playbooks.run({ pack, playbook, goal, project_id })` | I1 |
| E4. Optional UI: pack catalog + run console (not chat product) | I8, P1 |
| E5. Docs: “compose crews inside one factory,” not “deploy bots” | P2 |

**Exit:** Buyer installs a pack, runs playbooks, gets structured artifacts; still one `swarm-factory` ACP citizen.

---

## 5. What to execute upon now (ordered)

Phases **A–E landed**. Roadmap complete under current invariants.

### Landed (A–E)

1. Schema v2 + artifact policy + seat mute  
2. Foreman stage graph interpreter + heal/HITL metadata  
3. Role packs: `oracle_a11y` Temporal child  
4. Firm packs: `schemas/firm_packs.py`, `GET/POST/PATCH /v1/packs`, migration `011_firm_packs.sql`  
5. SDK: `client.playbooks.run({ pack, playbook, goal, project_id })` + `client.packs.*`  
6. UI: `/packs` catalog + run console (not chat)  

### Explicitly never

| Item | Why |
|------|-----|
| Per-playbook ACP agents | C1 / I7 |
| Chat-bot marketplace / Grok-style deploy | P1 / P2 |

---

## 6. Risk register

| Risk | Mitigation |
|------|------------|
| DAG interpreter regressions | Golden default playbook ≡ frozen pipeline snapshot tests |
| “Fake firms” via prompts only | P3: role must have `workflow` registered or 422 |
| Scope creep into chat product | P1/P2; UI stays run console |
| Agentex tax explosion | New roles stay on same worker/queue; no new data stores |
| M4 violation (vertical forks) | Reject PRs that add `@workflow.defn` under `playbooks/` |

---

## 7. Success metrics

| Phase | Metric |
|-------|--------|
| B | ≥1 production playbook ships `artifact: branch` or `patch` |
| C | Zero Python edits to reorder existing SWE stages for a new job packet |
| D | ≥1 Temporal role not in the original 7 specialists, used by a playbook |
| E | Org installs a firm pack via API without redeploying Gantry code for *config* (code still required for new role implementations) |

---

## 8. One-sentence north star

**Gantry is a durable factory that runs org-defined playbooks: data-composed Temporal crews producing structured change artifacts — one ACP citizen, many job packets, no chat-bot marketplace.**

Brand framing (professional-services firm, not chat pets): [`../brand/README.md`](../brand/README.md).
