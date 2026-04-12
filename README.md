# Oumuamua

**Multi-dimensional agent ecosystem that researches, reasons, and acts.**

Role-differentiated agents, dynamically spawned, working in parallel to complete any task — not just reporting on things, but doing them. Built entirely on the [Scale Agentex](https://github.com/scaleapi/scale-agentex) stack with Temporal as the durable execution backbone.

---

## What it does

Oumuamua takes a natural language task and routes it through a pipeline of specialized agents:

**Research mode** — answers questions by reading the web in parallel
```
Strategist → Scout → N Analysts → Critic → Verifiers → Synthesizer
```

**Execution mode** — takes actions on websites and APIs
```
Strategist → Scout → Analyst → TaskPlanner → Executor → Verifier
```

The same infrastructure handles both. The Strategist determines which mode (or both) based on the query.

---

## Architecture

### Agent roles

| Agent | Responsibility | Tools |
|---|---|---|
| **Strategist** | Classifies task, plans queries, sets agent count (2–8) | LLM only |
| **Scout** | Finds URLs via parallel web searches | `search_web` |
| **Analyst** | Deep-reads assigned URLs, extracts structured claims | `navigate`, `report_claim`, `request_spawn` |
| **Critic** | Reviews all claims, flags contradictions, spawns verifiers | LLM only |
| **Verifier** | Verifies contested claims against live sources | `search_web`, `navigate`, `report_verdict` |
| **Synthesizer** | Assembles final answer from verified/annotated claims | LLM only |
| **TaskPlanner** | Produces a `TaskPlan` (one LLM call, deterministic execution) | LLM only |
| **Executor** | Carries out the plan step by step — no LLM in the loop | `fill_input`, `submit_form`, `http_request`, `navigate`, `click_element` |

### Why this is different from a single-agent loop

Most browser agents (Manus, etc.) use one generalist agent doing everything sequentially. Oumuamua uses **role differentiation and parallelism**:

- Scout runs 6–8 searches simultaneously
- N Analysts read different URLs in parallel
- Critic catches contradictions across all claims
- Verifiers only spawn for contested claims (capped at 3)
- Executor is deterministic — no LLM per step, just dispatch

### Cheap execution

Actions use text-based DOM interaction (`get_page_structure`, `fill_input`, `click_element`) and direct HTTP calls (`http_request` via httpx). No vision, no screenshots during execution. Cost per task: ~$0.02–0.05 vs $0.50–2.00 for screenshot-based computer use.

### Durable by default

Every agent is a Temporal workflow. Every action is a Temporal activity. Crashes replay from the last checkpoint. Activity retries are built-in. Nothing is lost.

---

## Stack

**Backend**
- [Scale Agentex SDK](https://github.com/scaleapi/scale-agentex) — agent lifecycle, task management, message persistence
- [Temporal](https://temporal.io) — durable workflow orchestration
- [Anthropic Claude](https://anthropic.com) (`claude-sonnet-4-6`) — all LLM reasoning
- [Playwright](https://playwright.dev) — text-based browser automation
- [Tavily](https://tavily.com) — web search API (`search_depth="advanced"`)
- [httpx](https://www.python-httpx.org) — direct API calls
- Python 3.12 / [uv](https://github.com/astral-sh/uv)

**Frontend**
- [Next.js 16](https://nextjs.org) / React 19
- [TanStack Query](https://tanstack.com/query)
- [Framer Motion](https://www.framer.com/motion/)
- [Zustand](https://zustand-demo.pmnd.rs)
- Tailwind CSS v4

---

## Project structure

```
oumuamua/
├── activities/                  # Temporal activities
│   ├── strategist_activity.py   # dynamic research + mode planning
│   ├── scout_planner_activity.py
│   ├── analyst_planner_activity.py
│   ├── critic_activity.py       # contradiction detection
│   ├── verifier_planner_activity.py
│   ├── synthesize_activity.py   # claim-based synthesis
│   ├── browser.py               # Playwright navigate/click
│   ├── browser_actions.py       # fill_input, submit_form, get_page_structure
│   ├── http_request_activity.py # direct API calls via httpx
│   ├── task_planner_activity.py # LLM → TaskPlan
│   ├── extract.py               # page content extraction
│   └── search.py                # Tavily search
│
├── workflows/                   # Temporal workflows
│   ├── research_orchestrator.py # "web-scout" entry point
│   ├── execution_orchestrator.py # "task-executor" entry point
│   ├── scout_agent.py
│   ├── analyst_agent.py
│   ├── verifier_agent.py
│   └── executor_agent.py
│
├── project/                     # shared config and schemas
│   ├── config.py                # env vars, model, caps
│   ├── claim_schema.py          # Claim, ResearchPlan
│   ├── task_schema.py           # TaskStep, TaskPlan, ExecutionSummary
│   ├── synthesizer.py
│   ├── run_worker.py            # Temporal worker entrypoint
│   └── acp.py                   # Agentex ACP server
│
├── ui/                          # Next.js frontend
│   ├── app/
│   ├── components/
│   └── hooks/
│
├── manifest.yaml                # Agentex agent manifest
├── dev.sh                       # dev launcher
├── setup.sh
└── pyproject.toml
```

---

## Getting started

### Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv)
- Node.js 20+
- [Temporal CLI](https://docs.temporal.io/cli) (`brew install temporal`)
- Scale Agentex platform running locally (`cd scale-agentex/agentex && docker compose up -d`)
- Playwright browsers (`playwright install chromium`)

### Setup

```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY and TAVILY_API_KEY

./setup.sh
```

### Run

```bash
./dev.sh
```

This starts:
- Temporal dev server (`:7233`)
- Agentex ACP agent (`:8000`)
- Next.js UI (`:3000`)

Open [http://localhost:3000](http://localhost:3000).

### Run with mocks (no Playwright, no Tavily)

```bash
./dev.sh --mock
```

---

## Two workflow entry points

| Workflow name | Class | Use for |
|---|---|---|
| `web-scout` | `ResearchOrchestrator` | questions, research, analysis |
| `task-executor` | `ExecutionOrchestrator` | form submissions, API calls, web actions |

Both run on the same worker and task queue (`web_scout_queue`).

---

## Roadmap

See [PLAN.md](./PLAN.md) for the full implementation plan.

Next:
- Public API (`POST /v1/run`, SSE stream, API key auth)
- Agent tree UI — live visualization of the spawning hierarchy
- Integration registry — pre-built auth configs for Notion, Slack, Linear, GitHub
- Bug: `adk.messages.create` not persisting from child workflows (sub-agent messages don't surface to UI)
