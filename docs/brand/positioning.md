# Positioning

## Category

**Async software engineering factory / playbook runner** — API-first control plane over a durable Temporal crew.

Not:

- Consumer AI chat
- IDE pair-programming copilot
- Marketplace of deployable personality bots

## Primary promise

Submit a **goal** against a linked repo → receive a **structured change artifact** (`pr` | `branch` | `patch` | `report`).

The unit of value is a **job (run)**, not a conversation thread.

## Buyer

| Primary | Secondary |
|---------|-----------|
| Platform / integrator teams wiring GitHub, webhooks, SDKs, CI | Eng leads running migration / backlog / a11y job packets |
| Orgs that want headless automation with HITL when needed | Operators using the optional web **run console** |

UI is optional. API works without it (I1 / P1).

## Product model

`product.model = one_factory`

| Concept | Buyer language | Product object |
|---------|----------------|----------------|
| Firm | The company you retain | `swarm-factory` (one ACP citizen) |
| Practice | What you’ve put on retainer | Firm pack (`swe-factory@1`, `migration-runner@1`) |
| Engagement type | Kind of job | Playbook (org-scoped job packet) |
| Staff | Specialists assigned per job | Temporal child roles |
| Deliverable | What you get back | Structured `result` artifact |

## Differentiation

| | Gantry | Cursor / Copilot / Claude Code | “Bot firm” products (Muse / Grok Bots / Dots-style) |
|--|--------|--------------------------------|-----------------------------------------------------|
| Interaction | Submit job → durable pipeline | Interactive edit session | Talk to / collect personalities |
| Output | Artifact (PR/branch/patch/report) | Local or session edits | Chat + optional side effects |
| Composition | Crews inside one Foreman | One assistant in the IDE | N separately framed agents |
| Ownership | Org playbooks + pack install | User/session prefs | Per-bot deploy / follow |

## Competitive one-liners

- vs copilots: *They pair with you. We run the engagement.*
- vs Devin-as-PR-identity: *PR is a DevOps capability, not our product identity. Artifacts can be branch-first.*
- vs bot marketplaces: *You don’t deploy bots. You retain a firm and file work orders.*

## Brand pillars

1. **Durable** — jobs survive; Temporal + structured results, not scraped chat.
2. **One firm** — single factory entry; compose inside, never N ACP task servers.
3. **Job packets** — playbooks configure seats, stages, oracles, artifacts.
4. **Practices, not pets** — firm packs are versioned role sets + defaults, not chat personalities.
5. **API-native** — console is a client; the product is the control plane.

## Success of the position

Buyers describe Gantry as “the factory we call from CI / GitHub / our backend,” not “the chat where our agents live.”
