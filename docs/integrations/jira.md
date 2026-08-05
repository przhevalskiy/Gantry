# Jira Integration

Add label **`gantry`** to a Jira issue → Gantry submits a task → org webhook fires with PR result.

---

## Prerequisites

1. Gantry API reachable (e.g. `https://api.gantry.dev`)
2. A Gantry project linked to your Jira project key (e.g. `ENG`)
3. Optional: `JIRA_WEBHOOK_SECRET` for token verification

---

## Step 1 — Link the Jira project

```bash
export GANTRY_API_KEY=gantry_...

curl -X PATCH http://localhost:8001/v1/projects/{project_id} \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jira_project_key": "ENG"
  }'
```

---

## Step 2 — Configure Jira automation

Create a Jira automation rule (Project settings → Automation):

1. **Trigger:** Issue labeled → `gantry`
2. **Action:** Send web request
   - URL: `https://api.gantry.dev/v1/integrations/jira/webhook`
   - Method: POST
   - Header: `X-Gantry-Jira-Token: <same as JIRA_WEBHOOK_SECRET>`
   - Body: Jira issue JSON (default automation payload works)

---

## Step 3 — Trigger a build

Add the **`gantry`** label to an issue in the linked project.

Response (202):

```json
{
  "ok": true,
  "task_id": "task_abc123",
  "jira_issue": "ENG-42"
}
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `"No Gantry project linked to Jira project …"` | Set `jira_project_key` on the Gantry project |
| 401 Invalid token | Set matching `X-Gantry-Jira-Token` header and `JIRA_WEBHOOK_SECRET` |
| Issue ignored | Confirm the `gantry` label is on the issue |
