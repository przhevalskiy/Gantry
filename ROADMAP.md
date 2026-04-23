# Gantry — Product Roadmap

## Architecture Constraint (Read This First)

**Nothing in this roadmap replaces or bypasses Scale's Agentex stack.**

The engine stays exactly as-is:
- Temporal workflows (`workflows/browse_workflow.py`)
- Agentex ACP entry point (`project/acp.py`)
- Activities: browser, search, extract, planner (`activities/`)
- Agent registered via `manifest.yaml` and running against `:5003`

What this roadmap adds is **surface** — a custom UI layer and a browser extension — both of which talk to the same Agentex API at `:5003` using the `agentex` npm SDK.

If any step requires changing how the agent registers, how Temporal is configured, or how activities are structured — stop. That is architectural drift.

---

## Phase 1 — Agent Depth and Output Quality

**Status: IMPLEMENTED**  
**Goal:** Agent researches deeply (3+ sources, contradictions surfaced, citations enforced) and returns structured output every time.

Three scans were conducted before implementation:
- Scan 1: Correctness — identified exact values, limits, and what was factually wrong
- Scan 2: Concrete changes — surgical file/line replacements
- Scan 3: Exhaustive — found everything Scan 2 missed (model, tokens, citation tracking, search enforcement)

### What was implemented (11 changes across 7 files)

| # | File | Change |
|---|------|--------|
| 1 | [project/config.py](project/config.py) | Model: `claude-haiku-4-5` → `claude-sonnet-4-6` |
| 2 | [project/config.py](project/config.py) | `MAX_PAGES_PER_TASK` default: `5` → `8` |
| 3 | [project/planner.py](project/planner.py) | `max_tokens`: `4096` → `8192` |
| 4 | [project/planner.py](project/planner.py) | System prompt: numbered rules, 3-source minimum, contradiction detection |
| 5 | [project/planner.py](project/planner.py) | First-turn priming: task wrapped with research instructions |
| 6 | [project/tools.py](project/tools.py) | `finish` tool: enforced markdown structure, 3-source minimum, contradiction section required |
| 7 | [activities/browser.py](activities/browser.py) | Page content cap: `8000` → `15000` chars |
| 8 | [activities/extract.py](activities/extract.py) | `_MAX_PAGE_CHARS`: `8000` → `15000`, `_MAX_CONTEXT_CHARS`: `12000` → `25000` |
| 9 | [activities/search.py](activities/search.py) | Default results: `5` → `7`, `search_depth="advanced"`, `include_answer=True` |
| 10 | [workflows/browse_workflow.py](workflows/browse_workflow.py) | Citation tracking: `visited_urls` list injected into force-finish message |
| 11 | [workflows/browse_workflow.py](workflows/browse_workflow.py) | Search enforcement: blocks `navigate` before first `search_web` |

### Verification (required before Phase 2)

Run the agent against this query:
> "What are the main differences between Anthropic's Claude and OpenAI's GPT-4 in terms of safety approach, capabilities, and pricing?"

**Pass criteria — all must be true:**
- [ ] At least 3 `navigate` calls before `finish()`
- [ ] At least 2 different `search_web` calls
- [ ] Answer contains `## Summary`, `## Key Findings`, `## Contradictions or Disagreements`, `## Sources Consulted`
- [ ] At least 3 URLs in Sources Consulted
- [ ] Answer is 200+ words
- [ ] No `navigate` call appears before the first `search_web`

**Do not proceed to Phase 1.5 until all 6 pass criteria are confirmed.**

---

## Phase 1 — Known Gaps (Deliberately Left Out)

These were identified in the three-scan process but excluded from Phase 1 implementation. They are the starting baseline for Phase 1.5 — do not rediscover them.

| Gap | Why excluded | Phase |
|-----|-------------|-------|
| Answer quality gate in workflow | Adds workflow complexity — validate prompt engineering works first | 1.5 |
| Citation chain following | Requires new tool or instruction — validate base depth first | 1.5 |
| Source diversity enforcement | Domain deduplication logic — validate multi-source works first | 1.5 |
| Minimum answer length gate | Workflow re-prompt logic — validate structure enforcement first | 1.5 |
| `summarize_results()` context compression | Context bloat unlikely at current caps — add if token errors appear | 1.5 |
| `acp_type="agentic"` deprecation fix | `project/acp.py` uses deprecated value — works but should be `"async"` | 1.5 |

---

## Phase 1.5 — Agent Quality Round 2

**Status: NOT STARTED**
**Prerequisite:** Phase 1 verification query must pass all 6 criteria first.
**Goal:** Harden the agent so it cannot produce structurally invalid or shallow output regardless of the query. Phase 1 enforces quality via prompting. Phase 1.5 enforces it via code.
**Files touched:** `workflows/browse_workflow.py`, `project/tools.py`, `activities/browser.py`, `project/acp.py`
**No new dependencies.**

**Run three scans before implementing anything in this phase.**

---

### Step 1.5.1 — Answer quality gate

**What:** The workflow currently accepts any `finish()` call unconditionally. Claude could return an answer missing required headings and it would be sent to the user unchanged.

**Change in `workflows/browse_workflow.py`:** After receiving `raw["type"] == "final"`, validate the answer contains all required sections before accepting it. If not, re-inject a correction message and continue the loop.

Required headings to check: `## Summary`, `## Key Findings`, `## Contradictions or Disagreements`, `## Sources Consulted`

Logic:
```python
REQUIRED_HEADINGS = ["## Summary", "## Key Findings", "## Contradictions", "## Sources Consulted"]

def _answer_is_valid(answer: str) -> bool:
    return all(h in answer for h in REQUIRED_HEADINGS) and len(answer) >= 200

# In the main loop, replace the unconditional finish acceptance with:
if raw["type"] == "final":
    answer = raw["answer"]
    if not _answer_is_valid(answer):
        log.warning("answer_failed_quality_gate", length=len(answer))
        context = context + [{
            "role": "user",
            "content": [{
                "type": "text",
                "text": (
                    "Your answer is missing required sections or is too short. "
                    "It must include: ## Summary, ## Key Findings (with URLs), "
                    "## Contradictions or Disagreements, ## Sources Consulted. "
                    "Minimum 200 words. Please call finish() again with the correct structure."
                ),
            }],
        }]
        continue  # Back to planning loop
    # Only accept if valid
    ...close browser, send answer...
```

**Guardrail:** Force a short answer by temporarily lowering MAX_AGENT_TURNS to 3. The quality gate should re-prompt Claude rather than accepting the incomplete answer. Restore MAX_AGENT_TURNS after confirming.

**Pause here. Verify gate fires and re-prompts before proceeding.**

---

### Step 1.5.2 — Minimum answer length gate

**What:** Separate from heading validation — answers can have all headings but still be thin. Minimum 200 words enforced in code, not just in the prompt.

**This is already included in `_answer_is_valid()` above** (`len(answer) >= 200`). No separate implementation needed — confirm it works as part of Step 1.5.1 guardrail.

---

### Step 1.5.3 — Source diversity enforcement

**What:** Claude could search one query, get 7 results from the same domain (e.g. all from Wikipedia), navigate all 7, and technically satisfy "3 sources visited." The research would be shallow despite passing structural checks.

**Change in `workflows/browse_workflow.py`:** Track visited domains alongside visited URLs. When 2+ consecutive navigations are to the same domain, inject a warning.

```python
from urllib.parse import urlparse

def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return url

# In the tracking block after navigate:
visited_domains = [_domain(u) for u in visited_urls]
if len(visited_urls) >= 2 and _domain(url) in visited_domains[:-1]:
    context = context + [{
        "role": "user",
        "content": [{
            "type": "text",
            "text": f"You have already read from {_domain(url)}. Seek a source from a different domain for better coverage.",
        }],
    }]
```

**Guardrail:** Submit a query where Tavily would naturally return many results from one domain (e.g. "Python documentation for async/await"). Confirm the diversity warning fires and Claude navigates to a different domain on the next turn.

---

### Step 1.5.4 — Citation chain following

**What:** When Claude reads a page that references a study, report, or primary source, it currently has no mechanism to follow that link. It synthesizes from the summary rather than the original.

**Change in `project/tools.py`:** Add a `get_links` tool that extracts all hyperlinks from the current page. Claude can call it after `navigate` to see what primary sources are referenced.

```python
{
    "name": "get_links",
    "description": (
        "Extract all hyperlinks from the current page. Use this after navigate() "
        "to find primary sources, studies, or references cited by the page. "
        "Then navigate to the most relevant ones directly."
    ),
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
},
```

**Change in `activities/browser.py`:** Add a `get_links` activity that extracts `<a href>` elements from the current page session.

**Change in `workflows/browse_workflow.py`:** Register `get_links` in `_dispatch_activity` and `VALID_TOOL_NAMES`.

**Change in `project/run_worker.py`:** Register the new activity.

**System prompt addition in `project/planner.py`:** Add rule 7: `"After navigating to a page that references a study or report, use get_links to find and navigate to the primary source directly."`

**Guardrail:** Submit a query that naturally leads to pages with citations (e.g. "What does research show about sleep and memory?"). Confirm Claude calls `get_links` at least once and navigates to a linked source.

---

### Step 1.5.5 — Fix `acp_type` deprecation

**File:** `project/acp.py` line 12
**Current:** `acp_type="agentic"`
**Replace with:** `acp_type="async"`

One line. No behaviour change — `"agentic"` delegates to `"async"` internally. This removes the deprecation warning from logs.

**Guardrail:** Restart the worker. No deprecation warnings in the logs.

---

### Phase 1.5 Verification

Run the same verification query as Phase 1:
> "What are the main differences between Anthropic's Claude and OpenAI's GPT-4 in terms of safety approach, capabilities, and pricing?"

**Additional pass criteria for Phase 1.5 (on top of Phase 1 criteria):**
- [ ] Deliberately trigger a short answer — confirm quality gate re-prompts rather than accepting
- [ ] All 4 required headings present in final answer
- [ ] Answer is 200+ words (confirmed by character count, not estimate)
- [ ] At least 2 distinct domains in Sources Consulted
- [ ] `get_links` appears at least once in the tool call sequence
- [ ] No deprecation warnings in worker logs

**Do not proceed to Phase 2 until all criteria confirmed.**

---

## Phase 2 — Custom Web App (keystone-ui)

**Goal:** A standalone Next.js app that replaces the Scale dev UI for demos and external use.  
**Architecture rule:** This app ONLY talks to `:5003` via the `agentex` npm SDK. It does not talk to Temporal directly. It does not talk to the agent process directly.

---

### Step 2.1 — Scaffold the app

From Keystone root:

```bash
npx create-next-app@latest keystone-ui \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd keystone-ui
npm install agentex @tanstack/react-query
```

**Guardrail:** `cd keystone-ui && npm run dev` starts without errors on port 3000. The default Next.js page loads.

**Pause here. Confirm the app starts cleanly.**

---

### Step 2.2 — Environment configuration

Create `keystone-ui/.env.local`:

```
NEXT_PUBLIC_AGENTEX_API_BASE_URL=http://localhost:5003
```

**Do not hardcode this URL anywhere in component code.** Always read from `process.env.NEXT_PUBLIC_AGENTEX_API_BASE_URL`.

**Guardrail:** `console.log(process.env.NEXT_PUBLIC_AGENTEX_API_BASE_URL)` in any server component returns `http://localhost:5003`. If undefined, the `.env.local` file is not being read — confirm it is at `keystone-ui/.env.local`, not the repo root.

---

### Step 2.3 — Agentex client singleton

Create `keystone-ui/lib/agentex-client.ts`:

```typescript
import { AgentexSDK } from 'agentex'

export const agentexClient = new AgentexSDK({
  baseURL: process.env.NEXT_PUBLIC_AGENTEX_API_BASE_URL!,
})
```

This is the only place the SDK is instantiated. Every hook and component imports from here.

**Guardrail:** Import `agentexClient` in a test page and call `agentexClient.agents.list()`. It should return a list that includes `web-scout`. If it throws a network error, confirm the Scale platform is running (`./dev.sh status` in the scale-agentex folder).

**Pause here. Confirm `web-scout` appears in the agents list response.**

---

### Step 2.4 — React Query provider

Update `keystone-ui/app/layout.tsx` to wrap children in a React Query provider:

```typescript
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function RootLayout({ children }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

**Guardrail:** No console errors about missing QueryClient context.

---

### Step 2.5 — Task subscription hook

Create `keystone-ui/hooks/use-task-subscription.ts`:

```typescript
import { useEffect, useState } from 'react'
import { subscribeTaskState } from 'agentex/lib'

export function useTaskSubscription(taskId: string | null) {
  const [task, setTask] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    if (!taskId) return
    const unsub = subscribeTaskState(taskId, {
      baseURL: process.env.NEXT_PUBLIC_AGENTEX_API_BASE_URL!,
      onTask: setTask,
      onMessages: setMessages,
    })
    return () => unsub()
  }, [taskId])

  return { task, messages }
}
```

**Guardrail:** This hook is the real-time connection. Do not poll. Do not use `setInterval`. The WebSocket subscription from `subscribeTaskState` handles all updates. If messages are not updating in real time, check that the Scale platform's WebSocket endpoint is reachable at `:5003`.

---

### Step 2.6 — Three pages only

**Page 1: Home (`keystone-ui/app/page.tsx`)**

Input box + submit button. On submit:
1. Call `agentexClient.tasks.create({ agentName: 'web-scout', params: { prompt: query } })`
2. Get back a `task.id`
3. Push to `/research/[task.id]`

No streaming on this page. Just create and redirect.

**Page 2: Research view (`keystone-ui/app/research/[taskId]/page.tsx`)**

- Use `useTaskSubscription(taskId)` for real-time updates
- Show messages as they arrive — each `"Using tool: navigate..."` message is a source being read
- When a message from `author: "agent"` contains `## Summary`, render it as the final answer
- Show a spinner/loading state while `task.status !== 'completed'`

**Page 3: Shared result (`keystone-ui/app/r/[taskId]/page.tsx`)**

- Same as research view but read-only
- No input box
- Static render of the completed answer
- This is the shareable URL

**Guardrail for all three pages:**
1. Submit a query on the home page
2. Confirm redirect to `/research/[taskId]`
3. Watch messages appear in real time as the agent works
4. Confirm the final structured answer renders correctly with all three sections
5. Copy the `/r/[taskId]` URL and open in an incognito window — the result should be readable without being logged in

**Pause here. Complete this full flow before moving to Phase 3.**

---

### Step 2.7 — Live source feed (the consumer hook)

In the research view, as messages arrive, extract any URL from `"Using tool: navigate..."` messages and display them as a live feed:

```
Researching...
  ✓ anthropic.com/about
  ✓ techcrunch.com/2024/...
  → crunchbase.com/organization/... (reading now)
```

This is the visual differentiator. Users see the agent working in real time. No other consumer product shows this.

**Implementation:** Parse message content with a simple regex for URLs. Do not make additional API calls to fetch page titles — use the domain as the label. Keep it simple.

**Guardrail:** Each navigate call by the agent produces one entry in the live feed. The feed grows in real time. The final entry transitions to the answer view.

---

## Phase 3 — Browser Extension

**Goal:** User is on any webpage. The extension detects context, triggers a web-scout research workflow, and surfaces the result in a sidebar — without the user leaving the page.  
**Architecture rule:** The extension calls the Agentex API at `:5003` directly. It uses the same task creation pattern as the web app. It does not talk to Temporal or the agent process directly.

---

### Step 3.1 — Extension scaffold

Create `keystone-extension/` at repo root:

```
keystone-extension/
  manifest.json       ← Chrome extension config (Manifest V3)
  content.js          ← reads page context, injects sidebar
  background.js       ← calls Agentex API, manages task lifecycle
  sidebar.html        ← the research panel UI
  sidebar.css         ← sidebar styles
  icons/              ← 16, 48, 128px icons
```

**Guardrail:** Load the unpacked extension in Chrome (`chrome://extensions` → Load unpacked → select `keystone-extension/`). The extension icon appears in the toolbar. No console errors.

**Pause here. Confirm the extension loads without errors.**

---

### Step 3.2 — Manifest V3 config

`keystone-extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Keystone",
  "version": "0.1.0",
  "description": "Deep research on any page",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["http://localhost:5003/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "action": {
    "default_popup": "sidebar.html"
  },
  "icons": {
    "16": "icons/16.png",
    "48": "icons/48.png",
    "128": "icons/128.png"
  }
}
```

**Guardrail:** No manifest validation errors in `chrome://extensions`. Extension remains enabled after reloading.

---

### Step 3.3 — Context reader (`content.js`)

When the extension icon is clicked, `content.js` reads the current page:

```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_PAGE_CONTEXT') {
    sendResponse({
      url: window.location.href,
      title: document.title,
      // First 500 chars of visible text — enough context for the agent
      snippet: document.body.innerText.slice(0, 500),
    })
  }
})
```

**Guardrail:** From `background.js`, send `{ type: 'GET_PAGE_CONTEXT' }` to the active tab and log the response. Confirm `url`, `title`, and `snippet` are populated correctly on at least 3 different pages.

---

### Step 3.4 — API call (`background.js`)

When the user clicks the extension icon or triggers research:

```javascript
const AGENTEX_URL = 'http://localhost:5003'

async function createResearchTask(context) {
  const prompt = `Research this page and topic:
Title: ${context.title}
URL: ${context.url}
Context: ${context.snippet}

Provide a deep research brief on the company, person, or topic on this page.`

  const response = await fetch(`${AGENTEX_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_name: 'web-scout',
      params: { prompt },
    }),
  })

  const task = await response.json()
  return task.id
}
```

**Guardrail:** Open a company homepage (e.g. `anthropic.com`). Click the extension. Confirm a task is created in the Scale dev UI at `:3000`. The task should appear with status `running` and the prompt should reference the page title and URL.

**Pause here. Confirm task creation works from the extension before building the sidebar.**

---

### Step 3.5 — Sidebar with live feed (`sidebar.html`)

The sidebar polls for task messages and renders them progressively:

```javascript
async function pollMessages(taskId) {
  const response = await fetch(`${AGENTEX_URL}/tasks/${taskId}/messages`)
  const data = await response.json()
  return data.messages || []
}
```

Render each message:
- `"Using tool: navigate..."` → add a source to the live feed
- `"## Summary"` prefix → render as the final structured answer
- All others → show as status text

**Guardrail:**
1. Click extension on `anthropic.com`
2. Sidebar opens immediately showing "Researching..."
3. Sources appear as the agent navigates
4. Final structured answer appears with Summary, Key Findings, Sources
5. The answer is specifically about Anthropic — not generic

**Pause here. Full extension flow must work end-to-end before any cleanup.**

---

### Step 3.6 — Context inference (the Comet move)

Make the extension proactive — it infers what to research without the user explicitly asking.

When a page loads, `content.js` sends context to `background.js`. `background.js` checks:
- Is this a company homepage? (check for `/about`, company name patterns)
- Is this a news article? (check for article tags, author bylines)
- Is this a person's profile? (LinkedIn, Twitter patterns)

If yes, pre-warm by creating the research task immediately. When the user clicks the extension, the result is already partially complete or done.

**Guardrail:** Navigate to a company homepage. Wait 5 seconds without clicking anything. Click the extension. The research should be further along than if you had clicked immediately. If the pre-warming creates too many tasks (navigating between pages rapidly), add a 3-second debounce before creating the task.

---

## Phase 4 — Shareable Results

**Goal:** Every completed research result has a public permalink. This is the growth loop.

**Implementation:** Already architected in Phase 2, Step 2.6. The `/r/[taskId]` page fetches the completed task messages via `agentexClient.messages.list(taskId)` and renders the final answer statically.

Add a share button to the research view that copies the `/r/[taskId]` URL to clipboard.

**Guardrail:**
1. Complete a research task
2. Click the share button
3. Open the copied URL in an incognito window
4. The full structured answer renders without requiring any login
5. The URL is stable — refreshing returns the same result

---

## Architectural Guardrails (Always Apply)

These apply to every phase. If any of these are violated, stop and reassess before continuing.

| # | Rule |
|---|------|
| G1 | The `agentex` npm SDK is the only way the UI talks to the backend. No direct Temporal calls. No direct agent process calls. |
| G2 | `NEXT_PUBLIC_AGENTEX_API_BASE_URL` is the only URL configuration. Never hardcode `:5003`. |
| G3 | The browser extension calls `:5003` directly. It does not talk to the web app. Both are separate consumers of the same API. |
| G4 | No changes to `project/acp.py`, `manifest.yaml`, or the Temporal workflow registration unless fixing a confirmed bug. |
| G5 | The `agentex` npm SDK types (`Task`, `TaskMessage`, `Agent`) are the source of truth for data shapes. Do not define custom types that duplicate these. |
| G6 | `subscribeTaskState` is used for real-time updates. Do not replace it with polling via `setInterval`. |
| G7 | Each phase must pass its guardrails before the next phase begins. No skipping ahead. |

---

## Completion Checklist

### Phase 1
- [ ] At least 3 `navigate` calls before `finish()`
- [ ] At least 2 different `search_web` calls
- [ ] Answer contains `## Summary`, `## Key Findings`, `## Contradictions or Disagreements`, `## Sources Consulted`
- [ ] At least 3 URLs in Sources Consulted
- [ ] Answer is 200+ words
- [ ] No `navigate` call appears before the first `search_web`

### Phase 1.5
- [ ] Quality gate fires and re-prompts on structurally invalid answer
- [ ] All 4 required headings present in every answer
- [ ] Answer is 200+ words confirmed by character count
- [ ] At least 2 distinct domains in Sources Consulted
- [ ] `get_links` tool appears at least once in a real research run
- [ ] No deprecation warnings in worker logs (`acp_type="async"`)

### Phase 2
- [ ] `keystone-ui` starts on port 3000 without errors
- [ ] `web-scout` appears in agents list via SDK
- [ ] Task creation works from the home page
- [ ] Real-time message feed updates without polling
- [ ] Final structured answer renders correctly
- [ ] `/r/[taskId]` works in incognito without login
- [ ] Live source feed shows pages as they are visited

### Phase 3
- [ ] Extension loads in Chrome without errors
- [ ] Page context is read correctly on 3 different pages
- [ ] Task creation works from the extension (visible in Scale dev UI)
- [ ] Sidebar shows live source feed
- [ ] Final answer renders in sidebar
- [ ] Context inference pre-warms research on company pages

### Phase 4
- [ ] Share button copies correct URL
- [ ] Shared URL renders in incognito
- [ ] Refreshing shared URL returns same result
