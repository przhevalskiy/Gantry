# Platform task SSE events (M3)

Generic events for `GET /v1/tasks/{id}/events`. No legacy Qodex/CoSight domain types.

## Event types

| type | fields | when |
|------|--------|------|
| `status` | `status` | Agentex task status changes |
| `lifecycle` | `event` | Queued/running milestones from task meta |
| `message` | `message` | New Agentex agent message |
| `hitl` | `checkpoint`, `workflow_id`, `description?` | Pending HITL in task meta |
| `error` | `message` | Stream fetch failure |
| `done` | `status`, `result?` | Terminal status; `result` is structured (I3) |

## Example stream

```
data: {"type":"status","status":"running"}

data: {"type":"message","message":{"id":"...","content":"..."}}

data: {"type":"hitl","checkpoint":"architect_plan","workflow_id":"wf-abc","description":"Approve plan"}

data: {"type":"done","status":"completed","result":{"pr_url":"https://github.com/org/repo/pull/42"}}
```

## Forbidden (M1/M3)

Do not emit: `intent`, `checklist`, `submitted`, `citations`.

Implementation: `api/schemas/task_sse.py`. Integrators / future clients parse the SSE contract above — there is no in-repo UI consumer. See [`../deep-dives/hitl-and-sse.md`](../deep-dives/hitl-and-sse.md).
