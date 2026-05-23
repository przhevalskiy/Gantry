# GitHub Issues Integration

Label any GitHub issue `gantry` and Monolift opens a PR. No code required.

---

## How it works

1. You add the `gantry` label to an open issue
2. Monolift reads the issue title + body as the engineering goal
3. The swarm runs — PM, Architect, Builders, Inspector, Security, DevOps
4. A PR opens on your repo
5. Monolift comments on the issue with the PR link
6. Remove the `gantry` label at any point to terminate the running task

---

## Prerequisites

- A Monolift account with an API key
- A Monolift project linked to your GitHub repo (see step 1)
- Admin access to the GitHub repo (to add webhooks)

---

## Step 1 — Link your repo to a Monolift project

If you haven't created a project yet:

```bash
curl -X POST https://api.monolift.dev/v1/projects \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "github_url": "https://github.com/your-org/your-repo"
  }'
```

Note the `id` field in the response — you'll need it to verify the link is correct.

---

## Step 2 — Register the GitHub webhook

In your GitHub repo: **Settings → Webhooks → Add webhook**

| Field | Value |
|---|---|
| Payload URL | `https://api.monolift.dev/v1/integrations/github/webhook` |
| Content type | `application/json` |
| Secret | Your `GITHUB_WEBHOOK_SECRET` value (same as on the server) |
| Events | Select **"Let me select individual events"** → check **Issues** only |
| Active | ✓ |

Click **Add webhook**. GitHub will send a ping — you should see a green checkmark.

---

## Step 3 — Create the `gantry` label

In your repo: **Issues → Labels → New label**

- Name: `gantry`
- Color: pick anything (suggestion: `#0075ca`)

---

## Step 4 — Test it

1. Open any issue in your repo (or create one: "Add a /healthz endpoint")
2. Add the `gantry` label
3. Within 30 seconds, a bot comment appears: *"Gantry picked this up — task `xyz` is running"*
4. When the PR opens (typically 5–20 minutes depending on complexity), a second comment appears: *"✅ Done — PR opened: https://github.com/..."*

---

## What makes a good issue

The issue title + body becomes the engineering goal verbatim. The more specific, the better.

**Good:**
```
Add rate limiting to POST /v1/tasks

Use a sliding window algorithm, 60 requests/minute per API key.
Store counts in Redis. Return 429 with Retry-After header.
```

**Too vague:**
```
Improve the API
```

**Good:**
```
Fix the bug where removing the gantry label doesn't terminate the workflow

Steps to reproduce:
1. Label an issue gantry
2. Wait for the "task is running" comment
3. Remove the label
4. Task keeps running in the Monolift dashboard
```

---

## Troubleshooting

**No comment appears after labeling**

- Check the webhook delivery log: GitHub repo → Settings → Webhooks → click the webhook → Recent Deliveries
- A 401 means the webhook secret is wrong — regenerate it and update both GitHub and `/opt/monolift/.env`
- A 502 means the Monolift API is down — check `sudo systemctl status gantry-api` on the server

**"No Gantry project linked" in the webhook response**

The project's `github_owner`/`github_repo` doesn't match the repo sending the event. Verify:

```bash
curl https://api.monolift.dev/v1/projects \
  -H "Authorization: Bearer $GANTRY_API_KEY" | jq '.projects[] | {id, name, github_owner, github_repo}'
```

Update if needed:

```bash
curl -X PATCH https://api.monolift.dev/v1/projects/<project_id> \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"github_url": "https://github.com/correct-org/correct-repo"}'
```

**Task runs but no PR is opened**

Check the Monolift dashboard for the task — the agent feed will show where it stopped. Common causes:
- The repo's default branch is protected and the bot's GitHub token doesn't have push access
- The GH_TOKEN on the server doesn't have `repo` scope — regenerate with full `repo` permissions

**PR opens but no second comment on the issue**

The poller runs every 10 seconds. Wait up to 20 seconds after the PR opens. If still nothing, check:

```bash
sudo journalctl -u gantry-worker -n 50
```

Look for `github_callback_posted` or `github_callback_failed` log lines.

---

## Supported events

| Event | Action | Monolift behavior |
|---|---|---|
| `issues` | `labeled` with `gantry` | Submit task, post start comment |
| `issues` | `unlabeled` with `gantry` | Terminate running task |
| All others | — | Ignored (returns `202 ok`) |

---

## Security

- All incoming webhooks are verified with `HMAC-SHA256` against `GITHUB_WEBHOOK_SECRET`
- The bot uses `GH_TOKEN` (your PAT) to post comments — it acts as your GitHub account
- Tasks run in an isolated Temporal workflow — if the workflow crashes, it does not affect your repo
