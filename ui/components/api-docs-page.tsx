'use client';

import { useState } from 'react';

type Section = { title: string; slug: string };

const SECTIONS: Section[] = [
  { title: 'Overview', slug: 'overview' },
  { title: 'Authentication', slug: 'authentication' },
  { title: 'Endpoints', slug: 'endpoints' },
  { title: 'Webhooks', slug: 'webhooks' },
  { title: 'GitHub Integration', slug: 'github' },
];

const CONTENT: Record<string, { title: string; body: string }> = {
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

export function ApiDocsPage() {
  const [activeSlug, setActiveSlug] = useState('overview');
  const doc = CONTENT[activeSlug] ?? CONTENT['overview'];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left nav */}
      <nav style={{
        width: 200, flexShrink: 0, borderRight: '1px solid var(--border)',
        overflowY: 'auto', padding: '1.5rem 0.75rem',
        background: 'var(--surface)',
      }}>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text-secondary)',
          padding: '0 0.5rem', marginBottom: '0.75rem',
        }}>
          API Reference
        </p>
        {SECTIONS.map(section => (
          <button
            key={section.slug}
            onClick={() => setActiveSlug(section.slug)}
            style={{
              width: '100%', textAlign: 'left', border: 'none', display: 'block',
              padding: '0.35rem 0.5rem', borderRadius: '6px', cursor: 'pointer',
              fontSize: '0.8375rem', fontFamily: 'inherit',
              color: activeSlug === section.slug ? 'var(--accent)' : 'var(--text-primary)',
              background: activeSlug === section.slug ? 'var(--surface-raised)' : 'transparent',
              fontWeight: activeSlug === section.slug ? 500 : 400,
              marginBottom: '0.125rem',
            } as React.CSSProperties}
          >
            {section.title}
          </button>
        ))}

        <div style={{ marginTop: '1.5rem', padding: '0 0.5rem' }}>
          <a
            href="http://localhost:8001/docs"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '0.775rem', color: 'var(--text-secondary)',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open Swagger UI
          </a>
        </div>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '2.5rem 3rem', maxWidth: 780 }}>
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
  let k = 0;

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
    } else if (line.startsWith('| ')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!lines[i].match(/^\|[-| ]+\|$/)) {
          rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
        }
        i++;
      }
      if (rows.length > 0) {
        const [header, ...body] = rows;
        elements.push(
          <table key={k++} style={{ width: '100%', borderCollapse: 'collapse', margin: '1rem 0', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {header.map((cell, j) => (
                  <th key={j} style={{ textAlign: 'left', padding: '0.4rem 0.75rem', borderBottom: '2px solid var(--border)', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.775rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, j) => (
                <tr key={j} style={{ borderBottom: '1px solid var(--border)' }}>
                  {row.map((cell, m) => (
                    <td key={m} style={{ padding: '0.4rem 0.75rem' }}>{inlineFormat(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      continue;
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
    } else if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={k++} style={{
          borderLeft: '3px solid var(--accent)', paddingLeft: '1rem',
          margin: '1rem 0', color: 'var(--text-secondary)', fontStyle: 'italic',
        }}>
          {quoteLines.map((ql, j) => <p key={j} style={{ margin: '0.25rem 0' }}>{inlineFormat(ql)}</p>)}
        </blockquote>
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
