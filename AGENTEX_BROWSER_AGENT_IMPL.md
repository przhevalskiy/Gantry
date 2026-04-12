# Agentex Browser Agent — Implementation Spec
**Project:** `web-scout` — A Perplexity Comet-style agentic browser agent built on Scale Agentex + Temporal + Playwright + Claude  
**Spec Version:** 1.0  
**Target Runtime:** Python 3.11+, Node.js 20+ (UI only)  
**Feed to:** Claude Code for scaffolding and implementation

---

## 0. Mental Model & North Star

This is a **prompt-in → web actions out** agent. The user types a natural language goal ("find me the cheapest flight from JFK to LAX next weekend and summarize the top 3 options"). The agent:

1. Plans a sequence of web actions using Claude as the LLM brain
2. Executes each action as a **Temporal Activity** (Playwright-backed, durable, retryable)
3. Streams progress updates back to the UI in real time
4. Returns a synthesized final answer

**Agentex is the app layer** — it owns task lifecycle, streaming, persistence, and the dev UI. It is NOT responsible for browser logic. Playwright Activities are the browser layer. Claude is the planner/synthesizer. These three layers must never bleed into each other.

---

## 1. Repository Structure

```
web-scout/
├── AGENTEX_BROWSER_AGENT_IMPL.md   ← this file
├── manifest.yaml                    ← Agentex agent manifest
├── .env                             ← secrets (never committed)
├── .env.example                     ← committed template
├── .gitignore
├── pyproject.toml                   ← uv-managed deps
├── uv.lock
├── dev.sh                           ← local dev launcher
│
├── project/
│   ├── acp.py                       ← Agentex ACP entrypoint (agent loop)
│   ├── planner.py                   ← LLM planning layer (Claude tool-use loop)
│   ├── tools.py                     ← Tool schema definitions for Claude
│   └── config.py                    ← Env/config loader
│
├── activities/
│   ├── __init__.py
│   ├── browser.py                   ← Playwright Temporal Activities
│   ├── search.py                    ← Web search API Activities (Tavily)
│   └── extract.py                   ← Content extraction/cleaning Activities
│
├── workflows/
│   ├── __init__.py
│   └── browse_workflow.py           ← Temporal Workflow definition
│
├── fixtures/
│   ├── mock_navigate.json           ← stub HTML for dev/testing
│   ├── mock_search.json             ← stub search results for dev/testing
│   └── mock_extract.json
│
└── tests/
    ├── test_planner.py
    ├── test_activities.py
    └── test_workflow.py
```

---

## 2. Dependencies

### Python (pyproject.toml)

```toml
[project]
name = "web-scout"
version = "0.1.0"
requires-python = ">=3.11"

dependencies = [
    "agentex-sdk",                   # Agentex SDK + CLI (PyPI name; not "scale-agentex-python")
    "anthropic>=0.40.0",             # Claude SDK
    "temporalio>=1.7.0",             # Temporal Python SDK
    "playwright>=1.44.0",            # Browser automation
    "tavily-python>=0.3.0",          # Web search API
    "beautifulsoup4>=4.12.0",        # HTML parsing
    "lxml>=5.0.0",                   # BS4 parser backend
    "httpx>=0.27.0",                 # Async HTTP
    "pydantic>=2.7.0",               # Data validation
    "python-dotenv>=1.0.0",          # Env loading
    "structlog>=24.0.0",             # Structured logging
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-mock>=3.14.0",
]
```

### Post-install required
```bash
playwright install chromium
```

---

## 3. Environment Variables

### `.env.example`
```env
# LLM
ANTHROPIC_API_KEY=sk-ant-...

# Web Search
TAVILY_API_KEY=tvly-...

# Agentex
AGENTEX_AGENT_NAME=web-scout

# Temporal
TEMPORAL_HOST=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=web-scout-queue

# Browser
BROWSER_HEADLESS=true
BROWSER_TIMEOUT_MS=30000

# Feature flags
USE_MOCK_BROWSER=false        # set true during dev to avoid Playwright calls
USE_MOCK_SEARCH=false         # set true during dev to avoid Tavily calls
MAX_AGENT_TURNS=10            # hard cap on LLM tool-use loop iterations
MAX_PAGES_PER_TASK=5          # hard cap on pages visited per task
```

---

## 4. Task List

Tasks are ordered. Each must be complete before moving to the next. Mark complete with `[x]`.

### Phase 1 — Scaffold & Infrastructure

- [ ] **T1.1** Initialize Agentex project via `agentex init` selecting ACP (async) agent type with Temporal template
- [ ] **T1.2** Verify `manifest.yaml` is generated with correct `name`, `acp_path: project/acp.py`, and Temporal config block
- [ ] **T1.3** Configure `pyproject.toml` with all dependencies listed in §2
- [ ] **T1.4** Run `uv venv && source .venv/bin/activate && uv sync`
- [ ] **T1.5** Install Playwright Chromium: `playwright install chromium`
- [ ] **T1.6** Create `.env` from `.env.example` and populate with real keys
- [ ] **T1.7** Create `fixtures/` directory and populate three mock JSON files (see §8)
- [ ] **T1.8** Start Agentex dev server: `agentex dev` — confirm UI loads at `http://localhost:3000`
- [ ] **T1.9** Confirm Temporal dev server is running (Agentex bundles this; verify at `http://localhost:8233` — **port unconfirmed**, check actual docker-compose port mapping after `agentex dev` starts)

**Expected state after Phase 1:** Agentex UI is running, a Hello World ACP agent responds to messages, Temporal workflow history is visible in the Temporal UI.

---

### Phase 2 — Tool Schema & Planner

- [ ] **T2.1** Implement `project/config.py` — load all env vars, fail loudly on missing required keys at import time
- [ ] **T2.2** Implement `project/tools.py` — define Claude tool schemas for these five tools:
  - `navigate` — go to a URL
  - `search_web` — query Tavily
  - `extract_page_content` — extract clean text from current page
  - `click_element` — click a CSS selector or text match
  - `finish` — signal task completion with final answer

- [ ] **T2.3** Implement `project/planner.py` — the Claude tool-use agentic loop:
  - Accepts `(task_prompt: str, context: list[dict])` 
  - Runs `client.messages.create(model=..., tools=TOOLS, messages=...)` in a loop
  - On `stop_reason == "tool_use"`: yields each `ToolUseBlock` as a `PlannerStep`
  - On `stop_reason == "end_turn"` or `finish` tool call: yields `FinalAnswer`
  - Hard-stops after `MAX_AGENT_TURNS` with a graceful error if loop is not resolved
  - Never mutates `context` in place — always returns new list (immutability invariant)

- [ ] **T2.4** Write `tests/test_planner.py`:
  - Mock Anthropic client responses
  - Assert planner yields correct step types
  - Assert loop terminates on `finish` tool call
  - Assert loop terminates on `MAX_AGENT_TURNS` without raising uncaught exception

**Expected state after Phase 2:** `python -m pytest tests/test_planner.py` passes. Planner can be called standalone with mocked LLM responses.

---

### Phase 3 — Temporal Activities

- [ ] **T3.1** Implement `activities/browser.py`:
  - `async def navigate(url: str) -> str` — launches Playwright Chromium (headless), navigates to URL, returns raw HTML. Respects `BROWSER_TIMEOUT_MS`. On `USE_MOCK_BROWSER=true`, loads `fixtures/mock_navigate.json` keyed by URL pattern.
  - `async def click_element(selector: str) -> bool` — clicks element, returns True on success, False if not found
  - Each activity decorated with `@activity.defn` from `temporalio`
  - Browser instance is **not** shared across activities — each activity creates and closes its own context (simplicity over performance at this stage)

- [ ] **T3.2** Implement `activities/search.py`:
  - `async def search_web(query: str, max_results: int = 5) -> list[dict]` — calls Tavily API, returns list of `{title, url, snippet}`. On `USE_MOCK_SEARCH=true`, loads `fixtures/mock_search.json`.
  - Decorated with `@activity.defn`

- [ ] **T3.3** Implement `activities/extract.py`:
  - `async def extract_page_content(html: str) -> str` — uses BeautifulSoup to strip nav/footer/scripts/ads, returns clean readable text, truncated to 8000 chars max
  - `async def summarize_results(results: list[str]) -> str` — joins and truncates multiple extracted texts into a single context string for the LLM, max 12000 chars total
  - Both decorated with `@activity.defn`

- [ ] **T3.4** Write `tests/test_activities.py`:
  - Test `extract_page_content` with real HTML fixtures — assert nav/script tags stripped
  - Test `search_web` with `USE_MOCK_SEARCH=true`
  - Test `navigate` with `USE_MOCK_BROWSER=true`

**Expected state after Phase 3:** All activity tests pass. Activities can be called directly (outside Temporal) in test context.

---

### Phase 4 — Temporal Workflow

- [ ] **T4.1** Implement `workflows/browse_workflow.py`:
  - Define `BrowseWorkflow` class with `@workflow.defn`
  - Main `run(task_prompt: str) -> str` method:
    1. Instantiates planner context as empty list
    2. Loops over `planner.py` steps (yielded PlannerSteps)
    3. For each tool call: dispatches the matching Temporal activity via `workflow.execute_activity()`
    4. Appends tool result to context as a `tool_result` message
    5. On `FinalAnswer`: returns synthesized answer string
  - Activity options: `start_to_close_timeout=timedelta(seconds=60)`, `retry_policy=RetryPolicy(maximum_attempts=3)`
  - Hard cap: if `MAX_PAGES_PER_TASK` is reached, short-circuit and call synthesize with what we have

- [ ] **T4.2** Register workflow and activities with the Temporal worker in `project/acp.py` worker bootstrap (see Phase 5)

- [ ] **T4.3** Write `tests/test_workflow.py`:
  - Use Temporal's `WorkflowEnvironment.start_local()` test harness
  - Mock all activities
  - Assert workflow completes and returns a string
  - Assert workflow respects `MAX_PAGES_PER_TASK` cap

**Expected state after Phase 4:** `python -m pytest tests/test_workflow.py` passes with mocked activities.

---

### Phase 5 — Agentex ACP Entrypoint

- [ ] **T5.1** Implement `project/acp.py` — the Agentex ACP agent entrypoint:

> **⚠ Verify before coding:** The imports and handler signature below are unconfirmed against the actual `agentex-sdk` API. Before writing this file, check the ACP handler contract in the Agentex Temporal docs (`agentex.sgp.scale.com/docs/temporal_development/overview/`). The class names `AgentTask`, `stream_update`, and `AgentResponse` from `agentex.sdk` were not found in public documentation — the real SDK may expose a different interface (e.g. via the `Agentex` client). Adjust imports and signatures to match actual SDK before proceeding.

```python
# NOTE: imports below are illustrative — verify against actual agentex-sdk API
from agentex.sdk import AgentTask, stream_update, AgentResponse
from temporalio.client import Client
from workflows.browse_workflow import BrowseWorkflow

async def handle_message(task: AgentTask) -> AgentResponse:
    await stream_update(task, "🔍 Planning your task...")
    
    temporal_client = await Client.connect(TEMPORAL_HOST)
    
    handle = await temporal_client.start_workflow(
        BrowseWorkflow.run,
        task.content,
        id=f"web-scout-{task.id}",
        task_queue=TEMPORAL_TASK_QUEUE,
    )
    
    # Poll for updates and stream them back
    result = await handle.result()
    
    return AgentResponse(content=result)
```

- [ ] **T5.2** Add Temporal worker startup to `acp.py` — the worker must register `BrowseWorkflow` and all activities before the Agentex handler is ready
- [ ] **T5.3** Verify end-to-end with mock flags: set `USE_MOCK_BROWSER=true` and `USE_MOCK_SEARCH=true`, send a prompt in Agentex UI, confirm a response comes back through the full stack
- [ ] **T5.4** Verify Temporal UI shows workflow run history for the task (use port confirmed in T1.9)

**Expected state after Phase 5:** Full mock end-to-end works. Prompt in → response out via Agentex UI, Temporal history visible.

---

### Phase 6 — Live Integration

- [ ] **T6.1** Set `USE_MOCK_BROWSER=false` and `USE_MOCK_SEARCH=false`
- [ ] **T6.2** Run a real task: `"Search for the latest news about Scale AI Agentex and summarize the top 3 articles"`
- [ ] **T6.3** Confirm Playwright opens Chromium headlessly (check logs), navigates to real URLs
- [ ] **T6.4** Confirm Tavily returns real search results
- [ ] **T6.5** Confirm final answer is synthesized by Claude and returned to Agentex UI
- [ ] **T6.6** Check token usage in Anthropic console — confirm per-task cost is within expected range (see §6)

**Expected state after Phase 6:** Real browser agent works end-to-end on live web.

---

### Phase 7 — Hardening

- [ ] **T7.1** Add structured logging via `structlog` to all activities and the planner — log tool name, input, output length, duration
- [ ] **T7.2** Add `MAX_PAGES_PER_TASK` enforcement in workflow — if exceeded, log warning and call extract/synthesize with accumulated context
- [ ] **T7.3** Add URL allowlist/blocklist to `navigate` activity — block `localhost`, private IP ranges, and known redirect traps
- [ ] **T7.4** Add content extraction character limit enforcement in `extract.py` — never pass more than 8000 chars of any single page to Claude context
- [ ] **T7.5** Add graceful degradation: if Tavily fails (rate limit, network), fall back to a raw `navigate` to a search engine results page and extract from that
- [ ] **T7.6** Write a cost estimation log line at end of each workflow — count total input/output tokens across all Claude calls in the session

---

## 5. Implementation Invariants

These are non-negotiable rules. Claude Code must not deviate from them. If a task conflicts with an invariant, the invariant wins and the conflict must be raised as a comment.

### I1 — Layer Separation
- `acp.py` ONLY handles Agentex lifecycle (receive task, stream updates, return response). Zero Playwright code. Zero direct LLM calls.
- `planner.py` ONLY handles the Claude tool-use loop. Zero Playwright code. Zero Temporal code.
- `activities/` ONLY handles external I/O (browser, search, extraction). Zero LLM calls. Zero Agentex SDK imports.
- `workflows/` ONLY handles Temporal orchestration — dispatching activities and threading planner steps. No business logic.

### I2 — No Shared Playwright State
Each `navigate` or `click_element` activity creates its own Playwright Browser + Context + Page and closes it on return or exception. No browser instance is shared across activity calls or across tasks.

### I3 — Immutable Message Context
The planner's `context: list[dict]` is never mutated in place. Each turn, a new list is constructed: `new_context = context + [new_message]`. This prevents accidental cross-turn contamination.

### I4 — Hard Loop Caps Enforced in Code
`MAX_AGENT_TURNS` and `MAX_PAGES_PER_TASK` are enforced as integer counters inside the planner loop and workflow respectively. They are not optional. An agent that exceeds these caps must gracefully synthesize from what it has — it must never raise an unhandled exception or hang.

### I5 — Secrets Never Logged
`structlog` configuration must include a processor that redacts values matching `*_KEY`, `*_TOKEN`, `*_SECRET` patterns before any log output. Never log the full URL if it contains query parameters with auth tokens.

### I6 — Mock Flags Are Dev-Only
`USE_MOCK_BROWSER` and `USE_MOCK_SEARCH` must read from `.env` only. They must never be hardcoded as `True` in any non-test file. Test files may set them explicitly via `monkeypatch`.

### I7 — No Raw HTML in Claude Context
Claude never receives raw HTML. All page content passed to Claude must go through `extract_page_content()` first. The planner must enforce this: if a `navigate` result is passed back as a tool result, it must be immediately piped through `extract_page_content` before being appended to context.

### I8 — Temporal Retries Don't Retry LLM Decisions
Only the I/O activities (`navigate`, `search_web`) have Temporal retry policies. The workflow-level LLM planning logic does not retry on LLM errors — if the planner raises, the workflow fails cleanly and returns an error message to the user.

---

## 6. Anti-Drift Guardrails

These guardrails prevent implementation drift during multi-session Claude Code work. Claude Code should check these at the start of each session.

### G1 — Structural Drift
Before writing any new code, verify the directory structure matches §1 exactly. If a new file is needed that doesn't fit the structure, stop and add it to this spec first.

### G2 — Dependency Drift
`pyproject.toml` is the single source of truth for deps. Never `pip install` anything directly. All new dependencies must be added to `pyproject.toml` first, then `uv sync`.

### G3 — Tool Schema Drift
The five tools defined in `project/tools.py` are the canonical tool list. The workflow's activity dispatch map must exactly match these five names. If the planner generates a tool call with a name not in this list, the workflow must log a warning and skip it — never crash.

### G4 — Model Drift
The Claude model string is set once in `config.py` as `CLAUDE_MODEL`. It is never hardcoded elsewhere. Default: `claude-haiku-4-5` for dev, `claude-sonnet-4-6` for production. Switch via env var `CLAUDE_MODEL=...`.

### G5 — Test Coverage Drift
Every new Activity function must have a corresponding test in `tests/test_activities.py` before the task is marked complete. Every new Workflow method must have a corresponding test in `tests/test_workflow.py`. No exceptions.

### G6 — Streaming Drift
All user-facing progress updates must go through `stream_update(task, message)` from the Agentex SDK. Never print to stdout as a substitute for streaming. Never accumulate all results and return them at once — stream at each tool-use step.

### G7 — Config Drift
Zero magic strings in implementation files. All configurable values (timeouts, model names, queue names, caps) must be imported from `config.py`. If a value appears hardcoded in `activities/` or `workflows/`, it is a bug.

---

## 7. Token Budget & Cost Expectations

Reference model: `claude-haiku-4-5` for dev, `claude-sonnet-4-6` for prod.

| Scenario | Est. Input Tokens | Est. Output Tokens | Est. Cost (Sonnet) |
|---|---|---|---|
| Simple search + summarize | ~6k | ~800 | ~$0.04 |
| 3-page research task | ~12k | ~1.5k | ~$0.08 |
| 5-page deep research | ~20k | ~2k | ~$0.13 |
| Runaway (hits MAX_TURNS) | ~25k | ~2.5k | ~$0.16 |

**Dev target:** All Phase 1–5 testing done with `USE_MOCK_BROWSER=true` and `USE_MOCK_SEARCH=true` — zero Anthropic API calls needed until Phase 5 end-to-end verification.

**Phase 6 live budget:** Budget $2–5 total for initial live integration testing (roughly 30–60 real tasks).

---

## 8. Mock Fixture Format

### `fixtures/mock_navigate.json`
```json
{
  "default": "<html><body><h1>Mock Page</h1><p>This is mock page content for testing the browser agent pipeline without real Playwright calls.</p></body></html>",
  "https://example.com": "<html><body><h1>Example Domain</h1><p>This domain is for use in illustrative examples.</p></body></html>"
}
```

### `fixtures/mock_search.json`
```json
{
  "default": [
    {
      "title": "Mock Result 1",
      "url": "https://example.com/article-1",
      "snippet": "This is the first mock search result for testing purposes."
    },
    {
      "title": "Mock Result 2",
      "url": "https://example.com/article-2",
      "snippet": "This is the second mock search result for testing purposes."
    }
  ]
}
```

### `fixtures/mock_extract.json`
```json
{
  "default": "Mock extracted content: This is clean readable text extracted from a mock web page. It contains relevant information about the topic being researched."
}
```

---

## 9. manifest.yaml Baseline

```yaml
name: web-scout
description: "Agentic browser agent — prompt in, web actions out"
version: "0.1.0"

acp:
  path: project/acp.py
  handler: handle_message

temporal:
  host: "${TEMPORAL_HOST}"
  namespace: "${TEMPORAL_NAMESPACE}"
  task_queue: "${TEMPORAL_TASK_QUEUE}"
  workflows:
    - workflows.browse_workflow.BrowseWorkflow
  activities:
    - activities.browser
    - activities.search
    - activities.extract
```

---

## 10. Definition of Done

The implementation is complete when all of the following are true:

1. `python -m pytest tests/` passes with zero failures
2. `agentex dev` starts without errors and UI is accessible at `localhost:3000`
3. A prompt sent in the Agentex UI with mock flags enabled returns a synthesized response through the full Agentex → Temporal → Planner → Activities → Agentex stack
4. A prompt sent with live flags enabled navigates real URLs via Playwright and returns a grounded answer
5. Temporal UI (port confirmed in T1.9) shows correct workflow run history with activity steps visible
6. No secrets appear in any log output
7. All invariants in §5 are verifiable by code inspection (no violations)
8. Per-task token cost for a standard 3-page research task is under $0.10 on `claude-sonnet-4-6`

---

## 11. Recommended Implementation Order for Claude Code

Follow this order strictly. Do not skip ahead.

1. T1.1 → T1.9 (scaffold, verify Agentex dev server runs)
2. T2.1 → T2.2 (config + tool schemas — no LLM calls yet)
3. T3.1 → T3.4 (activities with mock flags — no Temporal yet)
4. T2.3 → T2.4 (planner with mocked Anthropic client)
5. T4.1 → T4.3 (Temporal workflow with mocked activities)
6. T5.1 → T5.4 (wire ACP entrypoint — first full mock end-to-end)
7. T6.1 → T6.6 (go live)
8. T7.1 → T7.6 (hardening)

**If at any point a task cannot be completed as written**, Claude Code should halt, output a clear explanation of the blocker, and wait for updated instructions. Do not improvise around invariants.
