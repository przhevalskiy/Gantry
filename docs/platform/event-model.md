# Event model and status sync

Gantry uses a **push-primary** event model. Integrators should rely on structured
`GET /v1/tasks/{id}` results (Invariant I3), not agent chat messages.

## Current architecture

```
Worker db_notify_task_status / db_upsert_build
        →  Gantry API (/internal/db/…)
        →  api_tasks + builds + org webhooks + SSE consumers

Fallback poller (60s, optional)
        →  Agentex GET /tasks/{id} only when push was missed
```

| Path | Role | Status |
|------|------|--------|
| `db_upsert_build` activity | Primary — writes `pr_url`, `branch`, `result` JSON + terminal lifecycle | **Preferred (I3)** |
| `db_notify_task_status` activity | Primary — `running` / `waiting_approval` / `failed` push | **Preferred** |
| `api/services/poller.py` | Slow safety net (`GANTRY_STATUS_POLLER=fallback`, default 60s) | Fallback only |
| Message scrape | Fallback when structured write missing | **Legacy only** |

## Structured results (I3)

On pipeline completion the Foreman calls `POST /internal/db/builds` with:

```json
{
  "pr_url": "https://github.com/org/repo/pull/42",
  "branch": "swarm/task-id",
  "result": { "pr_url": "...", "branch": "...", "quality_score": 8.5 }
}
```

That route also runs `task_sync.apply_status_update` so org/task webhooks fire without waiting for the poller.

`GET /v1/tasks/{id}` and SSE `done` events read from `builds` + `api_tasks` first.

## Intermediate lifecycle

Foreman pushes:

- `running` on task start (and after HITL resume)
- `waiting_approval` at HITL checkpoints
- `failed` on repo-setup failure or rejected approval

Endpoint: `POST /internal/db/tasks/{task_id}/status` (internal key).

## SSE (`GET /v1/tasks/{id}/events`)

The SSE endpoint remains a **polling adapter** for Agentex *messages* (streamed agent text). Lifecycle/status should already be on the Gantry task record via push.

See also: [`sse-events.md`](sse-events.md).

## Poller knobs

| Env | Default | Meaning |
|-----|---------|---------|
| `GANTRY_STATUS_POLLER` | `fallback` | `fallback` \| `off` \| `legacy` (10s debug) |
| `GANTRY_STATUS_POLL_INTERVAL` | `60` (fallback) / `10` (legacy) | Seconds |

Ensure `GANTRY_API_URL` is reachable from the worker so push succeeds — that is the canonical result path.
