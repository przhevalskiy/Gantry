# Persona — The Firm

## What “the firm” means

**A professional-services engineering firm** (consultancy / practice), not:

- Office furniture or a literal coworking space
- A hallway of chat companions
- A social “meet your bots” product

You **retain** the firm. You **file engagements**. You receive **deliverables**.

## Mapping: metaphor → architecture

| Firm metaphor | Product / architecture | User-facing name |
|---------------|------------------------|------------------|
| Front desk / managing partner | Foreman ACP + Temporal orchestrator | Factory / Foreman (`swarm-factory`) |
| Practice area on retainer | Firm pack | Pack (`swe-factory@1`, `migration-runner@1`) |
| Engagement type / SOW template | Playbook config | Playbook / skill / job packet |
| Staffing the room | Stage graph → Temporal children | Team roles (PM, Architect, Builder, …) |
| Specialist consultant | Role pack Temporal workflow (e.g. Oracle A11y) | Named seat in Team / catalog |
| Partner approval | HITL checkpoints | Plan / deploy / continue approvals |
| QA gate before ship | Inspector + oracles (+ heal) | Quality / oracle |
| Closing the engagement | DevOps + artifact policy | Branch, patch, PR, or report |
| Work order | `POST /v1/tasks` or `playbooks.run` | Run / task |
| Matter file | Task id + structured `result` | Run detail |

## How composition works (persona-safe)

**Allowed story:** “The firm staffs the right people for this engagement.”

**Forbidden story:** “Deploy the a11y bot next to the devops bot and let them DM each other.”

Compose = Foreman assigns Temporal children **inside one run**.  
Do not compose = N separately hosted chat agents calling `task/create` on each other.

## Packs = practices

| Pack | Practice story | Default engagement |
|------|----------------|--------------------|
| `swe-factory@1` | Full-service software engineering practice | `platform-backlog`, `monorepo-slice` |
| `migration-runner@1` | Migration / remediation practice (branch-first, oracles) | `a11y-remediation` |

Installing a pack = putting a practice on retainer (enable + quota).  
It does **not** = spawning a new public chatbot.

## Playbooks = engagement briefs

A playbook answers:

- What kind of job is this?
- Who is staffed (stages / seats)?
- What does “done” look like (artifact)?
- What extra gates apply (oracle overlays, HITL)?

End users may author and edit playbooks (config). They may not invent new specialist types without a registered Temporal role (P3).

## Voice of the firm (persona traits)

| Trait | Means | Avoid |
|-------|-------|--------|
| Competent | Precise about runs, artifacts, quotas | Hype, “magical agents” |
| Accountable | Durable jobs, structured results, audit/HITL | Vague “the AI will handle it” |
| Composed | One firm, clear staffing | Swarm-of-pets energy |
| Direct | Job in → deliverable out | Endless companion chat |

## Elevator (persona)

> Gantry is a silicon engineering firm with one front desk. You put practices on retainer, file a work order with an engagement brief, and get a change artifact when the job closes — not a collection of chatbots to befriend.
