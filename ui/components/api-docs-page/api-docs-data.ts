export type Section = { title: string; slug: string };

export const SECTIONS: Section[] = [
  { title: 'Overview', slug: 'overview' },
  { title: 'Authentication', slug: 'authentication' },
  { title: 'Endpoints', slug: 'endpoints' },
  { title: 'Memory', slug: 'memory' },
  { title: 'Webhooks', slug: 'webhooks' },
  { title: 'GitHub Integration', slug: 'github' },
];

export const CONTENT: Record<string, { title: string; body: string }> = {
  overview: {
    title: 'Overview',
    body: `# Gantry API

The Gantry API lets any tool submit tasks and receive pull requests programmatically. No UI required.

\`\`\`
POST /v1/tasks
→ { task_id, status: "queued" }
\`\`\`

When the pipeline finishes, a webhook fires to your endpoint with the PR URL. That's the full integration surface.

## Base URL

\`\`\`
http://localhost:8001
\`\`\`

Interactive docs (Swagger) are available at \`http://localhost:8001/docs\`.

## Use cases

- Label a GitHub issue \`gantry\` → PR opens automatically
- CI pipeline detects a failing test → submits a fix task
- Linear ticket hits "Ready" → Gantry drafts the implementation
- Script drains a backlog of well-scoped tasks overnight

## Stack

The Gantry API is a FastAPI service running on port \`8001\`. It sits in front of the Agentex middleware and translates REST calls into Temporal workflow submissions. The pipeline (Architect → Builders → Inspector → Security → DevOps) is unchanged.

\`\`\`
Your tool → Gantry API :8001 → Agentex :8000 → Temporal :7233 → GitHub PR
\`\`\`
`,
  },

  authentication: {
    title: 'Authentication',
    body: `# Authentication

All endpoints require a Bearer token except \`GET /healthz\` and \`POST /v1/keys\`.

## Create your first key

No key is required to create the first key:

\`\`\`
curl -X POST http://localhost:8001/v1/keys \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-key"}'
\`\`\`

Response — **store the key immediately, it is shown once only**:

\`\`\`
{
  "id": "a05cf980-...",
  "name": "my-key",
  "key": "gantry_1d9e00d5197e8...",
  "created_at": "2026-05-23T12:44:50Z"
}
\`\`\`

## Using the key

\`\`\`
curl http://localhost:8001/v1/projects \\
  -H "Authorization: Bearer gantry_1d9e00d5..."
\`\`\`

## Key management

\`\`\`
GET    /v1/keys         List active keys (hashes only)
DELETE /v1/keys/:id     Revoke immediately
\`\`\`

Keys are stored at \`~/.gantry/api_keys.json\` as SHA-256 hashes. The plaintext is never stored after creation.

## Error responses

\`\`\`
401 { "detail": "Missing API key" }
401 { "detail": "Invalid API key" }
\`\`\`
`,
  },

  endpoints: {
    title: 'Endpoints',
    body: `# Endpoints

## Health

\`\`\`
GET /healthz  →  { "ok": true }
\`\`\`

## Projects

Projects map a name to a repo path and optional GitHub URL. Required before submitting a task.

\`\`\`
GET  /v1/projects
POST /v1/projects   { "name": "...", "github_url": "https://github.com/owner/repo" }
GET  /v1/projects/:id
\`\`\`

## Tasks

### Submit

\`\`\`
POST /v1/tasks
\`\`\`

\`\`\`
{
  "goal": "add pagination to GET /api/tasks",
  "project_id": "734ebfde-...",
  "branch_prefix": "swarm",
  "tier": -1,
  "github_token": "ghp_...",
  "webhook_url": "https://your-host/webhook"
}
\`\`\`

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| goal | yes | — | What to build |
| project_id | yes | — | Target project |
| branch_prefix | no | \`swarm\` | Git branch prefix |
| tier | no | \`-1\` (auto) | Force tier 0–3 |
| github_token | no | env \`GH_TOKEN\` | Per-task PAT |
| webhook_url | no | — | Callback on completion |

Response:

\`\`\`
{ "task_id": "abc123", "status": "queued", "project_id": "734ebfde-..." }
\`\`\`

### Poll status

\`\`\`
GET /v1/tasks/:id
\`\`\`

\`\`\`
{
  "task_id": "abc123",
  "status": "completed",
  "pr_url": "https://github.com/owner/repo/pull/42",
  "project_id": "734ebfde-...",
  "created_at": "...",
  "updated_at": "..."
}
\`\`\`

Status values: \`queued\` · \`running\` · \`completed\` · \`failed\` · \`terminated\`

### Other task endpoints

\`\`\`
GET    /v1/tasks/:id/messages   Agent message stream
DELETE /v1/tasks/:id            Terminate a running task
POST   /v1/tasks/:id/approve    Send HITL approval signal
\`\`\`

Approve body: \`{ "workflow_id": "abc123", "approved": true }\`

## Memory

\`\`\`
GET /v1/projects/:id/memory
\`\`\`

Returns facts and recent episodes for the project. See the **Memory** section for the full response schema.

## Keys

\`\`\`
POST   /v1/keys           Create (no auth)
GET    /v1/keys           List
DELETE /v1/keys/:id       Revoke
\`\`\`

## Webhooks

\`\`\`
POST /v1/webhooks/test  { "url": "https://..." }
\`\`\`

Fires a test ping to verify your endpoint is reachable before wiring up a real task.
`,
  },

  memory: {
    title: 'Memory',
    body: `# Memory

Gantry builds durable memory for every project. After each build the swarm writes two kinds of records:

| Store | Path | Contents |
|-------|------|---------|
| Facts | \`{repo}/.gantry/memory/facts.json\` | Key/value facts written by any agent during a build |
| Episodes | \`{repo}/.gantry/memory/episodes.jsonl\` | One JSON record per completed build |

## Retrieve project memory

\`\`\`
GET /v1/projects/:id/memory
\`\`\`

Response:

\`\`\`json
{
  "project_id": "734ebfde-...",
  "repo_path": "/opt/gantry/projects/my-app",
  "facts_count": 4,
  "episodes_count": 12,
  "facts": {
    "arch.primary_language": {
      "value": "TypeScript",
      "agent": "architect",
      "confidence": 1.0,
      "updated_at": "2026-05-20T14:22:00Z"
    },
    "pm.complexity_tier": {
      "value": "2",
      "agent": "pm",
      "confidence": 0.9,
      "updated_at": "2026-05-20T14:20:00Z"
    }
  },
  "episodes": [
    {
      "timestamp": "2026-05-20T14:30:00Z",
      "goal": "add pagination to GET /api/tasks",
      "outcome": "success",
      "tier_label": "tier2",
      "quality_score": 8,
      "heal_cycles": 1,
      "key_decisions": ["used cursor-based pagination", "added index on created_at"]
    }
  ]
}
\`\`\`

The \`episodes\` array contains the 20 most recent builds (newest first). \`episodes_count\` reflects the total across all builds.

## Fact keys

Facts are namespaced by the agent that wrote them:

| Prefix | Written by | TTL |
|--------|-----------|-----|
| \`arch.*\` | Architect | 90 days |
| \`pm.*\` | PM | 90 days |
| \`builder.*\` | Builder | none |
| \`inspector.*\` | Inspector | none |

Facts without a prefix have no TTL. Stale \`arch.*\` and \`pm.*\` facts (>90 days) are excluded from API responses and agent context.

## Episode fields

| Field | Description |
|-------|-------------|
| \`timestamp\` | ISO 8601 UTC |
| \`goal\` | Original task goal |
| \`outcome\` | \`success\` · \`partial\` · \`failed\` |
| \`tier_label\` | Complexity tier selected by PM |
| \`quality_score\` | Inspector quality rating (0–10) |
| \`heal_cycles\` | Number of Inspector heal iterations |
| \`key_decisions\` | Up to 5 agent decision strings |
`,
  },

  webhooks: {
    title: 'Webhooks',
    body: `# Webhooks

Register a \`webhook_url\` on task submission. Gantry fires a signed POST when the task reaches a terminal state.

## Events

| Event | Fired when |
|-------|-----------|
| \`task.completed\` | PR opened successfully |
| \`task.failed\` | Pipeline failed after all heal cycles |

## Payload

\`\`\`
POST https://your-host/webhook
Content-Type: application/json
X-Gantry-Event: task.completed
X-Gantry-Signature: sha256=abc123...
X-Gantry-Timestamp: 1716465890
\`\`\`

\`\`\`
{
  "event": "task.completed",
  "task_id": "abc123",
  "project_id": "734ebfde-...",
  "source": "api",
  "pr_url": "https://github.com/owner/repo/pull/42"
}
\`\`\`

Failed task payload adds \`"status": "failed"\` instead of \`pr_url\`.

## Verifying signatures

\`\`\`python
import hashlib, hmac

def verify(body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header)
\`\`\`

The webhook secret is auto-generated at \`~/.gantry/webhook_secret\` on first use.

## Retries

On non-2xx or timeout: retries 3 times with delays of 2s, 5s, 10s. After all retries fail the delivery is abandoned — not retried again.

## Testing

\`\`\`
curl -X POST http://localhost:8001/v1/webhooks/test \\
  -H "Authorization: Bearer $GANTRY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://your-host/webhook"}'
\`\`\`
`,
  },

  github: {
    title: 'GitHub Integration',
    body: `# GitHub Integration

Label a GitHub issue \`gantry\` → Gantry submits a build → PR opens → issue gets a comment with the PR link.

## Setup

### 1. Link a project to the repo

\`\`\`
curl -X POST http://localhost:8001/v1/projects \\
  -H "Authorization: Bearer $GANTRY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-app", "github_url": "https://github.com/owner/repo"}'
\`\`\`

### 2. Set env vars

\`\`\`
GITHUB_WEBHOOK_SECRET=your-secret
GH_TOKEN=your-github-pat
\`\`\`

### 3. Add webhook on GitHub

Repo → Settings → Webhooks → Add webhook:

- **Payload URL**: \`http://your-host:8001/v1/integrations/github/webhook\`
- **Content type**: \`application/json\`
- **Secret**: value of \`GITHUB_WEBHOOK_SECRET\`
- **Events**: Issues only

### 4. Label an issue

Add the \`gantry\` label to any issue. Gantry picks it up within seconds and posts:

> 🏗️ Gantry picked this up — task \`abc123\` is running.
> I'll post a follow-up here when the PR is ready.

When the PR opens, a second comment appears with the link.

## Writing good issues

The issue title becomes the primary goal. The body adds context. Be specific:

**Good**: "Add cursor-based pagination to GET /api/tasks — return \`next_cursor\` in the response body, accept \`cursor\` as a query param"

**Too vague**: "fix pagination"

## Removing the label

Removing the \`gantry\` label while a build is running terminates the workflow. No further comments are posted.

## Webhook endpoint

\`\`\`
POST /v1/integrations/github/webhook
\`\`\`

Only \`issues\` events with action \`labeled\` or \`unlabeled\` are processed. All other events return \`200 ok\` and are ignored.

## Signature verification

Gantry verifies \`X-Hub-Signature-256\` on every incoming request using \`GITHUB_WEBHOOK_SECRET\`. Requests with missing or invalid signatures return \`401\`. Set \`GITHUB_WEBHOOK_SECRET\` to enable verification — if the env var is not set, verification is skipped (not recommended in production).
`,
  },
};
