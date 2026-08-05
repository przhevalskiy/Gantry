# Gantry — Product Thesis

## What it is

Gantry is an asynchronous software engineering factory. You describe a task in plain language. A crew of specialized AI agents plans it, writes the code in parallel across independent tracks, runs tests, heals failures automatically, reviews for logic correctness, scans for security issues, and opens a pull request on your GitHub repo — while you do something else.

Submit 1 task or 1000. Each is an independent pipeline. An engineering team can put an entire sprint's backlog in on Monday morning and spend the week reviewing PRs instead of writing boilerplate.

---

## What it is not

**Not a pair programmer.** Gantry is not Cursor, GitHub Copilot, or Claude Code. Those tools are synchronous — they require an engineer present, guiding, correcting, prompting the next step. The bottleneck is human attention. Gantry is asynchronous. You write the goal. You review the PR. Everything in between is the factory's problem.

Claude Code is for an engineer who wants to move faster right now, in the flow of current work. Gantry is for a tech lead who has 20 tickets in the backlog and wants 15 of them drafted by tomorrow without assigning them to anyone. One is a power tool. The other is a factory floor.

**Not a chat interface.** There is no conversation. Gantry takes a goal, runs a full engineering pipeline, and delivers a branch with a PR. It only stops and waits for you at explicit approval checkpoints on complex tasks.

**Not a wrapper around an LLM.** A single LLM call does not build software. What does is the orchestration — parallel execution across independent tracks, structured handoffs between specialized roles, a self-healing loop that retries failures with concrete fix instructions, and durable state that survives crashes and restarts. The LLM is a component. The factory is the product.

---

## The Core Pattern

```
Goal (plain language)
  ↓
PM — enriches, asks clarifying questions
  ↓
Architect — maps the repo, decomposes into parallel tracks
  ↓
Builders — write code simultaneously across tracks
  ↓
Inspector — runs tests, lint, type-check; generates heal instructions on failure
  ↓    ↑ (heal loop, up to N cycles)
Reviewer — reads the full diff, checks logic correctness and edge cases
  ↓
Security — scans for secrets, CVEs, insecure patterns
  ↓
DevOps — branches, commits, pushes, opens PR
```

Each role is a separate agent with its own toolset, context window, and model. They do not share memory mid-build — they hand off structured artifacts. The Reviewer checks logic correctness. The Inspector verifies test output. The Architect decomposes before building. Roles are not interchangeable.

---

## Why it works

Engineering backlogs are full of well-scoped tasks that keep getting deprioritized — not because they're hard, but because they take 4–8 hours of mechanical execution that nobody has time to start. Features that touch multiple files across the stack. Scaffolding a new integration from a spec. Applying a consistent change (logging, auth guards, error handling) across many files. Greenfield modules where the architecture is clear and execution is the bottleneck.

Gantry handles the execution layer. The human handles the goal and the review. Everything in between — plan, write, test, heal, review, commit — runs without supervision.

The self-healing loop is what makes this reliable rather than aspirational. When the Inspector finds a failure, it generates concrete fix instructions and re-invokes the Builder. When the Reviewer finds a logic bug, it converts review comments into heal instructions and re-enters the same cycle. Each heal cycle starts from a git snapshot. A bad heal cannot corrupt a good previous state. The swarm only escalates to you after exhausting every automated recovery path.

---

## Architecture

### Pipeline (the factory floor)

| # | Agent | Role | Key Tools | Model |
|---|---|---|---|---|
| — | **Foreman** | Orchestrates the pipeline, manages heal loops, HITL checkpoints | — | — |
| 1 | **PM** | Enriches the goal, asks clarifying questions, fetches external context | `fetch_url`, `memory_read`, `web_search` | Sonnet / Haiku |
| 2 | **Architect** | Maps the repo, decomposes into parallel tracks, probes the web for unfamiliar APIs | `list_directory`, `read_file`, `find_symbol`, `web_search`, `run_command` | Sonnet |
| 3 | **Builder** | Writes code, self-verifies with lint + type-check, navigates via symbol index | `write_file`, `edit_file`, `find_symbol`, `run_command`, `verify_build` | Sonnet / Haiku |
| 4 | **Inspector** | Runs tests, lint, type-check, coverage; generates precise heal instructions | `run_tests`, `run_lint`, `run_type_check`, `run_coverage` | Sonnet / Haiku |
| 5 | **Reviewer** | Reads the full diff, checks logic correctness, edge cases, API contracts | `git_diff`, `read_file`, `find_symbol`, `report_review` | Sonnet |
| 6 | **Security** | Scans for secrets, CVEs, insecure patterns; blocks PR on critical findings | `scan_secrets`, `scan_dependencies`, `run_sast` | Haiku |
| 7 | **DevOps** | Branches, commits, pushes, opens PR, optionally runs migrations and deploys | `git_add`, `git_commit`, `git_push`, `create_pull_request` | Haiku |

### Complexity Tiers

Gantry classifies every goal before dispatching agents:

| Tier | Label | Parallel Tracks | Heal Cycles | Reviewer | Security | Human Checkpoints |
|---|---|---|---|---|---|---|
| 0 | Micro | 1 | 0 | ✗ | ✗ | None |
| 1 | Lightweight | 1 | 1 | ✗ | ✗ | None |
| 2 | Standard | 2 | 2 | ✓ | ✓ | Architect plan |
| 3 | Full Crew | 4 | 2 | ✓ | ✓ | Architect plan + DevOps |

### Self-Healing Loop

```
Builder writes code
    ↓
verify_build (lint + types inline)
    ↓
Inspector runs full test suite
    ↓ fail
heal_instructions → Builder (up to max_heal_cycles)
    ↓ pass
Reviewer reads diff — checks logic, edge cases, API contracts
    ↓ request_changes
reviewer comments → heal_instructions → Builder (re-enters loop)
    ↓ approve
Security scan → DevOps → PR
```

If the original plan was structurally wrong, the Architect re-decomposes before burning more heal cycles.

### Durability

Every agent is a Temporal child workflow. Every file write, LLM call, and shell command is a retryable activity. Crashes replay from the last checkpoint. Close your laptop mid-build — the pipeline continues when the worker comes back. Nothing is lost.

### Code Awareness

After each build, a symbol index maps every function, class, and type to its file and line number. Builders query the index instead of reading files blind. The Architect uses it to plan on re-runs. This is what makes multi-file edits reliable — agents know where things are before they touch them.

### Memory

- **Facts store** (`.gantry/memory/facts.json`) — key/value facts written by any agent. Tech stack decisions, known failure patterns, deployment notes. Persists across builds.
- **Episodic memory** — one record per completed build at two levels: per-repo and platform-wide. Before planning, the Architect searches the platform-wide store. A new React project gets the learning from every prior React build ever run on that machine. Same-repo episodes are boosted in ranking.

---

## Infrastructure Stack

| Layer | Technology |
|---|---|
| Workflow orchestration | Temporal (durable, retryable, crash-safe) |
| Agent hosting | Scale Agentex (ACP protocol) |
| AI (primary) | Anthropic Claude — `claude-sonnet-4-6` (Tier 2/3), `claude-haiku-4-5` (Tier 0/1) |
| Backend API | FastAPI (`:8001`) with Swagger at `/docs` |
| Frontend | Next.js / React 19, TanStack Query, Zustand |
| GitHub integration | `gh` CLI + Personal Access Token, auto-creates remote if none exists |
| SDKs | Python (`gantry-sdk`) and TypeScript (`@gantry/sdk`) |

---

## Use Cases

### Handles well
- Features that touch multiple files across the stack (API + UI + tests + config)
- Scaffolding a new service, module, or integration from a spec
- Applying a consistent change across many files — logging, tracing, auth guards, error handling
- Greenfield projects where the architecture is clear and execution is the bottleneck
- Backlog tickets that are well-scoped but keep getting deprioritized
- Batch execution — submit an entire sprint, get PRs back in parallel

### Does not handle well
- Exploratory debugging ("why is this flaky test failing in CI?")
- Architecture decisions that require human judgment mid-task
- Tasks with ambiguous requirements that need iteration to discover
- Anything that requires a conversation to define

---

## Competitive Position

| Tool | Model | Paradigm |
|---|---|---|
| **Cursor / GitHub Copilot / Claude Code** | Synchronous, human-in-the-loop | Power tool: engineer moves faster |
| **Devin** | Autonomous, long-horizon | One agent, one task, full autonomy |
| **Gantry** | Asynchronous, multi-agent, parallel | Factory: batch execution, human reviews PRs |

Gantry's position is not "a better Cursor." It is structurally different: synchronous tools require the engineer to be present. Gantry requires the engineer to write a clear goal and review a PR. The backlog drains while the engineer does something else.

The multi-agent parallel architecture (Architect decomposes → Builders run simultaneously → Inspector heals → Reviewer checks) is what makes it faster than a single-agent approach on complex tasks. A full-stack feature that would take one agent 45 minutes sequentially takes ~15 in parallel.

---

## Honest Constraints

**Requires well-scoped goals.** Gantry cannot discover requirements through iteration. The goal must be specific enough that an Architect can decompose it into parallel tracks without asking. Ambiguous tasks produce ambiguous PRs.

**Does not replace code review.** The Reviewer checks logic correctness and edge cases, but it cannot validate business context, user intent, or product decisions. The human PR review remains essential.

**Rate limits bound throughput.** At scale, LLM rate limits and GitHub API throughput are the ceiling. Both are horizontally scalable by adding workers and cycling API keys.

**No IDE integration.** Gantry is async by design. Engineers who want synchronous, in-flow assistance should use Cursor. These are not competing for the same moment.

---

## Possible Pivots

### 1. CI-triggered autonomous backlog drain
Connect Gantry to a GitHub project board or Linear. When a ticket is marked "ready," Gantry automatically picks it up, runs the pipeline, and opens a PR — no human submission required. The engineering team wakes up to PRs in the queue every morning.

### 2. Multi-repo orchestration
One task that spans multiple repositories — a backend API change + a frontend change + an infrastructure update — decomposed by an Architect that understands cross-repo dependencies and coordinates multiple Builder crews.

### 3. Migration factory
Specialized playbooks for common large-scale migrations: Python 2 → 3, React class components → hooks, REST → GraphQL, monolith → microservices. Apply a migration across an entire codebase in parallel tracks. The Architect identifies files, the Builders transform them, the Inspector verifies no regressions.

### 4. Developer platform / API-first
Expose Gantry purely as a REST API + SDKs. Engineering platforms teams use it as infrastructure — wire it into their internal developer portal, CI system, or ticketing tool. Revenue is API usage, not seats.

### 5. Specialized agent profiles
Domain-specific Builder variants: a database Builder that knows migration safety patterns, a React Builder that enforces component standards, a security Builder that writes hardened code by default. Architects route tracks to the right specialist rather than using a general Builder.

### 6. Cost-optimized junior task offloading
Tier 0 and Tier 1 tasks (micro fixes, simple scripts) run on Haiku at ~10x lower cost than Sonnet. A senior engineer submits every trivial ticket — typo fixes, config updates, test additions, simple CRUD endpoints — to Gantry and never touches them. Only reviews the PR. The cognitive savings compound across a team.

---

## The One-Sentence Version

Gantry is the async engineering crew that drains your backlog while you sleep — it takes a goal, plans it, builds it in parallel, heals its own failures, and hands you a pull request.
