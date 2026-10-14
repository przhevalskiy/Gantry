# Greenfield frontend — Muse-like experience × L5 firm backend

**Status:** Consolidated direction after Muse research.  
**Research:** [`research-muse.md`](./research-muse.md)  
**Brand:** [`positioning.md`](./positioning.md) · [`persona-the-firm.md`](./persona-the-firm.md) · [`frontend-agent-representation.md`](./frontend-agent-representation.md)  
**Technical architecture:** [`../platform/frontend-architecture.md`](../platform/frontend-architecture.md) · code scaffold `apps/web/src/modules/*`  
**Backend lock:** Gantry API + Temporal Foreman (`swarm-factory`) + playbooks/packs — C1/I7/P1.

---

## Thesis

**Build a Muse-grade engagement experience on top of Gantry’s L5 factory — not a personal companion app, and not a dry ops dashboard.**

| Layer | Choice |
|-------|--------|
| **Feel** | Muse — continuous conversation, presence, goals, artifacts, transparent background work, crisp HITL |
| **Is** | L5 silicon firm — Foreman + Operator roster, playbooks, packs, structured change artifacts |
| **Talks to** | Existing backend (`/v1/tasks`, `/v1/playbooks`, `/v1/packs`, HITL, SSE) — thin client, no per-user Muse VM |

One line:

> Chat with the firm. Watch the floor work. Take the artifact home.

---

## What we take from Muse (experience)

From Meta’s shipped Muse ([design](https://introducing.muse.ai/), [safety/architecture](https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse)):

| Muse pattern | Gantry greenfield mapping |
|--------------|---------------------------|
| Main chat as relationship surface | **Engagement thread** — interruptible steering of a job (not turn-locked Q&A) |
| Avatar + “what I’m doing” snippet | **Foreman presence** + active Operator snippet; tap → activity log |
| Goals tab | **Matters / Jobs** — durable factory runs with plan & status |
| Activity log + permissions transparency | Matter log + HITL/permissions sheet |
| Structured approval cards (Sentinel UX) | HITL cards wired to Gantry REST HITL (not prose “please approve”) |
| Artifacts outside pure text | Artifact panel: PR / branch / patch / report (+ report body) |
| Proactive messages when meaningful | Job lifecycle pings (plan ready, heal exhausted, artifact ready) — not life coaching |
| Side chats for separated context | **New job** (or follow-up amend) — don’t fork fake ACP agents |
| Rich atmosphere / craft | Soft firm shell + Operator portraits + intentional motion |

## What we refuse from Muse (product model)

| Muse | Why not for Gantry |
|------|---------------------|
| One named personal Muse (“Veda”) as the product | Violates firm brand; hides L5 crew |
| Per-user cloud PC as the product identity | Gantry’s SoR is org API + Temporal + Agentex, not hatchlings |
| Companion / “make your life better” category | Category is engineering factory / playbook runner |
| Subagents invisible under one pet face | L5 should **show** Operators on the engagement floor |
| SOUL.md / personal soul framing | Org playbooks + Operator kit |

---

## Backend alignment (do not reinvent)

Greenfield UI is a **theater** over:

| Backend | UI binding |
|---------|------------|
| `POST /v1/tasks` / `playbooks.run` | File / steer a job from chat + composer |
| Playbook `stages[]` + tier (L2–L5) | Staffed Operator floor preview & live roster |
| Firm packs `/v1/packs` | Practices retain / enable |
| Temporal children | Operator presence states (active / hold / done) |
| HITL checkpoints | Muse-like approval cards |
| SSE / messages / webhooks | Engagement thread + proactive job updates |
| Structured `result` | Artifact climax |

Default experiential tier: **L5 / Full Crew** in the UI story (even when user picks a lighter tier — roster simply ghosts unstaffed seats).

---

## Information architecture (Muse / iMessage — not tabs)

**Lock:** The product is a **messaging app**. There is **no product tab bar** (no Home / Matters / Practices / Briefs nav).

| Surface | Role |
|---------|------|
| **Thread list** | Main firm chat + matter **side chats** (iMessage conversation list) |
| **Chat canvas** | Message bubbles + Foreman presence header + composer |
| **Goals sheet** | Matters list — Muse Goals analogue, opened from chat chrome |
| **Floor sheet** | Operator roster + artifact dock — presence detail, not a page |
| **Menu sheet** | Practices / briefs / workspaces / sign-out — settings, not destinations |

| Route | Purpose |
|-------|---------|
| `/` | Firm main chat (empty state + composer to file) |
| `/c/:jobId` | Matter side-chat (engagement stream) |

Secondary firm data never becomes top-level tabs.

---

## Primary composition (messaging)

Muse’s lesson: **feel like iMessage** — bubbles, presence under avatar, goals as a sheet, not an AI dashboard.  
Gantry’s lesson: L5 Operators appear via **Floor sheet / presence**, not a console rail.

```
┌─────────────────┬──────────────────────────────────────┐
│ Threads         │  ◆ Foreman    snippet: “Inspector…”  │
│ · Gantry (main) │  Goals · Floor                       │
│ · Matter A      ├──────────────────────────────────────┤
│ · Matter B      │  [bubble] you                        │
│                 │  [bubble] Foreman / Operators        │
│                 │  [HITL card]                         │
│                 │  [artifact card]                     │
│                 ├──────────────────────────────────────┤
│                 │  Message the firm…           [Send]  │
└─────────────────┴──────────────────────────────────────┘
         sheets ↑ Goals / Floor / Menu (not tabs)
```

### Interaction model

1. User speaks to the **firm** (Foreman front desk).  
2. Floor lights Operators as the stage graph runs (L5 visible).  
3. User can send while work continues (Muse non-turn-taking).  
4. Irreversible moments → **cards** (plan approve, deploy approve, heal continue).  
5. Climax → **artifact**, not “thanks for chatting.”

### Identity

- **Foreman** = conversational anchor (firm voice) — closest to Muse’s single avatar *slot*, but branded as managing partner, not a pet you rename.  
- **Operators** = full portrait roster ([`frontend-agent-representation.md`](./frontend-agent-representation.md)) — the L5 tell.  
- Optional: org customizes Foreman display name/style **within firm kit** — never a separate bot company.

---

## Visual / motion direction

| Element | Direction |
|---------|-----------|
| Atmosphere | Muse-level craft: soft light, calm depth, lavender firm wash |
| Type | Albert Sans + restrained display for Gantry / practice names |
| Presence | Snippet under Foreman (“Inspector · heal 1/2”); field on active Operator |
| Motion | Presence on, HITL hold, artifact land — intentional, few |
| Density | Home first paint: brand + composer + floor ghost + one CTA — Muse clarity, firm words |

---

## Component kit (greenfield)

Owned by modular packages (`apps/web/src/modules/*`) — see [`frontend-architecture.md`](../platform/frontend-architecture.md).

| Component | Module |
|-----------|--------|
| **FirmChat** / Engagement thread | `engagement` |
| **ForemanPresence** → ActivitySheet | `operators` |
| **EngagementFloor** | `operators` |
| **HitlCard** | `hitl` |
| **ArtifactCard / ArtifactDock** | `artifacts` |
| **MatterList** | `matters` |
| **PracticeCard / BriefCard** | `practices` / `briefs` |
| **JobComposer** | `engagement` |
| **Stage** | `stage` |
| Home first paint | `home` |

Atomic unit of the feed: **EngagementEvent** (may render as bubble). Not `ChatMessage` as the domain model.

---

## Explicit non-goals

- Per-user Hatch/Muse VM as Gantry’s product runtime  
- Hiding the crew behind one companion face  
- Bot marketplace / pack-as-deployable-Muse  
- Replacing Temporal/Agentex with a personal-agent harness  
- Life OS features (calendar soul, WhatsApp companion) outside engineering jobs  

---

## Phased build

| Phase | Ship |
|-------|------|
| **G0** | Muse messaging shell (threads + chat bubbles + presence + HITL/artifact) on `/v1/tasks` — **landed** |
| **G1** | Goals / Floor / Menu sheets (matters, practices, briefs, workspaces) — **landed** |
| **G2** | Stage (diff/preview), Operator portrait kit v1, presence polish |
| **G3** | Ideas (playbook/pack suggestions), org Foreman styling within kit |

**Layout lock:** Muse / **iMessage architecture** — conversation list + bubble chat + presence header + sheets. **Not** a tabbed web app. **Not** a job console.

---

## Acceptance checks

1. **Muse test:** Feels continuously alive — presence, thread, goals/matters, artifacts, cards.  
2. **L5 test:** A stranger sees a **staffed crew**, not one pet.  
3. **Firm test:** Copy and IA say retain / file / deliver — not “meet your Muse.”  
4. **Backend test:** Every primary action hits Gantry/Agentex APIs; no shadow orchestration in the browser.  
5. **Brand test:** First viewport without nav still reads Gantry the firm.

---

## Summary

Scrap the current chat-debt shell **and** the dry console-only reboot.

**Ship a Muse-like engagement theater whose protagonist is an L5 silicon firm:** talk to the Foreman, watch Operators work the floor, clear HITL cards, leave with a structured artifact — all driven by the existing Gantry backend.
