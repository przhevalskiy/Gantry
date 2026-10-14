# Platform

Canonical product rules for Gantry. Violating any invariant is a regression, not a deferred feature.

Thesis: [`../GANTRY_THESIS.md`](../GANTRY_THESIS.md) · Architecture: [`architecture.md`](./architecture.md)

---

## What Gantry is

A **silicon engineering firm**: you retain a practice, file a work order against a linked repo, and a durable Temporal crew (Operators under one Foreman) returns a **structured change artifact**.

| Concept | Meaning | Object |
|---------|---------|--------|
| **Firm** | The company you retain — one front desk | ACP agent `swarm-factory` (Foreman) |
| **Practice** | What you’ve put on retainer | Firm pack (`swe-factory@1`, …) |
| **Engagement type / brief** | Kind of job | Playbook (job packet) |
| **Staff / Operators** | Specialists staffed per engagement | Temporal child roles |
| **Work order** | How you file the job | `POST /v1/tasks` / `playbooks.run` |
| **Deliverable** | How the engagement closes | Structured `result` (`pr` \| `branch` \| `patch` \| `report`) |

Default SWE staffing: PM → Architect → Builders∥ → Inspector ↺ → Reviewer → Security → DevOps. Brand: [`brand/`](./brand/) · [`brand/persona-the-firm.md`](./brand/persona-the-firm.md).

---

## What Gantry is not

- IDE pair-programmer (Cursor / Copilot / Claude Code)
- Consumer chat product or personality / bot marketplace
- N separately deployable ACP “bots” per playbook or seat
- A product whose identity is “opened a PR” (PR is one DevOps capability — **P4**)
- A product that requires a web UI for core operations

---

## Invariants (I1–I8)

| ID | Rule |
|----|------|
| **I1** | API works without the UI |
| **I2** | Every tenant resource is org-scoped (key → org → projects/tasks/…) |
| **I3** | Structured results (`result.pr_url`, `branch`, …) — not message scraping |
| **I4** | Secrets / API keys shown once; only hashes stored |
| **I5** | Idempotent migrations |
| **I6** | Local dev works without Postgres (file-backed fallback) |
| **I7** | Workflow engine stays Temporal + Agentex; Foreman composes children |
| **I8** | UI (when it exists) is an optional client of `/v1/*` only |

---

## Agentex citizen (C1–C4)

| ID | Rule |
|----|------|
| **C1** | One ACP task entry: **`swarm-factory`** |
| **C2** | Each crew role has a stable Temporal identity (`workflow.defn`) |
| **C3** | HITL via REST (`/v1/tasks/{id}/hitl`, `/approve`) + audit |
| **C4** | Helm / env `agentName` matches `swarm-factory` |

Details: [`platform/agentex-citizen.md`](./platform/agentex-citizen.md)

---

## Product principles (P1–P4)

| ID | Rule |
|----|------|
| **P1** | Primary interface is `POST /v1/tasks` → structured `result` |
| **P2** | Playbooks are never consumer chat bots or per-playbook ACP agents |
| **P3** | New specialist types = data + **registered** Temporal workers (no prompt-only lies) |
| **P4** | Artifact may be `pr` \| `branch` \| `patch` \| `report`; PR is a DevOps capability, not product identity |

---

## Vertical / merge rules

| ID | Rule |
|----|------|
| **M4** | Verticals are playbook config, not orchestrator forks |
| **M5** | Engine before surface — tests before marketing copy |

---

## Complexity tiers (0–3)

| Tier | Label | Tracks | Heal | Typical HITL |
|------|-------|--------|------|--------------|
| 0 | Micro | 1 | 0 | none |
| 1 | Lightweight | 1 | 1 | PM clarify |
| 2 | Standard | 2 | 2 | + architect plan |
| 3 | Full Crew | 4 | 2 | + devops |

Mapped to Agentex autonomy L2–L5. See [`platform/oracle-tiers.md`](./platform/oracle-tiers.md).

---

## Status of major programs

| Program | Status |
|---------|--------|
| Platform phases 0–2 (keys, tasks, webhooks, SSE, quotas, audit) | Implemented |
| Agentex citizen P0–P3 | Implemented |
| Composable crew A–E (playbooks, packs, DAG, role packs) | Implemented |
| In-repo web UI | **Removed** — rebuild deferred |
| Frontend greenfield | Not started — requires docs + brand lock |

Roadmap history for A–E: [`platform/composable-crew-roadmap.md`](./platform/composable-crew-roadmap.md).

---

## Surfaces that exist today

1. **REST** `/v1/*` — primary integrator API ([`api.md`](./api.md))
2. **Internal** `/internal/*` — worker → control plane push
3. **ACP** — Agentex `task/create` → `swarm-factory`
4. **SDKs** — Python + TypeScript
5. **Integrations** — GitHub App/webhooks, Linear, Jira

`ui_state` and GitHub browser routes remain as API helpers for a future client; they are not a shipped UI.
