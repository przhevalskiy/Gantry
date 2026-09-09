# Modularization Plan

> **Note:** The legacy Next.js `ui/` client was removed in favor of [`apps/web/`](apps/web/). Sections below referencing `ui/` are historical.

Refactor the largest files into focused modules. No behavior changes — only structural splits.
Work top-down by impact: orchestrator first, then frontend mega-components.

---

## Files remaining after cleanup

```
README.md        — product docs, keep
DEPLOYMENT.md    — operational runbook, keep
SCALING.md       — future scaling notes, keep
ROADMAP.md       — future direction, keep
MODULARIZATION.md — this file
```

---

## Priority 1 — `workflows/swarm_orchestrator.py` (1,765 lines)

The single biggest file in the repo. It mixes five distinct concerns.

**Target structure:**

```
workflows/
  swarm_orchestrator.py          # thin coordinator (~300 lines)
                                 # keeps: signal handlers, run(), activity dispatch
  swarm/
    __init__.py
    track_manager.py             # extract_tracks, order_by_dependency,
                                 # resolve_conflicts, plan_track (~400 lines)
    healing.py                   # heal cycles, re-plan loop, failure recovery (~300 lines)
    state.py                     # snapshots, continuation, result accumulation (~250 lines)
    reporting.py                 # final report assembly, quality scoring call,
                                 # PR comment formatting (~200 lines)
```

**How to split:**
1. Move all `_extract_*`, `_order_*`, `_resolve_*`, `_plan_track_*` functions → `track_manager.py`
2. Move healing loop (`while not done: heal(...)`) and re-plan logic → `healing.py`
3. Move `save_snapshot`, `load_snapshot`, accumulator state → `state.py`
4. Move `_build_final_report`, `_post_github_comment`, quality score aggregation → `reporting.py`
5. `swarm_orchestrator.py` imports from all four and calls them; the `SwarmOrchestrator` class becomes a thin coordinator

---

## Priority 2 — `ui/components/file-explorer.tsx` (858 lines)

Three distinct concerns bundled together: tree sidebar, code viewer, and tab/state management.

**Target structure:**

```
ui/components/file-explorer/
  index.tsx          # main export; wires subcomponents (~120 lines)
  file-tree.tsx      # TreeItem, TreeNode, tree-walking helpers (~220 lines)
  code-viewer.tsx    # syntax highlighting, line numbers, status bar (~180 lines)
  tab-bar.tsx        # tab strip, close button, dirty indicator (~100 lines)
ui/hooks/
  use-file-tabs.ts   # tab state, server sync (ui-state API), content fetching (~150 lines)
```

**Migration path:**
- `use-file-tabs.ts` extracts: `tabs`, `activeTab`, `openTab`, `closeTab`, the `serverStateLoadedRef` fetch, debounced save, and the `fetchContent` callback
- `file-tree.tsx` extracts: `TreeItem`, `TreeNode`, `buildTree`, `extColor`, `FileIcon`
- `code-viewer.tsx` extracts: `CodeViewer`, `HLJS_STYLE`, `EXT_TO_LANG`, highlight logic
- `tab-bar.tsx` extracts: tab strip render, context menu
- `index.tsx` wires everything via props, keeps auto-follow and poll effects

---

## Priority 3 — `ui/app/projects/page.tsx` (964 lines)

A page component doing too much: data fetching, filter state, card rendering, modal dialogs, preferences sync.

**Target structure:**

```
ui/app/projects/
  page.tsx                             # data fetching, layout, modal wiring (~200 lines)
ui/components/projects/
  project-card.tsx                     # card UI, status badge, last-activity (~180 lines)
  project-grid.tsx                     # grid layout, empty state (~100 lines)
  filter-controls.tsx                  # search input, status/access/build-type filters (~120 lines)
  confirm-delete-modal.tsx             # delete confirmation dialog (~80 lines)
ui/hooks/
  use-project-filters.ts               # filter + search state, filteredCards memo (~100 lines)
  use-server-preferences.ts            # load/push activeProjectId to /api/preferences (~60 lines)
```

**Migration path:**
- `use-project-filters.ts` lifts the `search`, `statusFilter`, `accessFilter`, `buildTypeFilter`, `viewMode`, `groupBy` state and `filteredCards` memo
- `use-server-preferences.ts` lifts the two `preferencesSyncedRef` / `prevActiveRef` effects
- `project-card.tsx` gets the `ProjectCard` type, status resolution helpers, and card render
- `page.tsx` becomes: load projects, load tasks, wire hooks, render `<FilterControls>`, `<ProjectGrid>`, modals

---

## Priority 4 — `ui/components/search-home.tsx` (1,020 lines)

Task creation UI with inlined suggestion content, file attachment logic, context assembly, and form state.

**Target structure:**

```
ui/components/search-home/
  index.tsx                  # form shell, submit handler, layout (~200 lines)
  suggestion-categories.tsx  # category definitions + grid render (~200 lines)
  recent-tasks.tsx           # recent task list from report store (~120 lines)
  context-builder.tsx        # file/URL context assembly, attachment preview (~150 lines)
  agent-selector.tsx         # model picker, agent config link (~80 lines)
```

**Migration path:**
- Move the `SUGGESTION_CATEGORIES` constant and its render → `suggestion-categories.tsx`
- Move recent-tasks logic (reads `useReportStore`) → `recent-tasks.tsx`
- Move file attachment state + URL context → `context-builder.tsx`; it wraps `use-file-attachments`
- `index.tsx` owns form submit, `useState` for the prompt text, and layout

---

## Priority 5 — `ui/components/docs-page.tsx` (1,054 lines)

All document content is inlined as constants. Separate content from renderer.

**Target structure:**

```
ui/components/docs-page/
  index.tsx           # layout, search, nav state (~150 lines)
  doc-tree.tsx        # sidebar tree render (~100 lines)
  doc-content.tsx     # section renderer, code blocks, tables (~150 lines)
  doc-data.ts         # all DOC_SECTIONS / content constants (~650 lines)
```

**Migration path:**
- Move all `DOC_SECTIONS`, content strings, and section definitions → `doc-data.ts`
- `doc-content.tsx` imports from `doc-data.ts` and renders
- `doc-tree.tsx` renders the navigation tree from `doc-data.ts`
- `index.tsx` holds search state, selected section, and layout

---

## Priority 6 — `project/planner.py` (591 lines)

Mixes two LLM backend implementations (Anthropic and Mistral), context management utilities, and the unified entry point.

**Actual structure (executed):**

```
project/
  planner.py           # types, context management, next_step() entry point (~250 lines)
  planner_types.py     # PlannerStep, FinalAnswer, PlannerError, PlannerResult (~25 lines)
  backends/
    __init__.py
    anthropic.py       # make_claude_request(), retry logic (~60 lines)
    mistral.py         # make_mistral_request(), format converters (~170 lines)
```

**Migration path (executed):**
- Moved `PlannerStep`, `FinalAnswer`, `PlannerError`, `PlannerResult` → `planner_types.py`
- Moved `_make_claude_request` → `backends/anthropic.py`
- Moved `_make_mistral_request`, `_to_mistral_tools`, `_anthropic_context_to_mistral`, `_is_mistral_model` → `backends/mistral.py`
- `planner.py` imports from both backends; keeps context management and `next_step()`
- All existing `from project.planner import ...` call sites continue to work unchanged (module re-exports)

---

## Priority 7 — `ui/components/api-docs-page.tsx` (631 lines)

Same problem as `docs-page.tsx`: 415 lines of static `CONTENT` object embedded directly in the component file, leaving only ~200 lines of actual rendering logic.

**Target structure:**

```
ui/components/api-docs-page/
  index.tsx          # ApiDocsPage component, navigation state (~120 lines)
  doc-body.tsx       # DocBody renderer, inlineFormat helper (~180 lines)
  api-docs-data.ts   # SECTIONS + CONTENT constants (~380 lines)
```

**Migration path:**
- Move `SECTIONS` and `CONTENT` constants → `api-docs-data.ts`
- Move `DocBody` and `inlineFormat` → `doc-body.tsx`
- `index.tsx` imports both and renders the page shell

---

## Priority 8 — `ui/components/project-memory-panel.tsx` (584 lines)

Five visually distinct sub-components inlined into a single file: modals, score trend, list items, and the main panel.

**Target structure:**

```
ui/components/memory/
  index.tsx              # ProjectMemoryPanel, data fetching (~130 lines)
  modals.tsx             # ModalBackdrop, ModalHeader, FactModal, EpisodeModal (~200 lines)
  list-items.tsx         # FactCard, EpisodeRow, AgentBadge (~120 lines)
  score-trend.tsx        # ScoreTrend chart component (~60 lines)
```

**Migration path:**
- Move all modal components → `modals.tsx`
- Move `FactCard`, `EpisodeRow`, `AgentBadge`, `OUTCOME_COLOR`, `AGENT_COLORS` → `list-items.tsx`
- Move `ScoreTrend` → `score-trend.tsx`
- `index.tsx` imports from the three files; owns data fetching and panel layout

---

## What stays unchanged and why

| File | Lines | Verdict |
|---|---|---|
| `workflows/builder_agent.py` | 584 | Single `BuilderAgent` class, all one concern |
| `workflows/architect_agent.py` | 436 | Single `ArchitectAgent` class, all one concern |
| `workflows/*_agent.py` (rest) | 169–292 | One agent per file, each coherent |
| `activities/shell_activities.py` | 391 | All shell execution — `run_command`, `install_packages`, `verify_build`, etc. share the same subprocess/env setup; splitting would fracture that |
| `activities/memory_activities.py` | 265 | Fact + episode R/W are tightly coupled |
| `activities/file_activities.py` | 263 | File read/write/search share a caching layer |
| `activities/git_activities.py` | 227 | All git operations, single concern |
| `activities/index_activities.py` | 206 | All symbol indexing, single concern |
| `api/routes/*.py` | 56–288 | One domain per route file |
| `ui/hooks/*.ts` | 20–101 | One hook per file |
| `ui/lib/*.ts` | 17–84 | Focused utilities |
| `ui/components/swarm-view.tsx` | 592 | Already delegates to `swarm/` subdir; remaining code is coordinator layout + follow-up input |
| `ui/components/sidebar.tsx` | 311 | Single navigation component |
| `ui/components/swarm/context-usage.tsx` | 391 | Single visualization, cannot be meaningfully split |
| `ui/components/feed/hitl-cards.tsx` | 417 | All HITL card variants, same concern |
| `ui/components/feed/plan-cards.tsx` | 365 | All plan card variants, same concern |

---

## Execution order

```
1. swarm_orchestrator.py      ← biggest Python win; test coverage exists
2. file-explorer              ← cleanest boundary, self-contained hook extraction
3. projects/page.tsx          ← most-visited UI, high leverage
4. api-docs-page              ← quick win, pure data/renderer split
5. project-memory-panel       ← clear internal sections already present
6. search-home                ← unblocked after 2 and 3
7. docs-page                  ← same pattern as api-docs-page, low risk
8. planner.py                 ← last; prompts are sensitive to exact wording
```

Each split is independently shippable with no cross-split dependencies.
