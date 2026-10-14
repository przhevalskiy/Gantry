# Messaging

## Master line

**Gantry is a durable engineering firm you hire through an API — one front desk, practices on retainer, job packets for each engagement, change artifacts when the work closes.**

## Short forms

| Length | Line |
|--------|------|
| 5 words | Hire the factory. Ship artifacts. |
| 10 words | One engineering firm. Playbooks for jobs. Artifacts, not chats. |
| Tweet | Gantry runs org playbooks as durable factory jobs — packs are practices, not bots you deploy. |
| README lede | Async code-agent platform with a tenant control plane: submit a goal, get a structured change. Optional UI is a run console, not the product core. |

## Proof points (always true)

1. Primary interface: `POST /v1/tasks` / `playbooks.run` → structured `result`.
2. One ACP citizen: `swarm-factory`.
3. Playbooks = configurable job packets (seats, stages, artifact).
4. Firm packs = versioned practices (`swe-factory@1`, `migration-runner@1`).
5. UI optional; API-complete.

## Audience snippets

### Integrator

> Wire GitHub and your backend to Gantry. Submit jobs with a playbook (and optional pack). Poll or webhook for a branch, patch, PR, or report. Same factory every time.

### Eng lead

> Put `migration-runner` on retainer, run `a11y-remediation` as a branch-first engagement, keep approvals on the plan when you need them. No new chatbot to manage.

### Operator (UI)

> New run → pick pack/playbook → watch the engagement log → leave approvals in-stream → open the artifact when DevOps finishes.

## Forbidden phrases

Do not use in product marketing, catalog, or primary UI:

| Forbidden | Why | Replace with |
|-----------|-----|--------------|
| Deploy your bots / bot marketplace | Violates P2; wrong architecture | Install a firm pack / put a practice on retainer |
| Chat-native engineering team | Product is jobs, not chat | Run console / factory API |
| Each playbook is its own agent | Violates C1 | Job packet on the shared factory |
| Meet your a11y companion | Personality-bot frame | Accessibility practice / oracle seat |
| Silicon companies you deploy together *(as runtime)* | Implies N ACP agents | Compose crews **inside** one factory |
| Magical autonomous employees | Overclaim; underplays oracles/HITL | Durable pipeline with quality gates |

“Silicon companies you deploy together” may appear only as a **future packaging metaphor** when immediately qualified: *packs install into one factory; they are not separately hosted bots.*

## Headline formulas

Safe patterns:

- `{Job} → {artifact}` — “Goal → pull request”
- `{Practice} for {outcome}` — “Migration practice for branch-first remediation”
- `{One firm} + {many job packets}` — “One factory. Many playbooks.”

Unsafe patterns:

- “Your new teammate…”
- “Collect agents…”
- “Chat-first software company…”

## Boilerplate (docs / catalog)

Use on `GET /v1/agents` product blurb and pack catalog:

> Gantry is one engineering factory (`swarm-factory`). Playbooks are job packets that tune seats, oracles, and artifacts. Firm packs are versioned practices you install for an org — not separately deployable chat bots. Crew identities are Temporal children composed by the Foreman.
