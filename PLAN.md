# Keystone — Build Plan

> Multi-dimensional agent ecosystem that researches, reasons, and acts.
> Role-differentiated agents, dynamically spawned, working as an ecosystem to complete any task —
> not just reporting on things but doing them. Built entirely on the Scale Agentex stack.

---

## Status Key
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked / needs investigation

---

## Core Principle

Every agent is a Temporal workflow. Every action is a Temporal activity. Nothing new is
introduced at the infrastructure level — only new workflows, activities, and tool schemas.

**Two modes, one stack:**
- **Research mode** — Scout → Analysts → Critic → Verifiers → Report
- **Execution mode** — Scout → Analysts → Planner → Executor(s) → Verifier → Result

The research pipeline IS the planning phase for execution. The same agents that understand
a topic can produce a TaskPlan that Executor agents carry out.

---

## 1. Critical Bugs

### 1.1 Sub-agent messages not persisting
- `[!]` `adk.messages.create` called in child workflows produces zero messages in the Agentex API
- Only orchestrator-level messages appear; `[Agent N]` tagged messages never reach the database
- **Root cause unknown** — activity is registered, `in_temporal_workflow()` should return true
- **Fix:** once resolved, all live agent feeds will work automatically

### 1.2 Per-agent tab UI (blocked on 1.1)
- `[x]` `browser-preview.tsx` — tab switcher with screenshot + activity feed per tab
- `[x]` `research-view.tsx` — parses `[Agent N]` messages, passes to BrowserPreview
- `[x]` `message-feed.tsx` — suppresses `[Agent N]` lines from global feed
- `[!]` Tab feed shows "Starting..." and never updates — blocked on 1.1

---

## 2. Architecture — Phase 1: Role Differentiation (Scout + Analyst) ✓

### 2.1 Strategist `[x]`
`activities/strategist_activity.py` — dynamic research planning. Determines scout queries,
agent count (2–8 based on complexity), and research angles.

### 2.2 Scout agent `[x]`
`workflows/scout_agent.py` — search only, no navigation. Runs 6–8 searches, returns ranked
URL list `{url, relevance_note, source_type}`. Target: under 90 seconds.

### 2.3 Analyst agent `[x]`
`workflows/analyst_agent.py` — deep reading, no searching. Reads assigned URLs, extracts
structured claims `{claim, url, verbatim_quote, confidence}`. Can flag URLs for deeper
investigation via `request_spawn` tool.

### 2.4 Orchestrator `[x]`
`workflows/research_orchestrator.py` — Strategist → Scout → N Analysts → Critic →
Verifiers → Synthesizer. Agent count is fully dynamic.

### 2.5 Synthesizer `[x]`
`activities/synthesize_activity.py` — synthesizes from structured claims. Understands
VERIFIED/DENIED/CRITIC-FLAGGED annotations on claims.

---

## 3. Architecture — Phase 2: Dynamic Spawning + Ecosystem ✓

### 3.1 Spawn requests `[x]`
Analysts can flag URLs for deeper investigation via `request_spawn` tool. Spawn requests
are collected alongside claims and merged with Critic requests.

### 3.2 Shared claim store `[x]`
Orchestrator accumulates all claims post-analysts. Claims are enriched with `verified`,
`verdict`, `critic_flag` fields before synthesis.

### 3.3 Critic agent `[x]`
`activities/critic_activity.py` — reviews all claims, identifies contradictions, flags
low-confidence findings, returns spawn requests for contested claims.

### 3.4 Convergence `[x]`
`MAX_VERIFIERS = 3` caps verifier spawning (Option A). Coverage/confidence-based
convergence (Options B/C) deferred.

### 3.5 Verifier agent `[x]`
`workflows/verifier_agent.py` — targeted claim verification. search_web + navigate +
report_verdict. Returns `{verdict, explanation, supporting_urls}` merged into claim store.

---

## 4. Architecture — Phase 3: Execution Layer

Move from reporting outcomes to producing them. The same agent roles extended with an
action surface. No vision, no screenshots — text-based DOM interaction and direct API
calls. Everything is a Temporal activity on the existing worker.

**The key insight:** Research mode output (claims, URLs, page structure) feeds directly
into Execution mode input (what to fill, what to call, what to submit).

### 4.1 Execution activities (cheap, no vision)
- `[x]` `activities/browser_actions.py`
  - `fill_input(selector, value)` — Playwright fills a field, returns confirmation
  - `submit_form(selector)` — clicks a submit button or form element
  - `get_page_structure()` — returns condensed DOM: inputs, buttons, links, forms as text
  - `wait_for_element(selector, timeout_ms)` — waits for dynamic content to appear
- `[ ]` `activities/http_request.py`
  - `http_request(method, url, headers, body)` — direct API call via httpx, Temporal-wrapped
  - Handles auth headers, JSON body, returns `{status, body, headers}`
  - Retry policy: 3 attempts with exponential backoff

### 4.2 TaskPlanner activity
- `[ ]` `activities/task_planner_activity.py`
  - Single LLM call: receives task description + page/API context → outputs a `TaskPlan`
  - `TaskPlan = {steps: [{tool, args, description, reversible: bool}]}`
  - Reversibility flag used to gate which steps need confirmation
  - Separate from research planner — action-oriented system prompt

### 4.3 TaskPlan schema
- `[x]` `project/task_schema.py` — TaskStep, TaskPlan, TaskResult, ExecutionSummary

### 4.4 Executor agent
- `[x]` `workflows/executor_agent.py` — deterministic plan execution, no LLM in loop
  - Dispatches fill_input, submit_form, http_request, navigate, click_element
  - Respects depends_on ordering, records per-step results
  - Emits `[Executor N]` tagged messages

### 4.5 Execution orchestrator
- `[x]` `workflows/execution_orchestrator.py` — registered as `task-executor`
  Scout → Analyst → TaskPlanner → Executor → Verifier

### 4.6 Mode selection
- `[x]` Strategist classifies `research | execute | both`
- `[ ]` UI `search-home.tsx` — mode indicator or auto-detected from query intent

---

## 5. Public API

Expose both research and execution as callable services.

### 5.1 API server
- `[ ]` `api/server.py` — FastAPI on port 8001
- `[ ]` `api/models.py` — request/response Pydantic models
- `[ ]` `api/auth.py` — `X-API-Key` middleware

### 5.2 Endpoints
- `[ ]` `POST /v1/run` — create a job (research or execution, auto-detected)
  ```json
  { "task": "...", "mode": "auto|research|execute", "webhook_url": null }
  ```
- `[ ]` `GET /v1/run/{id}` — poll status + result
- `[ ]` `GET /v1/run/{id}/stream` — SSE stream for live agent activity
- `[ ]` `DELETE /v1/run/{id}` — cancel

### 5.3 Integration
- `[ ]` `dev.sh` updated to start API on port 8001
- `[ ]` `API_KEY` added to `.env`

---

## 6. UI — Agent Ecosystem Visualization

The UI should make the agent ecosystem visible — not a black box.

### 6.1 Agent tree view
- `[ ]` `components/agent-tree.tsx` — live spawning hierarchy
  - Nodes: Strategist → Scout → Analysts → Critic → Verifiers / Executors
  - Each node: role badge, status (running/done/failed), current action text
  - Execution mode adds Executor nodes in a separate branch

### 6.2 Live claim / action feed
- `[ ]` `components/activity-feed.tsx` — unified feed for research and execution
  - Research mode: claims as they arrive, confidence color-coded, contradictions in amber
  - Execution mode: steps as they execute, success/failure per step

### 6.3 Phase progress bar
- `[ ]` Replace static "Researching..." with phase-aware progress:
  - Research: Scouting → Reading → Extracting → Critic → Synthesizing
  - Execution: Scouting → Reading → Planning → Executing → Verifying

---

## 7. Quality Improvements

- `[ ]` URL validation before `navigate` — skip malformed URLs
- `[ ]` Deduplicate URLs across Scout results
- `[ ]` Source credibility scoring — weight .edu, known publishers higher
- `[ ]` Report / result caching — same task twice shouldn't re-run
- `[ ]` `http_request` integration registry — pre-built auth configs for common APIs
  (Notion, Slack, Linear, GitHub, Airtable) so agents don't need to discover auth patterns

---

## 8. Infrastructure Hardening

- `[ ]` Fix `adk.messages.create` in child workflows (Bug 1.1)
- `[ ]` Timeout ladder: Scout 3 min, Analyst 8 min, Executor 5 min, Critic 2 min, Synthesizer 5 min
- `[ ]` Screenshot TTL cleanup — `/tmp/keystone_screenshots` grows unbounded
- `[ ]` Worker concurrency tuning as execution agents scale (currently 60)
- `[ ]` Irreversible action gate — configurable approval requirement before destructive steps

---

## Order of Execution

```
1.1   Fix adk.messages.create bug        ← unblocks all live UI feeds
4.1   Execution activities               ← fill_input, submit_form, http_request
4.2   TaskPlanner activity               ← single LLM call → TaskPlan
4.3   TaskPlan schema                    ← shared types
4.4   Executor agent                     ← carries out the plan
4.5   Execution orchestrator             ← wires Scout → Analyst → Planner → Executor → Verifier
4.6   Mode selection + router            ← auto-detects research vs execute
5.1–5.3  Public API                      ← can build in parallel with 4.x
6.1   Agent tree UI                      ← after execution pipeline works
6.2   Activity feed                      ← unified research + execution feed
7     Quality improvements               ← ongoing, ship anytime
8     Infrastructure hardening           ← ongoing
```
