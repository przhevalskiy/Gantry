# Linear Integration

Label a Linear issue with `gantry` → Gantry submits a task → org webhook fires with PR result.

---

## Prerequisites

1. Gantry API reachable (e.g. `https://api.gantry.dev`)
2. A Gantry project linked to your Linear team
3. Optional: `LINEAR_WEBHOOK_SECRET` set on the API for signature verification

---

## Step 1 — Link the Linear team

```bash
export GANTRY_API_KEY=gantry_...

curl -X PATCH http://localhost:8001/v1/projects/{project_id} \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "linear_team_id": "YOUR_LINEAR_TEAM_UUID"
  }'
```

Find the team UUID in Linear → Settings → Teams, or from any issue payload under `team.id`.

---

## Step 2 — Configure Linear webhook

In Linear → Settings → API → Webhooks:

| Field | Value |
|---|---|
| URL | `https://api.gantry.dev/v1/integrations/linear/webhook` |
| Events | Issues (create + update) |
| Signing secret | Same value as `LINEAR_WEBHOOK_SECRET` on Gantry |

---

## Step 3 — Trigger a build

Add the label **`gantry`** to any issue in the linked team. Gantry ignores issues without that label.

Response (202):

```json
{
  "ok": true,
  "task_id": "task_abc123",
  "linear_issue": "ENG-42"
}
```

Poll task status or listen on your org webhook (`task.completed` / `task.failed`).

---

## Pipeline overrides

Per-task pipeline config is available via `POST /v1/tasks` (see `docs/api.md`). Linear webhooks use project defaults; customize tier/agents on the API if needed.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `"No Gantry project linked to Linear team …"` | Set `linear_team_id` on the project |
| 401 Invalid signature | Match `LINEAR_WEBHOOK_SECRET` on both sides |
| Issue ignored | Confirm the `gantry` label is present |
