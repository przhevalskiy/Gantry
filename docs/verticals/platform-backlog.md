# Platform backlog vertical (V-PLAT)

**Horizontal:** H-BULK, H-PAR, H-CON, H-ORA, H-HEAL, H-DUR, H-SSE

## Job

Drain a labeled backlog of small, scoped engineering tasks into isolated PRs.

## Playbook

Submit with `playbook: "platform-backlog"`:

```json
{
  "goal": "Fix N+1 query in project list",
  "project_id": "...",
  "playbook": "platform-backlog"
}
```

Defaults: tier 1, branch prefix `backlog`, 1 parallel track, 1 heal cycle.

## Bulk

```bash
curl -X POST http://localhost:8001/v1/tasks/bulk \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "...",
    "playbook": "platform-backlog",
    "tasks": [
      {"goal": "Add index on api_tasks.org_id"},
      {"goal": "Bump ruff in pyproject.toml"}
    ]
  }'
```

## Triggers

- GitHub label `gantry` → webhook (existing)
- Linear/Jira label `gantry` → integration webhooks

## Success metric

Partial bulk success with structured `result.pr_url` per task (I3).
