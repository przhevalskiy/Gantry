# @monolift/sdk

TypeScript/JavaScript SDK for [Monolift](https://monolift.dev) — submit engineering tasks, get PRs back.

## Install

```bash
npm install @monolift/sdk
# or
pnpm add @monolift/sdk
```

## Quickstart

```typescript
import { GantryClient } from '@monolift/sdk';

const client = new GantryClient({ apiKey: process.env.GANTRY_API_KEY });

// List projects
const projects = await client.projects.list();

// Submit a single task and wait for the PR
const task = await client.tasks.submit(
  'Add rate limiting to POST /v1/tasks',
  projects[0].id,
);
const done = await client.tasks.wait(task.task_id);
console.log(done.pr_url);
```

## Bulk submission

Submit up to 50 tasks in parallel — the core throughput primitive:

```typescript
const response = await client.tasks.bulk(
  [
    'Add rate limiting to the API',
    'Write tests for the auth module',
    'Add OpenAPI descriptions to all endpoints',
    'Fix the N+1 query in project listing',
  ],
  projectId,
  { webhook_url: 'https://your-server.com/hooks/monolift' },
);

console.log(`${response.submitted} running, ${response.failed} failed`);
response.results.forEach(r => {
  if (r.task_id) console.log(`  ${r.task_id}: ${r.goal}`);
  else console.error(`  FAILED: ${r.goal} — ${r.error}`);
});
```

## Live SSE stream

```typescript
for await (const event of client.tasks.streamEvents(task.task_id)) {
  console.log(event.type, event);
  if (event.type === 'done' || event.type === 'error') break;
}
```

## GitHub Actions

```yaml
- name: Submit Monolift tasks
  run: |
    node - <<'EOF'
    const { GantryClient } = require('@monolift/sdk');
    const client = new GantryClient({ apiKey: process.env.GANTRY_API_KEY });
    const task = await client.tasks.submit(process.env.GOAL, process.env.PROJECT_ID);
    const done = await client.tasks.wait(task.task_id);
    console.log(done.pr_url);
    EOF
  env:
    GANTRY_API_KEY: ${{ secrets.GANTRY_API_KEY }}
    GOAL: ${{ github.event.issue.title }}
    PROJECT_ID: proj_abc
```

## Reference

### `new GantryClient({ apiKey, baseUrl })`

| Option | Default |
|---|---|
| `apiKey` | `GANTRY_API_KEY` env var |
| `baseUrl` | `https://api.monolift.dev` |

### `client.tasks`

| Method | Returns |
|---|---|
| `submit(goal, projectId, options?)` | `Promise<Task>` |
| `bulk(goals, projectId, options?)` | `Promise<BulkResponse>` |
| `get(taskId)` | `Promise<Task>` |
| `wait(taskId, options?)` | `Promise<Task>` |
| `messages(taskId)` | `Promise<unknown[]>` |
| `terminate(taskId)` | `Promise<void>` |
| `approve(taskId, workflowId?)` | `Promise<void>` |
| `hitl(taskId, { checkpoint, workflowId, approved?, payload? })` | `Promise<{ ok, checkpoint, acp_event }>` |
| `streamEvents(taskId)` | `AsyncGenerator` of SSE event objects until `done`/`error` |

### `client.agents`

| Method | Returns |
|---|---|
| `list()` | Crew catalog (`swarm-factory`, L2–L5, HITL, ACP invoke) |
| `get(name)` | One crew identity |

### `client.projects`

| Method | Returns |
|---|---|
| `list()` | `Promise<Project[]>` |
| `get(projectId)` | `Promise<Project>` |
| `create(name, options?)` | `Promise<Project>` |
| `update(projectId, options)` | `Promise<Project>` |
