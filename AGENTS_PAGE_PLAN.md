# Agents Page — Implementation Plan

Three-phase build for the `/agents` route wired to the sidebar button.
Each phase is independently shippable. Phase 1 has no backend dependencies.

---

## Status Key
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

## Phase 1 — Agent Directory

**What:** A static page introducing each agent role in the ecosystem.
**Goal:** Make the architecture visible and human-readable. Useful for demos.
**Backend dependency:** None.
**Build time:** ~2–3 hours.

### What it shows
Each agent rendered as a card:
- Role name + icon
- One-line description of what it does
- Pipeline position (step number in the chain)
- Tool badges — the tools this agent has access to (search_web, navigate, fill_input, etc.)
- Mode tag — Research / Execution / Both
- A "why this role exists" line (the insight behind separating it out)

### Pipeline visualization
Above the cards: a horizontal flow diagram showing the two pipelines side by side.

```
Research:   Strategist → Scout → Analysts (×N) → Critic → Verifiers → Synthesizer
Execution:  Strategist → Scout → Analyst → TaskPlanner → Executor → Verifier
```

Each node is clickable — scrolls to the corresponding agent card.

### Agent cards data

| Agent | Mode | Tools | Why it exists |
|---|---|---|---|
| Strategist | Both | LLM only | Classifies task, plans queries, sets agent count 2–8 |
| Scout | Both | search_web | Search-only — never navigates, never gets distracted by content |
| Analyst | Both | navigate, report_claim, request_spawn | Deep reading — assigned URLs only, no searching |
| Critic | Research | LLM only | Reviews all claims for contradictions before synthesis |
| Verifier | Research | search_web, navigate, report_verdict | Targeted verification of contested claims only |
| Synthesizer | Research | LLM only | Assembles final answer from annotated, verified claims |
| TaskPlanner | Execution | LLM only | One LLM call produces the full plan — no LLM in execution loop |
| Executor | Execution | fill_input, submit_form, http_request, navigate, click_element | Deterministic dispatch — no reasoning, just action |

### Files
- `[ ]` `ui/app/agents/page.tsx` — route
- `[ ]` `ui/components/agents/agent-directory.tsx` — page shell + pipeline diagram
- `[ ]` `ui/components/agents/agent-card.tsx` — individual agent card
- `[ ]` Wire sidebar Agents button → `router.push('/agents')`

---

## Phase 2 — Live Agent Monitor

**What:** Real-time view of all agents active across running tasks.
**Goal:** Make the ecosystem observable — not a black box.
**Backend dependency:** Requires Bug 1.1 fix (`adk.messages.create` in child workflows).
**Build time:** ~3–4 hours after Bug 1.1 is resolved.

### What it shows
- Active task list — each running task as a collapsible section
- Per task: agent tree showing spawned agents in hierarchy order
  - Strategist (root)
    - Scout
    - Analyst 1, Analyst 2 ... Analyst N
    - Critic
    - Verifier 1 ... Verifier N
  - OR: Scout → Analyst → TaskPlanner → Executor → Verifier
- Per agent node:
  - Role badge (color-coded by role)
  - Status pill: `running` / `done` / `failed`
  - Current action — last message emitted by that agent (e.g. "Reading https://...")
  - Duration — time since agent started

### Data source
Messages tagged `[Scout]`, `[Agent N]`, `[Executor N]`, `[Verifier N]` from `useTaskMessages()`.
Parse tags on the frontend to reconstruct the tree — no new backend endpoint needed.

### Polling
`useTaskMessages()` already polls. Refresh interval: 2s while any task is `RUNNING`.
Stop polling when all tasks reach terminal status.

### Empty state
"No agents currently running. Start a task to see the ecosystem in action."
Links to home.

### Files
- `[ ]` `ui/components/agents/live-monitor.tsx` — main monitor component
- `[ ]` `ui/components/agents/agent-tree-node.tsx` — single node in hierarchy
- `[ ]` `ui/lib/parse-agent-messages.ts` — parse `[Role N]` tags → tree structure
- `[ ]` Update `ui/app/agents/page.tsx` — tab switcher: Directory | Live
- `[ ]` **Prerequisite:** Fix Bug 1.1 in `adk.messages.create`

---

## Phase 3 — Agent Configuration Panel

**What:** UI for tuning the agent ecosystem without touching code or `.env`.
**Goal:** Power-user control over agent behavior per task type.
**Backend dependency:** None for UI shell. Settings persist to localStorage; `.env` override remains authoritative.
**Build time:** ~2–3 hours.

### Settings exposed

**Research pipeline**
- Max analysts per task: slider 2–8 (maps to `agent_count` cap in strategist)
- Max verifiers per task: slider 1–5 (maps to `MAX_VERIFIERS`)
- Analyst depth: toggle `shallow` (3 pages) / `deep` (8 pages)

**Execution pipeline**
- Require approval before irreversible steps: toggle on/off
- Max execution steps: number input (guards against runaway plans)
- HTTP timeout: slider 10s–120s

**Model selection**
- Per-role model override: dropdown (Sonnet / Haiku / custom)
  - Strategist, Critic, TaskPlanner default to Sonnet
  - Scout, Analyst, Verifier, Executor can be downgraded to Haiku for cost

**Display**
- Show agent tags in message feed: toggle (currently suppressed)
- Show raw claims before synthesis: toggle

### Storage
Settings written to `localStorage` as `keystone_agent_config`.
On task creation, config is passed as params alongside the task prompt.
Backend reads config overrides from task params where supported.

### Files
- `[ ]` `ui/components/agents/config-panel.tsx` — settings form
- `[ ]` `ui/lib/agent-config-store.ts` — Zustand store for config, persisted to localStorage
- `[ ]` Update `ui/hooks/use-create-task.ts` — attach config to task params
- `[ ]` Update `activities/strategist_activity.py` — read `agent_count` override from task params
- `[ ]` Update `ui/app/agents/page.tsx` — three tabs: Directory | Live | Settings

---

## Page structure (end state)

```
/agents
├── Tab: Directory     ← Phase 1
├── Tab: Live          ← Phase 2 (shown but "requires active task" if none running)
└── Tab: Settings      ← Phase 3
```

The page opens on Directory by default.
Live tab shows a subtle pulse indicator when agents are active.
Settings tab shows a dot indicator when any setting differs from default.

---

## Order of execution

```
1. Wire sidebar button → /agents route         (10 min, unblocks everything)
2. Phase 1 — Agent Directory                   (no blockers)
3. Phase 3 — Configuration Panel              (no blockers, high user value)
4. Fix Bug 1.1                                 (prerequisite for Phase 2)
5. Phase 2 — Live Agent Monitor               (after Bug 1.1)
```

Phase 3 before Phase 2 because it has no blockers and delivers immediate value.
