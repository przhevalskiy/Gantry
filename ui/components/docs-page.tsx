'use client';

import { useState } from 'react';

// ── Doc tree ──────────────────────────────────────────────────────────────────

type DocSection = {
  title: string;
  slug: string;
  children?: { title: string; slug: string }[];
};

const DOC_TREE: DocSection[] = [
  { title: 'Introduction', slug: 'introduction' },
  {
    title: 'Architecture',
    slug: 'architecture',
    children: [
      { title: 'Overview', slug: 'architecture-overview' },
      { title: 'Temporal & Durability', slug: 'architecture-temporal' },
      { title: 'Swarm Pipeline', slug: 'architecture-pipeline' },
      { title: 'Manifest & State', slug: 'architecture-manifest' },
    ],
  },
  {
    title: 'Agents',
    slug: 'agents',
    children: [
      { title: 'Foreman', slug: 'agents-foreman' },
      { title: 'PM', slug: 'agents-pm' },
      { title: 'Architect', slug: 'agents-architect' },
      { title: 'Builder', slug: 'agents-builder' },
      { title: 'Inspector', slug: 'agents-inspector' },
      { title: 'Security', slug: 'agents-security' },
      { title: 'DevOps', slug: 'agents-devops' },
    ],
  },
  { title: 'Complexity Tiers', slug: 'tiers' },
  {
    title: 'Self-Healing',
    slug: 'healing',
    children: [
      { title: 'Heal Loop', slug: 'healing-loop' },
      { title: 'Architect Re-planning', slug: 'healing-replan' },
      { title: 'Git Snapshots', slug: 'healing-snapshots' },
    ],
  },
  {
    title: 'Code Intelligence',
    slug: 'intelligence',
    children: [
      { title: 'Repo Index', slug: 'intelligence-index' },
      { title: 'Symbol Search', slug: 'intelligence-symbols' },
      { title: 'Track Dependencies', slug: 'intelligence-deps' },
    ],
  },
  { title: 'Test-Driven Building', slug: 'tdd' },
  {
    title: 'Memory',
    slug: 'memory',
    children: [
      { title: 'Facts Store', slug: 'memory-facts' },
      { title: 'Episodic Memory', slug: 'memory-episodes' },
    ],
  },
  { title: 'Configuration', slug: 'configuration' },
  { title: 'Running Locally', slug: 'local' },
];

// ── Doc content ───────────────────────────────────────────────────────────────

const DOCS: Record<string, { title: string; body: string }> = {
  introduction: {
    title: 'Introduction',
    body: `# Gantry

Gantry is a durable, multi-agent software engineering factory. You describe what to build — a feature, a fix, a full-stack app — and a coordinated crew of specialised agents plans, writes, tests, secures, and ships the code as a pull request.

## What makes it different

**Durable by default.** Every build runs inside a Temporal workflow. If your laptop closes, the worker crashes, or the network drops, the swarm picks up exactly where it left off. No lost work, no restarts.

**Parallel execution.** The Architect decomposes your goal into independent tracks. Multiple Builder agents write code simultaneously — frontend, backend, tests, and infra in parallel — then the Inspector validates the merged result.

**Self-correcting.** When the Inspector finds failures, it generates concrete fix instructions and re-invokes the Builder. If the original plan was structurally wrong, the Architect re-decomposes before burning heal cycles. The swarm escalates to you only after exhausting every automated recovery path.

**Code-aware.** After each build, a symbol index maps every function, class, and type to its file and line number. Agents query the index instead of reading files blind.

## When to use it

- Building a new feature across multiple files or services
- Scaffolding a full-stack application from a description
- Fixing a bug that requires understanding a large codebase
- Running a security audit and auto-patching findings
- Any task where you want durable, auditable, parallel code generation
`,
  },

  'architecture-overview': {
    title: 'Architecture Overview',
    body: `# Architecture Overview

Gantry is built on three layers:

## 1. Agentex (hosting + protocol)

Agentex provides the agent hosting infrastructure. It handles containerisation, secrets injection, message streaming, and the Agent-to-Client Protocol (ACP) that lets any client talk to any agent with a unified interface.

## 2. Temporal (durability + orchestration)

Every swarm run is a Temporal workflow. Temporal provides:

- **Durable execution** — workflow state survives crashes and restarts
- **Activity retries** — failed LLM calls or file operations retry automatically
- **Child workflows** — each agent (Architect, Builder, Inspector) runs as an isolated child workflow
- **Signals** — follow-up prompts from the user are delivered as Temporal signals

## 3. The Swarm (agents + tools)

The swarm is a pipeline of specialised agents, each with a focused toolset:

\`\`\`
PM → Architect → Builders (parallel) → Inspector (heal loop) → Security → DevOps
\`\`\`

Each agent is a Temporal child workflow that calls an LLM in a tool-use loop, executes activities (file I/O, shell commands, git operations), and returns a structured result to the Foreman.

## Data flow

1. User submits a goal via the UI or API
2. Agentex creates a task and routes it to the SwarmOrchestrator workflow
3. The Foreman classifies complexity, dispatches agents in sequence, and manages the heal loop
4. Agents emit tagged messages that the UI parses in real time
5. DevOps opens a pull request; the final report is rendered in the UI
`,
  },

  'architecture-temporal': {
    title: 'Temporal & Durability',
    body: `# Temporal & Durability

## Why Temporal

Software engineering tasks are long-running. A full-stack build can take 20–45 minutes. Without durability, any interruption — network blip, worker restart, laptop close — loses all progress.

Temporal solves this with **event sourcing**: every workflow step is recorded in an append-only event history. If a worker dies, a new worker replays the history and resumes from the last checkpoint. The workflow code never knows the difference.

## Workflow hierarchy

\`\`\`
SwarmOrchestrator (parent)
├── PMAgent
├── ArchitectAgent
├── BuilderAgent (×N, parallel)
├── InspectorAgent
├── SecurityAgent
└── DevOpsAgent
\`\`\`

Each agent is a \`@workflow.defn\` class. The Foreman launches them as child workflows via \`workflow.execute_child_workflow()\`.

## Activities vs workflows

- **Activities** are single, retryable operations: read a file, call the LLM, run a shell command. They have timeouts and retry policies.
- **Workflows** are durable orchestrators. They call activities and child workflows but never do I/O directly.

This separation means an LLM call that times out retries automatically. A file write that fails retries up to 3 times. The workflow itself never fails due to transient errors.

## Follow-up loop

After each build, the Foreman waits up to 24 hours for a follow-up signal. The user can send a follow-up from the UI at any time. The Foreman re-runs the full pipeline with the new goal on the same repo.
`,
  },

  'architecture-pipeline': {
    title: 'Swarm Pipeline',
    body: `# Swarm Pipeline

The pipeline runs in sequence. Each stage is a child workflow that returns a structured JSON result to the Foreman.

## Stage 0: PM (tier ≥ 1)

Scans the repo for context (README, package files), searches past build episodes for similar work, and optionally asks the user clarifying questions via a HITL checkpoint. Returns an enriched goal the Architect uses.

Skipped on Tier 0 (micro tasks).

## Stage 1: Architect

Reads the repo, maps the tech stack, and decomposes the goal into parallel tracks. Each track has a label, implementation steps, key files it owns, symbols it exports, dependencies on other tracks, and a test spec for TDD.

## Stage 2: Builders (parallel, wave-ordered)

Tracks are sorted into waves by their dependency graph. Each wave runs in parallel; waves execute sequentially. Independent tracks (frontend + backend) run simultaneously. Dependent tracks wait for their dependencies.

## Stage 3: Inspector (heal loop)

Runs tests, lint, and type checks. If checks fail, produces heal instructions and re-invokes the Builder. Up to \`max_heal_cycles\` attempts before escalating to the Architect.

## Stage 4: Security

Scans for committed secrets, vulnerable dependencies, and insecure patterns. Blocks the PR if critical or high findings exist. Skipped on Tier 0/1.

## Stage 5: DevOps

Creates the branch, stages all changes, commits with a conventional message, pushes, and opens a pull request via the GitHub CLI.

## HITL checkpoints

- **Tier 2+**: User approves the Architect's plan before builders launch
- **Tier 3+**: User approves the PR before DevOps runs
- **Heal exhaustion**: User decides whether to proceed with broken code
`,
  },

  'architecture-manifest': {
    title: 'Manifest & State',
    body: `# Manifest & State

## The shared manifest

When multiple Builder agents run in parallel, they need to know what each other owns. The manifest solves this. After the Architect finishes, the Foreman builds a manifest that tracks:

- Which files each track owns (write freely)
- Which files siblings own (do not touch)
- What symbols siblings export (import correctly)
- Which files have already been written (patch, don't overwrite)

## Why workflow state, not filesystem

The manifest lives as a workflow instance variable serialised by Temporal. This means it works correctly on distributed workers with no shared filesystem, survives worker restarts, and is updated after each wave so later waves see earlier waves' completed edits.

## Completed edits tracking

After each wave, the Foreman appends every file edit to the manifest. Subsequent builders see this list and know to use \`patch_file\` instead of \`write_file\` on already-written paths, preventing overwrites between parallel agents.
`,
  },

  'agents-foreman': {
    title: 'Foreman',
    body: `# Foreman

The Foreman is the SwarmOrchestrator workflow — the top-level coordinator that runs the entire pipeline.

## Responsibilities

- Classifies task complexity into a tier (0–3) using an LLM call with regex fallback
- Dispatches agents in sequence: PM → Architect → Builders → Inspector → Security → DevOps
- Manages the self-healing loop: tracks heal cycles, invokes Architect re-planning when exhausted
- Holds HITL checkpoints — pauses the workflow and waits for user approval signals before continuing
- Maintains the shared manifest across all builder waves
- Waits up to 24 hours for follow-up prompts after a build completes

## What it does not do

The Foreman does not write code, read files, or call the LLM directly. It is a pure orchestrator — it delegates all reasoning to specialised agents and all I/O to activities.

## Signals

The Foreman accepts two Temporal signals:

- **approve** — resolves a HITL checkpoint (approve/reject the plan or PR)
- **follow_up** — submits a new goal after a build completes, triggering a new pipeline run on the same repo
`,
  },

  'agents-pm': {
    title: 'PM',
    body: `# PM Agent

The Project Manager enriches the user's goal before the Architect sees it.

## What it does

- Reads key repo files (README, package.json, pyproject.toml, existing structure) to understand the project context
- Searches the platform-wide episode store for similar past builds and their outcomes
- Optionally asks the user up to 3 clarifying questions via a HITL checkpoint (Tier ≥ 1)
- Returns an \`enriched_goal\` that includes project context, relevant past learnings, and answers to any clarifying questions

## When it runs

Tier 1, 2, and 3 only. Tier 0 (micro tasks) skip the PM and go directly to the Architect.

## Clarification checkpoint

If the PM determines the goal is ambiguous, it surfaces questions in the UI as an interactive card. The user can answer or skip. The answers are injected into the enriched goal before the Architect plans.

The PM waits up to 48 hours for clarification responses before proceeding with the original goal.
`,
  },

  'agents-architect': {
    title: 'Architect',
    body: `# Architect Agent

The Architect maps the repository and decomposes the goal into a parallel execution plan.

## What it produces

A structured plan with one or more tracks. Each track contains:

- **label** — short identifier (e.g. "backend", "frontend", "tests")
- **implementation_steps** — ordered list of concrete actions for the Builder
- **key_files** — files this track owns exclusively
- **exports** — symbols (functions, classes, types) this track will create for siblings to import
- **depends_on** — track labels that must complete before this one starts
- **test_spec** — test cases the Builder should write first (TDD mode)

## How it works

The Architect reads the repo structure, queries the symbol index for relevant definitions, and searches the episode store for how similar goals were planned in the past. It uses this context to produce a plan that avoids file conflicts and correctly orders dependent work.

## Re-planning

When the Inspector exhausts heal cycles, the Architect is re-invoked with the Inspector's failure findings. It produces a structurally different plan — different file layout, different track decomposition — rather than repeating the approach that failed.
`,
  },

  'agents-builder': {
    title: 'Builder',
    body: `# Builder Agent

The Builder executes a single track from the Architect's plan.

## Tool loop

The Builder runs a Claude tool-use loop. On each turn it can:

- **read_file** / **list_directory** — understand the current state of the repo
- **write_file** / **patch_file** / **str_replace_editor** — create or modify files
- **find_symbol** / **query_repo_index** — locate definitions without reading files blind
- **run_command** — run shell commands (install packages, run scripts)
- **verify_build** — run lint and type-check inline before finishing
- **finish** — signal completion with a summary of what was written

## Manifest awareness

Before starting, the Builder receives the current manifest snapshot. It knows which files it owns, which files siblings own (and must not touch), and what symbols siblings will export (so it can import them correctly even before those files exist).

## Self-verification

Before calling \`finish\`, the Builder runs \`verify_build\` — lint and type-check on the files it modified. If verification fails, it attempts to fix the issues inline before finishing. This reduces Inspector failures on trivial lint errors.
`,
  },

  'agents-inspector': {
    title: 'Inspector',
    body: `# Inspector Agent

The Inspector validates the complete build after all builders finish and drives the self-healing loop.

## What it runs

- Full test suite (\`pytest\`, \`jest\`, or whatever the repo uses)
- Lint (\`ruff\`, \`eslint\`)
- Type checking (\`mypy\`, \`tsc\`)
- Code coverage (when available)

## Heal instructions

When checks fail, the Inspector does not just report errors. It generates **concrete fix instructions** — file-specific, actionable steps that tell the Builder exactly what to change. These instructions are passed back to the Builder for the next heal cycle.

The quality of heal instructions determines how often the first heal cycle fixes the problem. Vague instructions waste cycles; specific ones (which file, which line, what the error means) fix it on the first retry.

## Dependency skipping

If a track failed to produce its output files, the Inspector skips tracks that depended on it rather than running them against a broken state. The heal cycle targets the failed track, not its dependents.
`,
  },

  'agents-security': {
    title: 'Security',
    body: `# Security Agent

The Security agent scans the build output before the PR is opened.

## What it checks

- **Secret detection** — scans all modified files for API keys, tokens, passwords, and other credentials using pattern matching
- **CVE scanning** — checks dependencies (package.json, pyproject.toml, requirements.txt) against known vulnerability databases
- **Insecure patterns** — flags common security anti-patterns: SQL concatenation, hardcoded credentials, insecure random, missing auth guards

## Severity levels

- **Critical / High** — blocks the PR. DevOps will not run until the Security agent's findings are resolved or the user overrides
- **Medium / Low** — surfaced as warnings in the build report but do not block

## When it runs

Tier 2 and 3 only. Tier 0/1 tasks skip Security for speed. Can be enabled for any tier via the Settings panel.
`,
  },

  'agents-devops': {
    title: 'DevOps',
    body: `# DevOps Agent

The DevOps agent handles everything git-related at the end of a successful build.

## What it does

1. Creates a branch named \`{prefix}/{task-id}\` (prefix configurable in Settings)
2. Stages all modified and created files
3. Commits with a conventional commit message summarising the build
4. Pushes the branch to the remote (GitHub)
5. Opens a pull request via the \`gh\` CLI with a description of what was built

## GitHub repo creation

If the project has a GitHub PAT configured but no remote repo exists yet, DevOps creates the GitHub repo automatically before the first push. Works with public and private repos.

## HITL checkpoint (Tier 3)

On Full Crew tier, DevOps pauses before pushing and waits for user approval. The user can review the build report and approve or reject. On approval, DevOps pushes and opens the PR. On rejection, the build is abandoned.

## Required credentials

- \`GH_TOKEN\` or a per-project GitHub PAT (set in Agents → Settings → GitHub)
- The token needs \`repo\` scope (classic PAT) or \`contents: write\` + \`pull_requests: write\` (fine-grained)
`,
  },

  tiers: {
    title: 'Complexity Tiers',
    body: `# Complexity Tiers

Gantry classifies every goal into one of four complexity tiers before dispatching agents. Tier determines which agents run, how many parallel tracks are allowed, how many heal cycles are available, and whether HITL checkpoints fire.

## Tier table

| Tier | Label | Tracks | Heal cycles | Security | PM | HITL |
|------|-------|--------|-------------|----------|----|------|
| 0 | Micro | 1 | 0 | No | No | No |
| 1 | Lightweight | 1 | 1 | No | Yes | No |
| 2 | Standard | 2 | 2 | Yes | Yes | Architect review |
| 3 | Full Crew | 4 | 2 | Yes | Yes | Architect + DevOps |

## Classification

Tier is assigned by a fast LLM call that estimates:

- Number of files likely to change
- Estimated build time in minutes
- Risk flags (touches auth, database schema, public API, etc.)
- Reasoning for the tier assignment

If the LLM call fails, a regex fallback classifies based on keywords in the goal.

## Overriding the tier

Set \`tier=0\` through \`tier=3\` in the task params or via the Settings panel to force a specific tier. Useful for testing or when you know a task is simpler or more complex than the classifier estimates.

## Model routing

- **Tier 0/1** → Claude Haiku (fast, cheap, sufficient for simple tasks)
- **Tier 2/3** → Claude Sonnet (more capable, for complex multi-file work)

Approximately 10× cost reduction on simple tasks compared to always using Sonnet.
`,
  },

  'healing-loop': {
    title: 'Heal Loop',
    body: `# Heal Loop

The heal loop is what makes Gantry self-correcting. It runs between the Inspector and the Builder and retries failed builds with concrete instructions.

## Flow

\`\`\`
Builder writes code
    ↓
verify_build (lint + types inline, in Builder)
    ↓
Inspector runs full test suite
    ↓ fail
Inspector generates heal_instructions
    ↓
Builder re-invoked with instructions (heal cycle 1)
    ↓ fail
Builder re-invoked again (heal cycle 2, if allowed)
    ↓ still failing
Architect re-decomposes with Inspector findings
    ↓ still failing
HITL checkpoint → user decides
\`\`\`

## Heal instructions

The Inspector generates instructions that are specific to the failure:

- Which test failed and why
- Which file and line the error points to
- What the Builder should change (not just what the error is)

Vague instructions ("fix the failing tests") waste cycles. Specific instructions ("in \`src/api/users.py\` line 42, the return type is \`dict\` but the test expects \`UserResponse\` — add the missing \`model_validate\` call") fix it on the first retry.

## Per-track healing

Each track is healed independently. If the backend track fails and the frontend track passes, only the backend Builder is re-invoked. The Inspector does not re-run the frontend.
`,
  },

  'healing-replan': {
    title: 'Architect Re-planning',
    body: `# Architect Re-planning

When heal cycles are exhausted and the build is still failing, the Foreman does not give up — it re-invokes the Architect with the full failure context.

## What triggers re-planning

- All \`max_heal_cycles\` heal cycles have been used
- The Inspector still reports failures
- The Foreman determines a structural fix is needed, not just a code fix

## What the Architect receives

The re-planning prompt includes:

- The original goal
- The Inspector's full findings (which tests failed, which files were problematic)
- A summary of what the previous plan attempted
- The constraint that the new plan must take a structurally different approach

## What changes

The Architect is expected to produce a materially different decomposition: different track boundaries, different file layout, different implementation strategy. Repeating the same plan that already failed is not useful.

## After re-planning

The Foreman runs the new plan through the full Builder → Inspector cycle. If this also fails, a HITL checkpoint fires and the user decides whether to proceed, modify the goal, or abort.
`,
  },

  'healing-snapshots': {
    title: 'Git Snapshots',
    body: `# Git Snapshots

Before each heal cycle begins, the Foreman takes a git snapshot of the current repo state. This ensures a bad heal cannot corrupt a good previous state.

## How it works

1. Before the Builder runs a heal cycle, \`swarm_git_snapshot_save\` commits all current changes to a snapshot branch
2. The Builder writes its heal attempt on top of this snapshot
3. If the heal cycle succeeds, the snapshot branch is abandoned
4. If the heal cycle fails and cycles are exhausted, \`swarm_git_snapshot_restore\` resets to the last known good state before the Architect re-plans

## Why this matters

Without snapshots, a heal cycle that makes things worse leaves the repo in a worse state than before the heal. With snapshots, the worst case is always "back to where we were before the heal attempt."

## Snapshot naming

Snapshots are stored on branches named \`snapshot/{task-id}/cycle-{n}\`. These branches are never pushed to GitHub — they exist only in the local working directory during the build.
`,
  },

  'intelligence-index': {
    title: 'Repo Index',
    body: `# Repo Index

After each build, Gantry builds a symbol index of the entire repository. The index maps every function, class, method, and type to its file path and line number.

## Why it exists

Reading entire files to find a function definition is expensive and wastes context window. A 2000-line file might contain one relevant function. The index lets agents query for exactly what they need without reading anything else.

## How it's built

The \`swarm_build_repo_index\` activity walks the repo and parses Python, TypeScript, and JavaScript files. For each file it extracts:

- Function and method definitions with their line numbers
- Class definitions
- Exported types and interfaces (TypeScript)
- Module-level constants

The index is stored in \`.gantry/index/\` as a JSON file keyed by symbol name.

## When it's used

- **Architect**: queries the index during planning to understand what already exists before deciding what to build
- **Builder**: uses \`find_symbol\` and \`query_repo_index\` before editing a file to locate the exact definition it needs to modify
- **Re-runs**: on follow-up builds, the Architect searches the index instead of re-reading the entire repo from scratch
`,
  },

  'intelligence-symbols': {
    title: 'Symbol Search',
    body: `# Symbol Search

Agents have two tools for querying the repo index:

## find_symbol

Finds a specific named symbol and returns its file path and line number.

\`\`\`
find_symbol("UserService")
→ { file: "src/services/user.py", line: 45, type: "class" }
\`\`\`

Used by Builders before editing — they look up the definition first, then read only the relevant portion of the file.

## query_repo_index

Searches the index by keyword or pattern, returning a list of matches.

\`\`\`
query_repo_index("auth middleware")
→ [
    { symbol: "AuthMiddleware", file: "src/middleware/auth.py", line: 12 },
    { symbol: "require_auth", file: "src/deps.py", line: 34 },
  ]
\`\`\`

Used by the Architect during planning to understand what exists before decomposing work.

## Fallback

If the index has not been built yet (first run on a repo), agents fall back to \`search_filesystem\` — a grep-based search that scans file contents directly. The index is built after the first successful build.
`,
  },

  'intelligence-deps': {
    title: 'Track Dependencies',
    body: `# Track Dependencies

The Architect can declare dependencies between tracks using the \`depends_on\` field. This controls the order in which Builder agents run.

## How it works

Tracks are sorted into waves using topological sort on the \`depends_on\` graph:

- Tracks with no dependencies form wave 0 and run in parallel
- Tracks that depend on wave 0 form wave 1
- Tracks that depend on wave 1 form wave 2
- And so on

Each wave completes before the next begins.

## Example

\`\`\`
backend (no deps)     → wave 0, runs in parallel with infra
infra (no deps)       → wave 0, runs in parallel with backend
frontend (depends_on: [backend])  → wave 1
tests (depends_on: [backend, frontend]) → wave 2
\`\`\`

## Pre-flight conflict resolution

Before builders launch, the Foreman runs a pre-flight check that detects \`key_file\` collisions between tracks in the same wave. If two parallel tracks claim the same file, ownership is assigned to the alphabetically earlier track label — deterministically, without an LLM call.

Resolved conflicts are surfaced as warnings in the activity feed so you can see what was reassigned. The build continues — the conflict is not fatal.

## Circular dependencies

If the Architect produces a circular dependency (A depends on B, B depends on A), the cycle is broken by ignoring one of the offending edges. A warning is logged. The Foreman does not fail — it runs what it can.

## Exports

Alongside \`depends_on\`, the Architect declares what symbols each track will \`export\`. Dependent tracks can import these symbols in their code even before the producing track has run — they know the symbol will exist at the correct path when the build is assembled.
`,
  },

  tdd: {
    title: 'Test-Driven Building',
    body: `# Test-Driven Building

The Architect can include a \`test_spec\` in each track's plan. When present, the Builder writes the tests before writing the implementation.

## test_spec format

The Architect produces a list of test cases:

\`\`\`json
{
  "test_spec": [
    "UserService.create_user returns a User object with the correct email",
    "UserService.create_user raises ValueError on duplicate email",
    "GET /users/:id returns 404 when user does not exist",
    "GET /users/:id returns the user object when it exists"
  ]
}
\`\`\`

## Builder behaviour in TDD mode

1. Write the test file first, implementing the test cases from \`test_spec\`
2. Run the tests — they should fail (the implementation does not exist yet)
3. Write the implementation until the tests pass
4. Call \`verify_build\` to confirm lint and type checks pass
5. Finish

## Why TDD

Tests written before the implementation are less likely to be written to pass a specific implementation and more likely to specify correct behaviour. They also give the Inspector a concrete baseline: if the Builder's tests pass but a different test fails, the Inspector's heal instructions can be precise about what contract was broken.

## When it applies

TDD mode is used when the Architect includes a \`test_spec\`. The Architect decides whether TDD is appropriate based on the task — it tends to include test specs for API endpoints, service classes, and business logic, but not for configuration files or UI scaffolding.
`,
  },

  'memory-facts': {
    title: 'Facts Store',
    body: `# Facts Store

The facts store is a persistent key-value store that agents write to during a build and read from at the start of subsequent builds.

## Location

\`.gantry/memory/facts.json\` in the project directory.

## What gets stored

- **Tech stack decisions** — "this project uses PostgreSQL, not SQLite" (written by Architect)
- **Known failure patterns** — "importing from \`utils/\` fails in tests due to missing \`__init__.py\`" (written by Builder after a heal cycle)
- **Project conventions** — "all API routes use \`snake_case\` for JSON fields" (written by PM)
- **Build constraints** — "do not modify \`legacy/\` — it is excluded from CI" (written by Architect)

## Namespacing

Facts are keyed with a namespace prefix:

- \`arch.*\` — Architect facts (tech stack, constraints)
- \`pm.*\` — PM facts (conventions, stakeholder notes)
- \`builder.*\` — Builder facts (failure patterns, workarounds)

## Expiry

Facts with \`arch.\` or \`pm.\` prefixes expire after 90 days — tech stack decisions don't change often, but the store should not accumulate stale assumptions indefinitely. Builder facts expire after 30 days.
`,
  },

  'memory-episodes': {
    title: 'Episodic Memory',
    body: `# Episodic Memory

Episodic memory records one entry per completed build. The Architect searches this store before planning any new build — past successes and failures directly inform how the next build is planned.

## Two levels of storage

**Per-repo** (\`.gantry/memory/episodes.jsonl\`)
History for this specific repository. The Architect searches here first. A project's own history has the highest relevance — the same files, the same conventions, the same failure patterns.

**Platform-wide** (\`~/.gantry/episodes.jsonl\`)
History across every repo ever built on this machine. A new React project benefits from every prior React build — what track decompositions worked, what failed, what quality scores were achieved. Same-repo episodes are boosted in ranking so local context still wins ties.

## What each episode contains

- Goal text
- Tier assigned
- Track decomposition (what the Architect planned)
- Which tracks succeeded and which failed
- Heal cycles used
- Quality score (0–10, assessed by LLM after build)
- PR URL if the build shipped

## How it's used

Before planning, the Architect searches both stores for episodes with similar goals. The top matches are included in the planning prompt. The Architect learns: "last time I planned a feature like this, I split it into a backend and a frontend track — that worked well" or "last time I tried to write tests in the same track as the implementation, the Inspector failed — split them next time."

The more builds run, the better every future Architect gets.
`,
  },



  configuration: {
    title: 'Configuration',
    body: `# Configuration

All swarm parameters are configurable via **Agents → Settings** in the UI or through environment variables.

## Settings panel options

| Setting | Default | Description |
|---------|---------|-------------|
| Branch prefix | \`swarm\` | Git branches are named \`prefix/task-id\` |
| Max parallel tracks | 4 | Maximum concurrent Builder agents per wave |
| Max heal cycles | 3 | Inspector → Builder retry limit before escalating |
| Tier override | Auto | Force a specific complexity tier (0–3) |
| GitHub PAT | — | Personal Access Token for clone and push |

## Environment variables

Set these in \`.env\` at the project root:

- \`ANTHROPIC_API_KEY\` — required
- \`GH_TOKEN\` — GitHub PAT for clone and push (can also be set per-project in the UI)
- \`BRAVE_SEARCH_API_KEY\` — enables web search in Builder agents
- \`CLAUDE_MODEL\` — override the default Sonnet model
- \`CLAUDE_HAIKU_MODEL\` — override the default Haiku model for Tier 0/1
- \`MAX_AGENT_TURNS\` — maximum tool-use turns per agent (default: 24)
- \`TEMPORAL_ADDRESS\` — Temporal server address (default: localhost:7233)
- \`GANTRY_UI_URL\` — UI base URL for worker callbacks (default: http://localhost:3000)

## GitHub integration

1. Go to **Agents → Settings → GitHub** and paste a Personal Access Token
2. Classic PAT: needs \`repo\` scope
3. Fine-grained PAT: needs \`contents: write\` + \`pull_requests: write\`
4. The token is stored in your browser only and passed to the worker as a task param
`,
  },

  local: {
    title: 'Running Locally',
    body: `# Running Locally

## Prerequisites

- Python 3.12+ and [uv](https://github.com/astral-sh/uv)
- Node.js 20+
- Docker Desktop (for the Agentex platform)
- Temporal CLI — \`brew install temporal\`

## Setup

Copy the environment file and fill in your API key:

\`\`\`
cp .env.example .env
\`\`\`

Required: \`ANTHROPIC_API_KEY\`

Optional: \`GH_TOKEN\` (GitHub clone + push), \`BRAVE_SEARCH_API_KEY\` (web search)

Install dependencies:

\`\`\`
uv sync
cd ui && npm install
\`\`\`

## Starting everything

\`\`\`
./dev.sh
\`\`\`

This starts in order:

1. Agentex platform via Docker Compose (if not already running)
2. Temporal dev server on :7233 (if Docker Temporal is not running)
3. Gantry worker — ACP server on :8000 + Temporal worker
4. Gantry API on :8001
5. Next.js UI on :3000

## Service URLs

- \`http://localhost:3000\` — Gantry UI
- \`http://localhost:8001\` — Gantry REST API
- \`http://localhost:8001/docs\` — API documentation (Swagger)
- \`http://localhost:5003/swagger\` — Agentex API
- \`http://localhost:8080\` — Temporal UI

## Stopping

\`\`\`
./dev.sh --stop
\`\`\`

## Logs

\`\`\`
tail -f /tmp/gantry-agent.log
tail -f /tmp/gantry-api.log
tail -f /tmp/gantry-ui.log
tail -f /tmp/temporal-dev.log
\`\`\`

## Mock mode

Run without Playwright or Tavily (no browser, no search):

\`\`\`
./dev.sh --mock
\`\`\`
`,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function DocsPage() {
  const [activeSlug, setActiveSlug] = useState('introduction');
  const doc = DOCS[activeSlug] ?? DOCS['introduction'];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left nav */}
      <nav style={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
        overflowY: 'auto', padding: '1.5rem 0.75rem',
        background: 'var(--surface)',
      }}>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text-secondary)',
          padding: '0 0.5rem', marginBottom: '0.75rem',
        }}>
          Documentation
        </p>
        {DOC_TREE.map(section => (
          <div key={section.slug} style={{ marginBottom: '0.25rem' }}>
            <button
              onClick={() => { if (!section.children) setActiveSlug(section.slug); }}
              style={{
                width: '100%', textAlign: 'left', border: 'none',
                padding: '0.35rem 0.5rem', borderRadius: '6px', cursor: 'pointer',
                fontSize: '0.8375rem', fontWeight: section.children ? 600 : 400,
                color: activeSlug === section.slug ? 'var(--accent)' : 'var(--text-primary)',
                fontFamily: 'inherit',
                background: activeSlug === section.slug ? 'var(--surface-raised)' : 'transparent',
              } as React.CSSProperties}
            >
              {section.title}
            </button>
            {section.children && (
              <div style={{ paddingLeft: '0.75rem', marginTop: '0.125rem' }}>
                {section.children.map(child => (
                  <button
                    key={child.slug}
                    onClick={() => setActiveSlug(child.slug)}
                    style={{
                      width: '100%', textAlign: 'left', border: 'none',
                      padding: '0.3rem 0.5rem', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '0.8125rem', fontFamily: 'inherit',
                      color: activeSlug === child.slug ? 'var(--accent)' : 'var(--text-secondary)',
                      background: activeSlug === child.slug ? 'var(--surface-raised)' : 'transparent',
                      fontWeight: activeSlug === child.slug ? 500 : 400,
                    } as React.CSSProperties}
                  >
                    {child.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '2.5rem 3rem', maxWidth: 760 }}>
        <article style={{ fontSize: '0.9rem', lineHeight: 1.75, color: 'var(--text-primary)' }}>
          <DocBody body={doc.body} />
        </article>
      </main>
    </div>
  );
}

function DocBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let k = 0; // independent key counter — never reuses a value regardless of how i moves

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={k++} style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem', marginTop: 0 }}>
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={k++} style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.01em', marginTop: '2rem', marginBottom: '0.5rem', paddingBottom: '0.375rem', borderBottom: '1px solid var(--border)' }}>
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={k++} style={{ fontSize: '1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.375rem' }}>
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={k++} style={{
          background: 'var(--surface-raised)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '1rem 1.25rem', overflowX: 'auto',
          fontSize: '0.8125rem', lineHeight: 1.6, margin: '1rem 0',
          fontFamily: 'monospace',
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
    } else if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={k++} style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: '0.25rem' }}>{inlineFormat(item)}</li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === '') {
      elements.push(<div key={k++} style={{ height: '0.5rem' }} />);
    } else {
      elements.push(
        <p key={k++} style={{ margin: '0.5rem 0' }}>{inlineFormat(line)}</p>
      );
    }
    i++;
  }

  return <>{elements}</>;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} style={{ fontFamily: 'monospace', fontSize: '0.85em', background: 'var(--surface-raised)', padding: '0.1em 0.35em', borderRadius: '4px', border: '1px solid var(--border)' }}>{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </>
  );
}
