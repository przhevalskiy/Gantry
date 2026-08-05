# GitHub Issues Integration

Headless reference integration: label a GitHub issue → Gantry runs the pipeline → PR URL posted back as a comment → org webhook fires with structured result.

No UI required.

---

## Prerequisites

1. Gantry API running and reachable (`http://localhost:8001` locally or `https://api.gantry.dev`)
2. API key with access to a project linked to your GitHub repo
3. GitHub PAT stored as an org secret (recommended) or passed per-task

---

## Step 1 — Link the repo

```bash
export GANTRY_API_KEY=gantry_...

curl -X POST http://localhost:8001/v1/projects \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-service",
    "github_url": "https://github.com/YOUR_ORG/YOUR_REPO"
  }'
```

Save the returned `project.id`.

---

## Step 2 — Store GitHub PAT as org secret

```bash
curl -X POST http://localhost:8001/v1/secrets \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github-pat",
    "value": "ghp_..."
  }'
```

Production: set `GANTRY_SECRETS_KEY` to a Fernet key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Step 3 — Register org webhook (optional)

Receive lifecycle events in your internal system:

```bash
curl -X POST http://localhost:8001/v1/webhooks \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/hooks/gantry",
    "events": [
      "task.queued",
      "task.started",
      "task.waiting_approval",
      "task.completed",
      "task.failed"
    ]
  }'
```

Store the returned `webhook.secret` — verify deliveries with `X-Gantry-Signature`.

Python:

```python
from gantry import verify_webhook_signature

def handle(request):
    body = request.body
    header = request.headers["X-Gantry-Signature"]
    assert verify_webhook_signature(body, header, WEBHOOK_SECRET)
```

---

## Step 4 — Configure GitHub repo webhook

In your GitHub repo → **Settings → Webhooks → Add webhook**:

| Field | Value |
|---|---|
| Payload URL | `https://YOUR_API_HOST/v1/integrations/github/webhook` |
| Content type | `application/json` |
| Secret | Value of `GITHUB_WEBHOOK_SECRET` in Gantry `.env` |
| Events | **Issues** |

---

## Step 5 — Trigger a build

Add the label `gantry` to any issue. Gantry will:

1. Find the project matching `owner/repo`
2. Submit a task with the issue title + body as the goal
3. Comment on the issue when picked up
4. Fire `task.queued` → `task.started` → … → `task.completed` webhooks
5. Comment on the issue with the PR URL when done

---

## GitHub Actions alternative

Use the bundled action instead of issue labels:

```yaml
name: Gantry task
on:
  issues:
    types: [labeled]

jobs:
  build:
    if: github.event.label.name == 'gantry'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/gantry-submit
        with:
          api-key: ${{ secrets.GANTRY_API_KEY }}
          base-url: https://api.gantry.dev
          goal: ${{ github.event.issue.title }}
          project-id: ${{ vars.GANTRY_PROJECT_ID }}
          github-token-secret: github-pat
          wait: "true"
          idempotency-key: issue-${{ github.event.issue.number }}
```

---

## Webhook payload reference

### `task.queued`

```json
{
  "event": "task.queued",
  "task_id": "task_abc",
  "project_id": "proj_...",
  "org_id": "...",
  "source": "github_issues",
  "status": "queued"
}
```

### `task.completed`

```json
{
  "event": "task.completed",
  "task_id": "task_abc",
  "project_id": "proj_...",
  "org_id": "...",
  "source": "github_issues",
  "status": "completed",
  "result": {
    "pr_url": "https://github.com/org/repo/pull/42",
    "branch": "swarm/task_abc"
  }
}
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No Gantry project linked to org/repo` | Create project with matching `github_url` |
| `secret not found: github-pat` | Run `POST /v1/secrets` first |
| Webhook 401 from GitHub | Set matching `GITHUB_WEBHOOK_SECRET` |
| No org webhook received | Register via `POST /v1/webhooks`; check event filters |
| Task stuck in `queued` | Ensure Agentex worker + Temporal are running (`./dev.sh`) |

---

## Phase 1 checkpoint

✓ Issue labeled `gantry` → task submitted → org webhook fires `task.completed` with `result.pr_url` → zero UI interaction.
