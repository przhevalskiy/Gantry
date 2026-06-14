# Gantry

**Submit a task. Walk away. Come back to a pull request.**

Gantry is a software engineering factory. You describe what needs to be built. A crew of specialised agents plans it, writes it in parallel across independent tracks, tests it, reviews the logic, heals failures automatically, and opens a PR on your GitHub repo — while you do something else.

Submit 1 task or 1000. Each is an independent pipeline. An engineering team can put an entire sprint's backlog in on Monday morning and spend the week reviewing PRs instead of writing boilerplate.

---

## What this is not

**Not a pair programmer.** Gantry is not Cursor, GitHub Copilot, or Claude Code. Those tools are synchronous — they require an engineer present, guiding, correcting, prompting the next step. The bottleneck is human attention. Gantry is asynchronous. The pipeline runs without you. You write the goal. You review the PR. Everything in between is the factory's problem.

Claude Code is for an engineer who wants to move faster right now, in the flow of their current work. Gantry is for a tech lead who has 20 tickets in the backlog and wants 15 of them drafted by tomorrow without assigning them to anyone. One is a power tool. The other is a factory floor. Nobody says a factory is a slower version of a craftsman's workshop. They are not competing. One makes one chair at a time, beautifully, with full attention. The other makes a thousand chairs while the craftsman sleeps.

**Not a chat interface.** There is no conversation. You give Gantry a goal, it runs a full engineering pipeline, and it delivers a branch with a pull request. The only time it stops and waits for you is at explicit approval checkpoints on complex tasks — reviewing the build plan before builders launch, or confirming a deployment. Otherwise it runs to completion without you.

**Not a wrapper around an LLM.** A single LLM call does not build software. What does is the orchestration — parallel execution across independent tracks, structured handoffs between specialised roles, a self-healing loop that retries failures with concrete fix instructions, and durable state that survives crashes and restarts. The LLM is a component. The factory is the product.

---

## The construction crew

Think of Gantry as a silicon construction crew — a non-contested engineering team that works in parallel, never argues about scope, and hands you a PR when the job is done.

Each role in the pipeline is a specialised agent with its own toolset, context window, and model. They do not share memory mid-build — they hand off structured artifacts. The Architect produces a plan. The Builders execute tracks from that plan simultaneously. The Inspector verifies and generates precise fix instructions. The Reviewer checks logic correctness before the branch is staged. The crew does not need to be managed. It needs to be assigned.

A construction project does not have one worker who designs the building, pours concrete, frames walls, runs electrical, and inspects the work. It has a crew with defined roles running in parallel, coordinated by a foreman. That is the model.

**At scale:** each task is an independent Temporal workflow with no shared state between runs. The only limits are worker capacity, LLM rate limits, and GitHub API throughput — all horizontally scalable. 1000 tasks in, 1000 PRs out.

---

## Who it is for

Engineering teams with a backlog of well-scoped tasks that keep getting deprioritised. Features that are clear enough to implement but take 4–8 hours of mechanical execution. The kind of work your team knows exactly how to do but hasn't had time to start.

**Gantry handles well:**
- Features that touch multiple files across the stack (API + UI + tests + config)
- Scaffolding a new service, module, or integration from a spec
- Applying a consistent change across many files — logging, tracing, auth guards, error handling
- Greenfield projects where the architecture is clear and execution is the bottleneck

**Gantry does not handle well:**
- Exploratory debugging ("why is this flaky test failing in CI?")
- Architecture decisions that require human judgment mid-task
- Tasks with ambiguous requirements that need iteration to discover
- Anything that requires a conversation to define

---

## What it does

Gantry takes a natural language goal and runs it through a structured pipeline:

```
PM → Architect → Builders (parallel) → Inspector ↺ → Reviewer → Security → DevOps
```

Each stage is a separate agent with a focused toolset. The Architect decomposes the goal into independent tracks. Multiple Builder agents write code simultaneously. The Inspector runs tests and lint, triggering self-healing cycles if anything fails. The Reviewer reads the full diff and checks logic correctness, edge cases, and API contracts — flagging real bugs before they reach staging. Security scans for secrets and CVEs. DevOps branches, commits, pushes, and opens a PR.

On Standard and Full Crew tiers, the pipeline pauses at key decisions — build plan review before builders launch, deployment approval before the PR is opened — and waits for your explicit sign-off via an inline approval card in the UI. Approve, reject, or enable auto-approve to let it run unattended.

If you point Gantry at a local directory that has no GitHub remote, it creates the GitHub repo automatically before the first push.

The whole pipeline is a [Temporal](https://temporal.io) workflow. Close your laptop mid-build — it continues when the worker comes back.

---

## What makes it different

**Parallel by design.** The Architect splits work into independent tracks (frontend, backend, tests, infra). Builders run simultaneously. A full-stack feature that would take one agent 45 minutes sequentially takes 15 in parallel.

**Self-correcting.** When the Inspector finds failures, it generates concrete fix instructions and re-invokes the Builder. When the Reviewer finds logic bugs, it converts review comments into heal instructions and re-enters the same cycle — fresh code, fresh tests, fresh review. If the original plan was structurally wrong, the Architect re-decomposes before burning heal cycles. The swarm escalates to you only after exhausting every automated recovery path.

**Code-aware.** After each build, a symbol index maps every function, class, and type to its file and line number. Agents query the index instead of reading files blind. Builders use it to locate definitions before editing. The Architect uses it to plan on re-runs.

**GitHub-native.** Connect a GitHub repo by URL, or point at a local directory and Gantry creates the remote repo for you. Builds on the repo and pushes a branch with a PR. Works with public and private repos via a Personal Access Token.

**Durable.** Every agent is a Temporal child workflow. Every file write, LLM call, and shell command is a retryable activity. Crashes replay from the last checkpoint. Nothing is lost.

---

## The crew

| # | Agent | Role | Key Tools | Model |
|---|---|---|---|---|
| — | **Foreman** | Orchestrates the pipeline, manages heal loops, HITL checkpoints | — | — |
| 1 | **PM** | Enriches the goal, asks clarifying questions (tier ≥ 1), fetches external context | `fetch_url`, `memory_read`, `web_search` | Sonnet / Haiku |
| 2 | **Architect** | Maps the repo, decomposes into parallel tracks, probes the web for unfamiliar APIs | `list_directory`, `read_file`, `find_symbol`, `web_search`, `fetch_url`, `run_command` | Sonnet |
| 3 | **Builder** | Writes code, self-verifies with lint + type-check, navigates the codebase via symbol index | `write_file`, `edit_file`, `find_symbol`, `run_command`, `list_directory`, `verify_build` | Sonnet / Haiku |
| 4 | **Inspector** | Runs tests, lint, type-check, coverage; generates precise heal instructions | `run_tests`, `run_lint`, `run_type_check`, `run_coverage`, `list_directory`, `search_files`, `read_file` | Sonnet / Haiku |
| 5 | **Reviewer** | Reads the full diff, checks logic correctness, edge cases, API contracts | `git_diff`, `read_file`, `search_files`, `find_symbol`, `report_review` | Sonnet |
| 6 | **Security** | Scans for secrets, CVEs, insecure patterns; blocks PR on critical findings | `scan_secrets`, `scan_dependencies`, `run_sast`, `git_diff`, `search_files` | Haiku |
| 7 | **DevOps** | Branches, commits, pushes, opens PR, optionally runs migrations and deploys | `git_add`, `git_commit`, `git_push`, `create_pull_request`, `run_migration`, `deploy`, `memory_read`, `memory_write` | Haiku |

Model routing is automatic: Haiku (`claude-haiku-4-5-20251001`) for Tier 0/1 tasks (micro fixes, simple scripts), Sonnet (`claude-sonnet-4-6`) for Tier 2/3 (features, full-stack builds). ~10x cost reduction on simple tasks.

---

## Complexity tiers

Gantry classifies every goal using a fast LLM call before dispatching agents:

| Tier | Label | Tracks | Heal cycles | Reviewer | Security | HITL |
|---|---|---|---|---|---|---|
| 0 | Micro | 1 | 0 | ✗ | ✗ | ✗ |
| 1 | Lightweight | 1 | 1 | ✗ | ✗ | ✗ |
| 2 | Standard | 2 | 2 | ✓ | ✓ | Architect review |
| 3 | Full Crew | 4 | 2 | ✓ | ✓ | Architect + DevOps |

Override with `tier=0–3` in the task params or via the Settings panel.

---

## Self-healing loop

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
Security scan
    ↓
DevOps — branch, commit, push, PR
```

Each heal cycle starts from a git snapshot taken before the cycle began. A bad heal can't corrupt a good previous state. The Reviewer only flags real logic bugs — not style, formatting, or naming — to avoid wasting heal cycles on cosmetic issues.

If the original plan was structurally wrong, the Architect re-decomposes with Inspector findings before burning more heal cycles. The swarm escalates to you only after exhausting every automated recovery path.

---

## REST API

Gantry exposes a FastAPI server on `:8001` for programmatic access and webhook integrations.

```
http://localhost:8001/docs    Swagger UI
http://localhost:8001/redoc   ReDoc
```

**Key endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/tasks` | Submit a new build task |
| `GET` | `/tasks/{task_id}` | Poll task status and build report |
| `GET` | `/tasks/{task_id}/messages` | Stream agent messages (SSE) |
| `POST` | `/tasks/{task_id}/signal` | Send HITL approval / rejection signal |
| `DELETE` | `/tasks/{task_id}` | Terminate a running workflow |
| `GET` | `/projects` | List projects |
| `POST` | `/projects` | Create a project |
| `GET` | `/projects/{project_id}/memory` | Facts + recent episodes for a project |
| `GET` | `/traces/{task_id}` | Retrieve structured agent traces |
| `POST` | `/webhooks/github` | GitHub webhook receiver |

Authentication uses a bearer token configured in `.env` as `GANTRY_API_KEY`. The Swagger docs at `/docs` include a live "Authorize" button.

---

## SDKs

### Python

```bash
pip install gantry-sdk
```

```python
from gantry import GantryClient

client = GantryClient(api_key="...", base_url="http://localhost:8001")
task = client.tasks.create(goal="Add rate limiting to /api/users", project_id="proj_abc")
result = client.tasks.wait(task.id)
print(result.pr_url)
```

Source: [`sdk/python/`](sdk/python/)

### TypeScript / Node.js

```bash
npm install @gantry/sdk
```

```typescript
import { GantryClient } from "@gantry/sdk";

const client = new GantryClient({ apiKey: "...", baseUrl: "http://localhost:8001" });
const task = await client.tasks.create({ goal: "Add rate limiting to /api/users", projectId: "proj_abc" });
const result = await client.tasks.wait(task.id);
console.log(result.prUrl);
```

Source: [`sdk/typescript/`](sdk/typescript/)

---

## Stack

**Backend**
- [Scale Agentex](https://github.com/scaleapi/scale-agentex) — agent hosting, ACP protocol, message streaming
- [Temporal](https://temporal.io) — durable workflow orchestration, activity retries, child workflows
- [FastAPI](https://fastapi.tiangolo.com) — REST API server with Swagger docs
- [Anthropic Claude](https://anthropic.com) (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) — all LLM reasoning
- Python 3.12 / [uv](https://github.com/astral-sh/uv)

**Frontend**
- [Next.js](https://nextjs.org) / React 19
- [TanStack Query](https://tanstack.com/query)
- [Zustand](https://zustand-demo.pmnd.rs)

---

## Project structure

```
Gantry/
├── activities/
│   ├── _shared.py                       # base types and shared helpers
│   ├── file_activities.py               # read, write, patch, delete, list
│   ├── shell_activities.py              # run_command, run_tests, lint, type-check, coverage
│   ├── git_activities.py                # git init, diff, commit, branch, push
│   ├── github_activities.py             # repo creation, PR open via gh CLI
│   ├── web_activities.py                # fetch_url, brave search
│   ├── security_activities.py           # secret scan, CVE lookup
│   ├── index_activities.py              # symbol index build + query
│   ├── manifest_activities.py           # Agentex manifest generation
│   ├── swarm_activities.py              # backward-compat re-export shim
│   ├── memory_activities.py             # facts store + episodic memory
│   ├── classify_tier_activity.py        # LLM-based complexity classification
│   ├── quality_score_activity.py        # LLM build quality scoring (0–10)
│   ├── trace_activity.py                # structured agent trace recording
│   ├── builder_planner_activity.py
│   ├── architect_planner_activity.py
│   ├── inspector_planner_activity.py
│   ├── reviewer_planner_activity.py     # ← new: Reviewer tool-use loop
│   ├── security_planner_activity.py
│   ├── devops_planner_activity.py
│   └── pm_planner_activity.py
│
├── workflows/
│   ├── swarm_orchestrator.py            # Foreman — top-level pipeline, HITL checkpoints
│   ├── architect_agent.py               # pre-loads PM memory before planning
│   ├── builder_agent.py
│   ├── inspector_agent.py               # self-healing loop, dependency-skip logic
│   ├── reviewer_agent.py                # ← new: logic review, approve/request_changes
│   ├── security_agent.py
│   ├── devops_agent.py
│   └── pm_agent.py
│
├── project/
│   ├── config.py                        # env vars, model constants, GH_TOKEN
│   ├── child_workflow.py                # ApprovalWorkflow — durable HITL signal handler
│   ├── planner.py                       # Claude tool-use loop, context management
│   ├── complexity.py                    # tier params + regex fallback
│   ├── architect_tools.py
│   ├── builder_tools.py                 # verify_build, find_symbol, query_index
│   ├── inspector_tools.py               # run_coverage, list_directory, search_files
│   ├── reviewer_tools.py                # ← new: git_diff, read_file, report_review
│   ├── devops_tools.py                  # memory_write, run_migration, deploy
│   ├── security_tools.py                # git_diff, search_files, scan_dependencies
│   ├── pm_tools.py                      # fetch_url, memory_read
│   ├── memory_tools.py
│   ├── run_worker.py                    # Temporal worker entrypoint
│   └── acp.py                           # Agentex ACP server
│
├── api/                                 # ← new: Gantry REST API (:8001)
│   ├── main.py                          # FastAPI app, CORS, router mounting
│   ├── config.py                        # API env vars, GANTRY_API_KEY
│   ├── auth.py                          # bearer token middleware
│   ├── deps.py                          # shared FastAPI dependencies
│   ├── temporal_client.py               # Temporal gRPC client wrapper
│   ├── agentex_client.py                # Agentex message streaming client
│   ├── github_client.py                 # GitHub API proxy helpers
│   ├── poller.py                        # SSE task message streamer
│   ├── webhooks.py                      # GitHub webhook receiver
│   ├── routes/
│   │   ├── tasks.py                     # POST /tasks, GET /tasks/{id}
│   │   ├── projects.py                  # project CRUD
│   │   ├── keys.py                      # API key management
│   │   ├── github.py                    # GitHub repo proxy
│   │   └── internal.py                  # health + metrics
│   └── store/                           # lightweight in-process state store
│
├── sdk/                                 # ← new: client SDKs
│   ├── python/                          # pip install gantry-sdk
│   │   ├── gantry/
│   │   │   ├── client.py
│   │   │   ├── resources.py
│   │   │   └── types.py
│   │   └── pyproject.toml
│   └── typescript/                      # npm install @gantry/sdk
│       ├── src/
│       │   ├── index.ts
│       │   ├── http.ts
│       │   ├── resources.ts
│       │   └── types.ts
│       └── package.json
│
├── deploy/                              # ← new: production deployment
│   ├── docker-compose.prod.yml
│   ├── nginx.conf
│   ├── gantry-api.service               # systemd unit for API
│   ├── gantry-worker.service            # systemd unit for Temporal worker
│   └── setup.sh                         # one-shot server provisioning
│
├── ui/                                  # Next.js frontend
│   ├── app/
│   │   ├── page.tsx                     # home / search
│   │   ├── task/[taskId]/               # live build view
│   │   ├── projects/                    # project dashboard
│   │   ├── agents/                      # agent directory + settings + API tab
│   │   ├── docs/                        # platform documentation
│   │   └── api/
│   │       ├── projects/                # project CRUD + registry
│   │       ├── tasks/[taskId]/
│   │       │   ├── signal/              # Temporal approval signal proxy
│   │       │   └── terminate/           # workflow cancellation
│   │       ├── traces/                  # agent trace retrieval
│   │       ├── tree/                    # repo file tree
│   │       └── github/repos/            # GitHub repo proxy (PAT-authenticated)
│   ├── components/
│   │   ├── feed/                        # message-feed domain modules
│   │   │   ├── agent-utils.ts
│   │   │   ├── agent-row.tsx
│   │   │   ├── plan-cards.tsx
│   │   │   ├── builder-cards.tsx
│   │   │   ├── hitl-cards.tsx
│   │   │   ├── status-indicators.tsx
│   │   │   ├── tool-icon.tsx
│   │   │   └── builder-progress.ts
│   │   ├── swarm/                       # swarm-view domain modules
│   │   │   ├── utils.ts                 # stage parsers incl. reviewer stage
│   │   │   ├── pipeline-tracker.tsx     # animated 8-stage pipeline
│   │   │   ├── traces-panel.tsx
│   │   │   ├── context-usage.tsx
│   │   │   ├── preview-pane.tsx
│   │   │   └── report-card.tsx
│   │   └── agents/
│   │       ├── config-panel.tsx
│   │       └── agent-directory.tsx      # 8-agent directory with Reviewer card
│   └── lib/
│       ├── agent-config-store.ts
│       ├── project-repository.ts
│       └── use-projects.ts
│
├── tests/
│   ├── test_orchestrator_guards.py      # tier-gated HITL checkpoint unit tests
│   ├── test_pipeline_integration.py     # end-to-end pipeline stage transition tests
│   └── test_track_conflicts.py          # pre-flight track conflict detection tests
│
├── manifest.yaml                        # Agentex agent manifest
├── dev.sh                               # dev launcher (5 services)
├── pyproject.toml
└── .env.example
```

---

## Getting started

### Prerequisites

- Python 3.12+ and [uv](https://github.com/astral-sh/uv)
- Node.js 20+
- [Temporal CLI](https://docs.temporal.io/cli) — `brew install temporal`
- Scale Agentex platform — `cd scale-agentex/agentex && docker compose up -d`

### Setup

```bash
cp .env.example .env
# Required: ANTHROPIC_API_KEY
# Optional: GH_TOKEN (for GitHub clone + push)
#           BRAVE_SEARCH_API_KEY (for web search in PM + Architect)
#           GANTRY_API_KEY (REST API bearer token — defaults to dev key)
```

```bash
# Install Python deps
uv sync

# Install UI deps
cd ui && npm install
```

### Run

```bash
./dev.sh
```

Starts five services:

1. Temporal dev server (`:7233`)
2. Agentex platform (`:5003`)
3. Gantry worker — ACP server (`:8000`) + Temporal worker
4. **Gantry REST API** (`:8001`) — FastAPI with Swagger at `/docs`
5. Next.js UI (`:3000`)

Open [http://localhost:3000](http://localhost:3000).

```bash
./dev.sh --stop      # tear everything down
./dev.sh --status    # show which services are running
./dev.sh --platform  # also restart Docker platform first
```

---

## GitHub integration

To build on an existing GitHub repo:

1. Go to **Agents → Settings → GitHub** and paste a Personal Access Token
   - Classic PAT: needs `repo` scope
   - Fine-grained: needs `contents: write` + `pull_requests: write`
2. Create a project and paste the GitHub HTTPS URL (e.g. `https://github.com/owner/repo`)
3. Submit a goal — Gantry clones the repo, builds, and opens a PR

The token is stored in your browser only. It's passed to the worker as a task param and used only for clone and push operations.

---

## Memory

Gantry maintains persistent memory across builds so the system gets smarter over time.

**Facts store** (`.gantry/memory/facts.json`) — key/value facts written by any agent during a build. Architects store tech stack decisions. Builders store known failure patterns. DevOps stores deployment notes. Facts with `arch.` or `pm.` prefixes expire after 90 days.

**Episodic memory** — one record per completed build, written at two levels:

- **Per-repo** (`.gantry/memory/episodes.jsonl`) — history for this specific repository
- **Platform-wide** (`~/.gantry/episodes.jsonl`) — history across every repo ever built on this machine

Before planning, the Architect searches the platform-wide store. A new React project gets the learning from every prior React build you've run — what track decompositions worked, what failed, what quality scores were achieved. Same-repo episodes are boosted in ranking so local context still wins ties. The more tasks run, the better every future Architect gets.

**API access** — memory is readable via the REST API:

```
GET /v1/projects/{project_id}/memory
Authorization: Bearer <key>
```

Returns the facts object and the 20 most recent episodes. The **Projects** page in the UI surfaces this data on every project card.

---

## Configuration

All swarm parameters are configurable from **Agents → Settings**:

| Setting | Default | Description |
|---|---|---|
| Branch prefix | `swarm` | Git branches named `prefix/task-id` |
| Max parallel tracks | 4 | Concurrent Builder agents |
| Max heal cycles | 3 | Inspector → Builder retry limit |
| Tier override | Auto | Force a specific complexity tier |
| GitHub PAT | — | Token for clone + push |

---

## Roadmap

- **Next**: Multi-repo support (one task touching multiple repos), pre-flight track conflict validation to detect dependency clashes before builders launch
- **Later**: Cost budgets + pre-task estimation, agent specialisation profiles (database builder, React builder, API builder), branch-level CI integration (wait for CI green before opening PR)
- **Production**: Supabase Postgres for project registry, persistent volume for repo files, Vercel for UI, Fly.io for worker
