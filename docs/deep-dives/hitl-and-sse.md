# Deep dive: HITL and SSE

Human-in-the-loop pauses the Temporal workflow until a REST signal. Clients should prefer SSE + structured task GETs over chat scraping.

**Code:** `api/routes/tasks.py`, `api/schemas/task_sse.py`, `api/services/task_events.py`, `workflows/swarm/hitl.py`  
**Contract:** [`../platform/sse-events.md`](../platform/sse-events.md)

---

## Checkpoints

Named checkpoints (tier-dependent):

| Checkpoint id | Audit / signal | Typical tier |
|---------------|----------------|--------------|
| `pm_clarification` | `hitl.clarify` | ≥ 1 |
| `architect_plan` | `hitl.approve_plan` | ≥ 2 |
| `max_heals` | `hitl.approve_continue` | heal budget exhausted |
| `devops` | `hitl.approve_deploy` | ≥ 3 |

When pending:

1. Worker sets task status `waiting_approval` and stores HITL meta.
2. SSE emits `hitl` with `checkpoint` + `workflow_id`.
3. Client decides via REST; worker resumes on Temporal signal.

---

## REST

### List pending

`GET /v1/tasks/{task_id}/hitl`  
Scope: `tasks:read`

### Respond

`POST /v1/tasks/{task_id}/hitl`

```json
{
  "checkpoint": "architect_plan",
  "approved": true,
  "payload": { "notes": "ship tracks 1–2 only" }
}
```

Legacy convenience: `POST /v1/tasks/{task_id}/approve` (approve-shaped shortcut).

Both paths audit (**C3**).

---

## SSE stream

`GET /v1/tasks/{task_id}/events`  
`Accept: text/event-stream`  
Scope: `tasks:read`

| `type` | When |
|--------|------|
| `status` | Agentex / task status change |
| `lifecycle` | Queued / running milestones |
| `message` | Agent message (observability, not result source) |
| `hitl` | Approval required |
| `error` | Stream failure |
| `done` | Terminal; includes structured `result` when available |

Example:

```
data: {"type":"status","status":"running"}

data: {"type":"hitl","checkpoint":"architect_plan","workflow_id":"wf-…"}

data: {"type":"done","status":"completed","result":{"pr_url":"https://…","branch":"swarm/…"}}
```

**Forbidden legacy types:** `intent`, `checklist`, `submitted`, `citations` (old Qodex/CoSight shapes).

### Org webhook lifecycle names

| Task status | Webhook event |
|-------------|----------------|
| queued | `task.queued` |
| running | `task.started` |
| waiting_approval | `task.waiting_approval` |
| completed | `task.completed` |
| failed / cancelled / terminated / timeout | `task.failed` |

---

## Client rules

1. Treat `done.result` / `GET /v1/tasks/{id}` as truth (**I3**).
2. Use messages for UX narrative only.
3. On reconnect, re-GET task + hitl; SSE is not a durable log by itself.
4. Future UI: HITL = deterministic cards, not free-form chat approval.
