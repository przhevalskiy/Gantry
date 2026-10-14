# Brand & architecture research — Meta Muse

**Subject:** [Muse](https://muse.ai) (Meta Superintelligence Labs, launched ~Sep 2026) — personal AI agent.  
**Sources:** [How We Designed Muse](https://introducing.muse.ai/), [How We Built Safety Into Muse](https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse), third-party sandbox teardown (Hatch / Cloud Hypervisor).  
**Purpose:** Inform a Gantry greenfield frontend that aims for a **Muse-like experience** while staying aligned to Gantry’s **L5 factory backend** (not copying Muse’s personal-companion product model).

> Naming note: Unrelated products also called “Muse” (video hosting, songwriting demos, etc.) are out of scope. This doc means **Meta’s personal agent**.

---

## 1. Brand / product positioning

| Dimension | Muse |
|-----------|------|
| **Category** | Personal agent / “personal superintelligence” |
| **Promise** | Makes the user’s life better — does real work, not just answers |
| **Unit of value** | Goals & tasks completed in the background + conversation |
| **Relationship** | One long-running companion you name and style (avatar + personality) |
| **Tone** | Intimate, helpful, proactive; designed around scarce personal time |
| **Clients** | iOS, Android, web (`muse.ai`), WhatsApp; glasses planned |
| **Business expansion** | “Muse for Small Business” — connectors into SMB tools (Shopify, Slack, QuickBooks, …) |

### Design pillars (from Meta’s design essay)

1. **Agent that does things** — own computer, browser, files, code, purchases/bookings (with controls).  
2. **Conversation as the relationship** — one main chat (not rigid turn-taking); interruptible; side chats for separated context.  
3. **Proactivity** — unprompted messages when meaningfully useful; user-tunable.  
4. **Custom identity** — named avatar + style (“my Muse: Veda”); talking to a logo felt wrong.  
5. **Transparency** — activity snippet under avatar; full activity log; permissions; editable memory files.  
6. **Goals tab** — long-running objectives + plans, beyond a flat activity feed.  
7. **Deterministic HITL** — structured approval cards for irreversible actions (not buried in chat prose).  
8. **Artifacts** — rich outputs (docs, dashboards, pages) that live in and outside chat.  
9. **Ideas** — agent-generated suggestions so capability doesn’t paralyze onboarding.

### Brand implications for Gantry

| Steal (experience) | Don’t steal (product identity) |
|--------------------|--------------------------------|
| Immersive conversational theater | Single named companion as the product |
| Presence under identity + activity log | Per-user “soul” / pet avatar franchise |
| Goals / matters as first-class | Personal life OS positioning |
| Artifacts + structured HITL cards | Consumer “make your life better” category |
| Proactive status when the job moves | Unprompted social companion chatter |

Gantry’s category remains **silicon engineering firm / L5 factory**. Muse-like means **experiential quality**, not “become a personal Muse.”

---

## 2. Full-stack architecture (as shipped)

### 2.1 High-level shape

```
Phone / Web / WhatsApp clients
        │  secure transport (direct to tenant VM)
        ▼
┌────────────────── Per-user Cloud Hypervisor microVM ──────────────────┐
│  Host-side (trusted): Sentinel, authd, hatch-safety, privsep,         │
│                       postgres, browser-broker, ingress                │
│         │ unix sockets (SO_PEERCRED)                                   │
│         ▼                                                              │
│  Runtime cell (systemd-nspawn): Hatch harness + tools + workspace     │
│         │                                                              │
│         ▼ inference / telemetry proxies (constrained egress)           │
└────────────────────────────────────────────────────────────────────────┘
```

- **Dedicated computer per user** — Linux VM with CPU/memory/storage, browser, concurrent sub-agents & crons.  
- **Client ↔ VM** — apps talk to *your* VM, not only a shared multi-tenant API façade.  
- **System of record** — data & connector credentials live on the VM (LUKS volume); limited egress for inference/telemetry.  
- **Code names** — product Muse; harness **Hatch**; env/symbols often `JARVIS_*`.

### 2.2 Security domains (defense in depth)

| Domain | Contents |
|--------|----------|
| **Runtime cell** | Agent harness, workspace FS, tool binaries the model can coerce — assumed hostile/untrusted input |
| **Host services** | Sentinel (sole permission authority), authd (credentials + surrogates), safety classifiers, privsep workers, Postgres |
| **Browser** | Separate broker / often leased browser VM; agent sees accessibility tree, not raw DOM/credentials |

**Sentinel:** Muse proposes; Sentinel allows / denies / asks user. HITL dialogs go **client ↔ Sentinel**, not “ask Muse in chat.” Approvals are scoped capabilities (once / session / task / time / perpetual).

**Credentials:** Agent never sees real tokens — surrogate tokens replaced at the network boundary.

### 2.3 Agentic harness (Hatch)

Observed loop stages (teardown):

`admission → pre_inference (skills, prompt, compaction) → model stream → tool_dispatch (+ approval_intent) → post_tool → terminalization`

| Capability | Mechanism |
|------------|-----------|
| Long context | Eager background compaction; dedicated memory-flush model |
| Multi-task | **Objective workers** (goals) + notification steps / proactive feed |
| Multi-agent | First-class **subagent** spawns + per-subagent transcripts |
| Memory | Markdown under `~/memory/` + on-VM Postgres (pgvector + keyword); hybrid retrieval |
| Tools | Many CLIs via **privsep** workers (not raw MCP-in-cell with secrets) |
| Skills | Scoped skill trees; agent can author tools/connectors |
| Spaces | Agent-built web apps served from the VM |
| Persistence | Postgres checkpoints; session survives VM replace mid-turn |

### 2.4 Client / UX architecture (product surface)

| Surface | Role |
|---------|------|
| **Main chat** | Continuous relationship; multi-send; bubbles for out-of-order / proactive turns |
| **Side chats** | Separated context when projects grow |
| **Avatar** | Identity + live “what I’m doing” snippet → activity log + permissions |
| **Goals** | Plans & long-running work; editable alongside chat |
| **Artifacts** | Rich outputs attached to / living outside chat |
| **Ideas** | Capability surfacing / onboarding |
| **HITL cards** | Deterministic approve/reject for irreversible actions |
| **Settings / Memory** | User-readable, user-editable trust surfaces |

### 2.5 Stack summary (research view)

| Layer | Muse |
|-------|------|
| Compute | Per-user Cloud Hypervisor VM + nspawn cell |
| Harness | Hatch daemon (agent loop, subagents, objectives) |
| Data | On-VM Postgres + encrypted volumes |
| Model | Frontier inference via proxy + on-box small models (ASR, embed, safety) |
| Connectors | Privsep CLIs + Sentinel-gated egress |
| Clients | Native mobile + web + WhatsApp |
| Deploy model | **Full-stack personal runtime** (agent lives in your cloud PC) |

---

## 3. Muse vs Gantry backend (alignment map)

| Concern | Muse | Gantry (today) | Greenfield takeaway |
|---------|------|----------------|---------------------|
| Autonomy class | Personal multi-agent on a VM | **L5** Foreman orchestrates Temporal children (`swarm-factory`) | Match Muse’s *felt* agency; keep L5 composition model |
| Entrypoint | Client → personal VM | `POST /v1/tasks` / ACP `task/create` → one citizen | UI is theater over factory API — not a per-user Muse VM |
| Unit of work | Goals + chat threads | **Job / engagement** + playbook + artifact | Muse Goals ≈ Gantry Matters/Jobs |
| Identity | One customizable Muse | **Operator roster** (firm staff) | Muse *presence UX*; firm *identity system* |
| Multi-agent | Subagents under one Muse | Named Temporal roles in stage graph | Expose L5 crew on the floor — don’t hide as one pet |
| HITL | Sentinel cards ↔ client | REST HITL + Temporal approval workflows | Muse-like cards; wire to Gantry HITL |
| Artifacts | Docs/dashboards/pages | `pr` / `branch` / `patch` / `report` (+ rich report) | Lead with artifact climax; chat is how you steer |
| Background work | Cron / objectives / proactive feed | Durable Temporal runs + webhooks/SSE | Proactive *job* updates, not life coaching |
| Memory | Personal memory bank | Episodes / facts / org playbooks | Org + repo memory — not SOUL.md companion |
| Trust boundary | Cell vs Sentinel/authd | Agentex + worker sandbox + org secrets | Keep Gantry/Agentex boundaries; UX can still feel “live computer” via previews |
| Packaging | Personal app (+ SMB skills) | Firm packs + playbooks | Practices/briefs, not “my Muse for Shopify” |

**Invariant lock:** C1/I7 — one ACP `swarm-factory`; no per-playbook ACP; UI must not imply N deployable personal Muses.

---

## 4. What “Muse-like + L5 agentic” means for Gantry

### Muse-like (experience)

- Conversation is the **primary engagement surface** (interruptible, multi-thread signals, presence).  
- Identity shows **live work** (snippet under portrait → full activity).  
- **Goals/Matters** board for long-running factory jobs.  
- **Artifacts** are first-class, not buried in prose.  
- **HITL** is crisp cards.  
- Motion, atmosphere, and craft rival consumer agents — prestige, not enterprise grey.

### L5 agentic (system — Gantry)

- Default mental model: **Full Crew / L5** — Foreman staffs Operators.  
- User talks to the **firm** (Foreman as front desk); sees **Operators** act.  
- Backend remains Temporal children + playbooks + packs + structured results.  
- Success = artifact shipped, not “bond with companion.”

### Synthesis line

> **Gantry Web should feel as alive as Muse — continuous engagement, presence, goals, artifacts, transparent work — while remaining an L5 silicon firm: one factory, many Operators, job packets, structured deliverables.**

---

## 5. Open questions (product)

1. Is the chat partner **Foreman only**, or can the user @-address Operators? (Recommend: Foreman primary; Operators narrate in-log.)  
2. How proactive before it feels spammy? (Recommend: job-lifecycle + HITL only for v1.)  
3. Side chats = parallel jobs vs threads on one job? (Recommend: one engagement thread per job; side = new job.)  
4. Do we ever show a “live desktop” like Muse’s computer? (Optional Stage pane: preview/diff — not a personal VM.)  

---

## 6. Source index

| Doc | URL |
|-----|-----|
| How We Designed Muse | https://introducing.muse.ai/ |
| How We Built Safety Into Muse | https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse |
| Muse product | https://muse.ai / https://muse.ai/business |
| Sandbox teardown (Hatch) | Community analysis of Cloud Hypervisor + nspawn cell (2026) |
