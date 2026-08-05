# GitHub App Integration

Install the Gantry GitHub App once per org — tasks and issue triggers use short-lived installation tokens instead of stored PATs.

---

## Why App over PAT

| PAT-per-task | GitHub App |
|---|---|
| Each engineer or secret rotation | Install once per org |
| Broad scopes, long-lived | Repo-scoped, hourly tokens |
| Stored in org secrets | Minted server-side on demand |

PAT remains supported as fallback for local dev and early adopters.

---

## Step 1 — Register the GitHub App

At [github.com/settings/apps/new](https://github.com/settings/apps/new):

| Setting | Value |
|---|---|
| **Setup URL** | `https://api.gantry.dev/v1/integrations/github/setup` |
| **Webhook URL** | `https://api.gantry.dev/v1/integrations/github/webhook` |
| **Permissions** | Contents: Read & write · Pull requests: Read & write · Issues: Read & write |
| **Subscribe to events** | Issues, Installation, Installation repositories |

Generate a private key and set on the API:

```bash
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=gantry
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_APP_WEBHOOK_SECRET=whsec_...
GANTRY_PUBLIC_URL=https://api.gantry.dev
```

---

## Step 2 — Install for your org

```bash
export GANTRY_API_KEY=gantry_...

curl http://localhost:8001/v1/integrations/github/install \
  -H "Authorization: Bearer $GANTRY_API_KEY"
```

Open the returned `install_url` in a browser. After install, GitHub redirects to the setup URL and links the installation to your Gantry org.

Verify:

```bash
curl http://localhost:8001/v1/integrations/github/installations \
  -H "Authorization: Bearer $GANTRY_API_KEY"
```

---

## Step 3 — Submit tasks (no PAT required)

Link a project to GitHub as usual:

```bash
curl -X POST http://localhost:8001/v1/projects \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "payments", "github_url": "https://github.com/acme/payments"}'
```

Submit a task — Gantry resolves an installation token automatically:

```bash
curl -X POST http://localhost:8001/v1/tasks \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"goal": "Add health check endpoint", "project_id": "<id>"}'
```

Token resolution order:

1. Explicit `github_token` on the request
2. `github_token_secret` org secret
3. **GitHub App installation token** for the project's repo
4. Global `GH_TOKEN` env var

---

## Issue triggers

Same as before — label an issue `gantry`. The webhook handler uses the App token for issue comments when available.

See also: [`github-issues.md`](github-issues.md)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `GitHub App not configured` | Set `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` |
| Task runs but can't push | Repo not in App installation — add repo on GitHub or use "All repositories" |
| Setup redirect fails | Check `GANTRY_PUBLIC_URL` matches your API host |
| `installation not linked` | Complete install via `/install` URL (includes signed state) |
