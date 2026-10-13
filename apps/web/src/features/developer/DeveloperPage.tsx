import { ExternalLink } from 'lucide-react';
import { gantryBaseUrl, gantryDocsUrl } from '@/shared/services/gantry/config';
import {
  DOC_NAV,
  DocCallout,
  DocEndpoint,
  DocLead,
  DocList,
  DocPre,
  DocSection,
  DocSubhead,
  DocTable,
} from './developerDocSections';
import './DeveloperPage.css';

export function DeveloperPage() {
  const apiBase = gantryBaseUrl() || 'http://localhost:8001';
  const docsUrl = gantryDocsUrl();

  return (
    <div className="developer-page">
      <aside className="developer-toc">
        <p className="developer-toc-label">On this page</p>
        <nav aria-label="Developer documentation">
          {DOC_NAV.map(item => (
            <a key={item.id} href={`#${item.id}`} className="developer-toc-link">
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="developer-toc-swagger"
        >
          Open Swagger
          <ExternalLink size={12} />
        </a>
      </aside>

      <div className="developer-content">
        <header id="overview" className="developer-header">
          <h1 className="developer-title">Gantry API</h1>
          <p className="developer-subtitle">
            REST control plane for async software-engineering runs. Submit a goal against a
            workspace; a durable agent pipeline plans work, edits the repo, runs mechanical
            oracles, and opens a pull request. This UI uses the same API as CI, webhooks,
            and headless integrations.
          </p>
          <div className="developer-meta">
            <span>Base URL: <code>{apiBase}</code></span>
            <span>Format: JSON</span>
            <span>Auth: Bearer API key</span>
          </div>
        </header>

        <section className="developer-card developer-card--cta">
          <div>
            <h2>Interactive reference</h2>
            <p>
              Swagger lists every route, request schema, and response shape. Use this guide
              for concepts and workflows; use Swagger when you need exact field names.
            </p>
          </div>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="developer-swagger-btn"
          >
            Open Swagger
            <ExternalLink size={14} />
          </a>
        </section>

        <DocSection id="quickstart" title="Quick start">
          <DocLead>
            Three calls to go from zero to a running factory job: create a key, link a
            workspace, submit a task, then stream events until <code>done</code>.
          </DocLead>
          <DocPre>{`# 1. Create an API key (shown once)
curl -X POST ${apiBase}/v1/keys \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-integration"}'

# 2. Create a workspace
curl -X POST ${apiBase}/v1/workspaces \\
  -H "Authorization: Bearer $GANTRY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My app", "github_url": "https://github.com/org/repo"}'

# 3. Submit a task (project_id = workspace id)
curl -X POST ${apiBase}/v1/tasks \\
  -H "Authorization: Bearer $GANTRY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "goal": "Add rate limiting to POST /v1/tasks",
    "project_id": "WORKSPACE_ID"
  }'

# 4. Stream progress (SSE)
curl -N ${apiBase}/v1/tasks/TASK_ID/events \\
  -H "Authorization: Bearer $GANTRY_API_KEY"`}</DocPre>
          <DocCallout>
            The UI stores your API key in Profile settings and proxies requests through the
            same <code>/v1</code> routes during local dev.
          </DocCallout>
        </DocSection>

        <DocSection id="auth" title="Authentication">
          <DocLead>
            All <code>/v1/*</code> routes require an API key in the Authorization header.
            Keys are org-scoped and can be limited to specific scopes.
          </DocLead>
          <DocPre>{`Authorization: Bearer gantry_<64 hex chars>`}</DocPre>
          <DocSubhead>API keys</DocSubhead>
          <DocEndpoint method="POST" path="/v1/keys" summary="Create a key. Returns the full secret once — store it immediately." />
          <DocEndpoint method="GET" path="/v1/keys" summary="List active keys (masked)." scope="admin" />
          <DocEndpoint method="DELETE" path="/v1/keys/:id" summary="Revoke a key." scope="admin" />
          <DocSubhead>Scoped keys</DocSubhead>
          <DocPre>{`{ "name": "ci-bot", "scopes": ["tasks:write", "projects:read"] }`}</DocPre>
          <DocTable
            headers={['Scope', 'Allows']}
            rows={[
              ['tasks:read', 'Poll tasks, messages, events, traces'],
              ['tasks:write', 'Submit, terminate, HITL, follow-up'],
              ['projects:read', 'List workspaces / projects, read files'],
              ['projects:write', 'Create workspaces, save file content'],
              ['secrets:read', 'List secret names'],
              ['secrets:write', 'Create and revoke secrets'],
              ['admin', 'Keys, quotas, audit, org webhooks'],
            ]}
          />
        </DocSection>

        <DocSection id="workspaces" title="Workspaces">
          <DocLead>
            A workspace is the repo context agents read and write — a GitHub-linked project
            or a local sandbox path on the worker. Every task references a workspace via{' '}
            <code>project_id</code> (legacy name retained in the task API).
          </DocLead>
          <DocEndpoint method="GET" path="/v1/workspaces" summary="List workspaces in your org." scope="projects:read" />
          <DocEndpoint method="GET" path="/v1/workspaces/:id" summary="Fetch one workspace — name, repo path, GitHub metadata, instructions brief." scope="projects:read" />
          <DocEndpoint method="POST" path="/v1/workspaces" summary="Create a workspace. Link a GitHub repo or provision a local path." scope="projects:write" />
          <DocEndpoint method="PATCH" path="/v1/workspaces/:id" summary="Update name, GitHub URL, or workspace instructions brief." scope="projects:write" />
          <DocEndpoint method="GET" path="/v1/workspaces/:id/artifacts" summary="List uploaded artifacts attached to the workspace." scope="projects:read" />
          <DocPre>{`POST /v1/workspaces
{
  "name": "Platform API",
  "github_url": "https://github.com/acme/platform",
  "instructions": "Always use FastAPI + pytest. Open a PR to main."
}`}</DocPre>
          <DocSubhead>Legacy alias</DocSubhead>
          <DocLead>
            <code>/v1/projects</code> mirrors workspace routes for backward compatibility.
            New integrations should prefer <code>/v1/workspaces</code>.
          </DocLead>
        </DocSection>

        <DocSection id="tasks" title="Tasks">
          <DocLead>
            A task is one factory run: PM planning → architecture → parallel builders →
            inspector oracles → DevOps PR. Runs are durable (Temporal-backed) and survive
            worker restarts.
          </DocLead>
          <DocSubhead>Submit</DocSubhead>
          <DocEndpoint method="POST" path="/v1/tasks" summary="Queue a single engineering goal." scope="tasks:write" />
          <DocEndpoint method="POST" path="/v1/tasks/bulk" summary="Submit up to 50 goals in one call. Partial failure is allowed." scope="tasks:write" />
          <DocEndpoint method="POST" path="/v1/tasks/:id/followup" summary="Send a follow-up message to a running or paused task." scope="tasks:write" />
          <DocTable
            headers={['Field', 'Required', 'Description']}
            rows={[
              ['goal', 'Yes', 'Plain-English engineering objective'],
              ['project_id', 'Yes', 'Workspace id the run executes against'],
              ['tier', 'No', 'Model tier: 0 = fast, 1 = balanced, 2 = heavy, -1 = auto'],
              ['playbook', 'No', 'Vertical overlay slug — see Playbooks'],
              ['branch_prefix', 'No', 'Git branch prefix (default swarm)'],
              ['github_token', 'No', 'Override PAT for this run'],
              ['github_token_secret', 'No', 'Reference a stored secret by name'],
              ['webhook_url', 'No', 'Per-task completion callback URL'],
              ['include_workspace_brief', 'No', 'Prepend workspace instructions to the goal'],
            ]}
          />
          <DocPre>{`POST /v1/tasks
{
  "goal": "Fix flaky test in auth module",
  "project_id": "ws_abc123",
  "tier": 1,
  "playbook": "a11y-remediation",
  "branch_prefix": "gantry"
}`}</DocPre>
          <DocSubhead>Poll & control</DocSubhead>
          <DocEndpoint method="GET" path="/v1/tasks/:id" summary="Task status, tier, playbook, pending HITL, PR URL when complete." scope="tasks:read" />
          <DocEndpoint method="GET" path="/v1/tasks" summary="List recent tasks for the org." scope="tasks:read" />
          <DocEndpoint method="GET" path="/v1/tasks/:id/report" summary="Structured final report when the run finishes." scope="tasks:read" />
          <DocEndpoint method="GET" path="/v1/tasks/:id/traces" summary="Agent decision traces (reasoning, tool calls, token usage)." scope="tasks:read" />
          <DocEndpoint method="DELETE" path="/v1/tasks/:id" summary="Terminate a running task." scope="tasks:write" />
          <DocSubhead>Status values</DocSubhead>
          <DocList
            items={[
              'queued — accepted, waiting for worker',
              'running — agents active',
              'waiting_approval — paused at a HITL checkpoint',
              'completed — PR opened successfully',
              'failed / terminated / timeout / cancelled — terminal error states',
            ]}
          />
        </DocSection>

        <DocSection id="streaming" title="Streaming & messages">
          <DocLead>
            Prefer Server-Sent Events for live UI and automation. Poll messages or task
            status when SSE is inconvenient.
          </DocLead>
          <DocEndpoint method="GET" path="/v1/tasks/:id/events" summary="SSE stream — status, lifecycle, agent messages, terminal done event." scope="tasks:read" />
          <DocEndpoint method="GET" path="/v1/tasks/:id/messages" summary="Snapshot of normalized agent activity messages." scope="tasks:read" />
          <DocSubhead>SSE event types</DocSubhead>
          <DocTable
            headers={['Event', 'When']}
            rows={[
              ['status', 'Task status changed (queued → running → …)'],
              ['lifecycle', 'Pipeline stage transitions'],
              ['message', 'Agent output — plans, file writes, tool results'],
              ['hitl', 'Run paused — clarification or approval required'],
              ['error', 'Non-terminal stream error'],
              ['done', 'Stream closed — check task status for final outcome'],
            ]}
          />
          <DocCallout>
            The web UI merges SSE messages with pending HITL from{' '}
            <code>GET /v1/tasks/:id</code> so clarification cards appear even if the stream
            reconnects.
          </DocCallout>
        </DocSection>

        <DocSection id="hitl" title="Human-in-the-loop">
          <DocLead>
            Runs pause when agents need your input — scope clarification, plan approval,
            heal limits, or DevOps confirmation. Resume via HITL endpoints or the run UI
            composer.
          </DocLead>
          <DocEndpoint method="POST" path="/v1/tasks/:id/hitl" summary="Named checkpoint response — approve, reject, or answer clarification." scope="tasks:write" />
          <DocEndpoint method="POST" path="/v1/tasks/:id/approve" summary="Legacy approval shortcut; optional checkpoint for audit." scope="tasks:write" />
          <DocEndpoint method="GET" path="/v1/tasks/:id/hitl" summary="Audit log of HITL events for this task." scope="tasks:read" />
          <DocSubhead>Checkpoints</DocSubhead>
          <DocTable
            headers={['Checkpoint', 'Typical use']}
            rows={[
              ['pm_clarification', 'PM needs product/stack answers before planning'],
              ['architect_plan', 'Review the implementation plan before builders start'],
              ['max_heals', 'Inspector exhausted heal cycles — approve continue or stop'],
              ['devops', 'Confirm before opening the pull request'],
            ]}
          />
          <DocPre>{`# Approve architect plan
POST /v1/tasks/:id/hitl
{
  "checkpoint": "architect_plan",
  "workflow_id": "<from pending_hitl or message stream>",
  "approved": true
}

# Answer PM clarification
POST /v1/tasks/:id/hitl
{
  "checkpoint": "pm_clarification",
  "workflow_id": "<workflow id>",
  "payload": { "Which stack?": "React + FastAPI" }
}`}</DocPre>
        </DocSection>

        <DocSection id="playbooks" title="Playbooks">
          <DocLead>
            Playbooks are job packets — seats, stages, artifact type, and oracle knobs —
            not separately deployable bots. Run via tasks or the convenience endpoint.
          </DocLead>
          <DocEndpoint method="GET" path="/v1/playbooks" summary="List org playbooks and system starters." scope="tasks:read" />
          <DocEndpoint method="POST" path="/v1/playbooks" summary="Create a custom playbook." scope="tasks:write" />
          <DocEndpoint method="PATCH" path="/v1/playbooks/:slug" summary="Update playbook config." scope="tasks:write" />
          <DocEndpoint method="DELETE" path="/v1/playbooks/:slug" summary="Delete a custom playbook." scope="tasks:write" />
          <DocEndpoint method="POST" path="/v1/playbooks/run" summary="Submit a task bound to a playbook (optional firm pack)." scope="tasks:write" />
          <DocPre>{`POST /v1/playbooks/run
{
  "pack": "migration-runner@1",
  "playbook": "a11y-remediation",
  "goal": "Fix contrast on primary buttons",
  "project_id": "ws_abc"
}`}</DocPre>
          <DocList
            items={[
              'platform-backlog — general product engineering (swe-factory)',
              'a11y-remediation — WCAG + oracle-a11y (migration-runner)',
              'monorepo-slice — scoped changes in large repos (swe-factory)',
            ]}
          />
        </DocSection>

        <DocSection id="packs" title="Firm packs">
          <DocLead>
            Versioned role sets + default playbooks installed into the one Gantry factory.
            Not a chat-bot marketplace — compose crews inside swarm-factory.
          </DocLead>
          <DocEndpoint method="GET" path="/v1/packs" summary="Catalog with org install/enable state." scope="tasks:read" />
          <DocEndpoint method="POST" path="/v1/packs/:id/install" summary="Install or re-enable a pack; seed playbooks." scope="projects:write" />
          <DocEndpoint method="PATCH" path="/v1/packs/:id" summary="Enable/disable or set per-pack daily quota." scope="projects:write" />
          <DocEndpoint method="DELETE" path="/v1/packs/:id" summary="Remove install row (auto packs fall back to built-in)." scope="projects:write" />
          <DocList
            items={[
              'swe-factory@1 — classic SWE crew; auto-available',
              'migration-runner@1 — branch-first jobs + OracleA11yAgent',
            ]}
          />
        </DocSection>

        <DocSection id="agents" title="Agents">
          <DocLead>
            The factory crew is orchestrated by Agentex + Temporal. The catalog describes
            each role, model tier, and HITL checkpoints — useful for debugging and
            integrator tooling.
          </DocLead>
          <DocEndpoint method="GET" path="/v1/agents" summary="Full crew catalog — Foreman, PM, Architect, Builder, Inspector, DevOps, …" scope="tasks:read" />
          <DocEndpoint method="GET" path="/v1/agents/:name" summary="Single agent metadata and Temporal child identity." scope="tasks:read" />
          <DocTable
            headers={['Role', 'Responsibility']}
            rows={[
              ['Foreman', 'Entry point — dispatches the swarm from your goal'],
              ['PM', 'Scopes the work; may ask clarifying questions'],
              ['Architect', 'Repo map, track split, implementation plan'],
              ['Builder', 'Writes code on assigned tracks'],
              ['Inspector', 'Tests, lint, typecheck — mechanical oracle'],
              ['Reviewer / Security', 'Diff review and dependency risk'],
              ['DevOps', 'Branch, commit, push, open PR'],
            ]}
          />
        </DocSection>

        <DocSection id="secrets" title="Secrets">
          <DocLead>
            Store GitHub PATs and other credentials encrypted at rest. Reference by name
            when submitting tasks — values are never returned on read.
          </DocLead>
          <DocEndpoint method="POST" path="/v1/secrets" summary="Create or update a named secret." scope="secrets:write" />
          <DocEndpoint method="GET" path="/v1/secrets" summary="List secret names only." scope="secrets:read" />
          <DocEndpoint method="DELETE" path="/v1/secrets/:name" summary="Revoke a secret." scope="secrets:write" />
          <DocPre>{`POST /v1/secrets
{ "name": "github-pat", "value": "ghp_..." }

POST /v1/tasks
{
  "goal": "Add health check endpoint",
  "project_id": "ws_abc",
  "github_token_secret": "github-pat"
}`}</DocPre>
        </DocSection>

        <DocSection id="webhooks" title="Webhooks">
          <DocLead>
            Get notified when tasks change state — register org-level webhooks (recommended)
            or pass a per-task <code>webhook_url</code> on submit.
          </DocLead>
          <DocSubhead>Org webhooks</DocSubhead>
          <DocEndpoint method="POST" path="/v1/webhooks" summary="Register a URL + event filter. Returns a signing secret once." scope="admin" />
          <DocEndpoint method="POST" path="/v1/webhooks/test" summary="Send a test ping to verify your endpoint." scope="admin" />
          <DocTable
            headers={['Event', 'When']}
            rows={[
              ['task.queued', 'Task accepted by API'],
              ['task.started', 'Worker picked up the run'],
              ['task.waiting_approval', 'HITL checkpoint reached'],
              ['task.completed', 'PR opened successfully'],
              ['task.failed', 'Terminal failure'],
            ]}
          />
          <DocSubhead>Verification</DocSubhead>
          <DocLead>
            Deliveries include <code>X-Gantry-Signature: sha256=…</code>. Verify with HMAC-SHA256
            using your webhook secret and the raw request body.
          </DocLead>
          <DocSubhead>GitHub trigger</DocSubhead>
          <DocEndpoint method="POST" path="/v1/integrations/github/webhook" summary="Receives GitHub issue events — label gantry on an issue to auto-submit a task." />
        </DocSection>

        <DocSection id="files" title="Workspace files">
          <DocLead>
            Read and write workspace files outside of a run — used by the IDE file explorer
            and for manual edits between agent passes.
          </DocLead>
          <DocEndpoint method="GET" path="/v1/workspaces/:id/files/tree" summary="List relative file paths in the workspace." scope="projects:read" />
          <DocEndpoint method="GET" path="/v1/workspaces/:id/files/content?path=…" summary="Read file content by relative path." scope="projects:read" />
          <DocEndpoint method="PUT" path="/v1/workspaces/:id/files/content" summary="Save file content during greenfield / local workspace editing." scope="projects:write" />
          <DocCallout>
            During an active run, agents write files directly on the worker. The UI polls
            the tree every few seconds and highlights files builders are touching.
          </DocCallout>
        </DocSection>

        <DocSection id="errors" title="Errors & limits">
          <DocSubhead>HTTP errors</DocSubhead>
          <DocTable
            headers={['Status', 'Meaning']}
            rows={[
              ['401', 'Invalid or missing API key'],
              ['403', 'Insufficient scope for this route'],
              ['404', 'Workspace, task, or resource not found'],
              ['422', 'Validation error — check request body'],
              ['429', 'Quota exceeded — concurrent tasks, daily limit, or rate limit'],
              ['502', 'Upstream error (Agentex or GitHub unreachable)'],
            ]}
          />
          <DocLead>All errors return <code>{'{ "detail": "…" }'}</code>.</DocLead>
          <DocSubhead>Quotas</DocSubhead>
          <DocEndpoint method="GET" path="/v1/quotas" summary="Org limits and current usage." scope="admin" />
          <DocEndpoint method="PATCH" path="/v1/quotas" summary="Adjust concurrent tasks, daily cap, bulk size, rate limit." scope="admin" />
          <DocSubhead>Audit</DocSubhead>
          <DocEndpoint method="GET" path="/v1/audit" summary="Immutable org audit trail — filter by action or key." scope="admin" />
          <DocSubhead>Health</DocSubhead>
          <DocEndpoint method="GET" path="/status" summary="Public platform health — no auth required." />
        </DocSection>
      </div>
    </div>
  );
}
