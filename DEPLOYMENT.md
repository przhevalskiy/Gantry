# Monolift — Deployment Checklist

Production stack: **Vercel** (UI, free) + **Hetzner CX22** (API, worker, Agentex, Temporal — $4.50/mo)

---

## 1. Prerequisites (one-time accounts)

- [ ] **Hetzner account** — [console.hetzner.cloud](https://console.hetzner.cloud)
- [ ] **Vercel account** — [vercel.com](https://vercel.com) (sign in with GitHub)
- [ ] **Domain** — buy `monolift.dev` on Namecheap / Cloudflare / wherever
- [ ] **GitHub repo** — ensure this repo is pushed and set to the visibility you want

---

## 2. Hetzner — Provision Server

1. Create new project: `monolift-prod`
2. Create server:
   - **Location**: Falkenstein or Helsinki (lower latency to EU)
   - **Image**: Ubuntu 22.04
   - **Type**: CX22 (2 vCPU, 4 GB RAM) — upgrade to CX32 if agents start timing out
   - **SSH key**: add your public key (`~/.ssh/id_ed25519.pub`)
   - **Name**: `monolift-prod`
3. Note the public IPv4 address (call it `<SERVER_IP>`)

---

## 3. DNS Records

In your domain registrar / DNS provider, add:

| Type | Name                  | Value          |
|------|-----------------------|----------------|
| A    | `api.monolift.dev`    | `<SERVER_IP>`  |
| A    | `platform.monolift.dev` | `<SERVER_IP>` |
| A    | `app.monolift.dev`    | (Vercel — auto-set in step 6) |

DNS propagation takes 0–30 minutes.

---

## 4. Bootstrap the Hetzner Server

SSH in and run the setup script:

```bash
ssh root@<SERVER_IP>

# Option A — if the repo is public:
REPO_URL=https://github.com/YOUR_ORG/monolift.git \
DOMAIN_API=api.monolift.dev \
DOMAIN_PLATFORM=platform.monolift.dev \
EMAIL_CERTBOT=ops@monolift.dev \
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/monolift/main/deploy/setup.sh)

# Option B — copy script manually:
scp deploy/setup.sh root@<SERVER_IP>:~/
ssh root@<SERVER_IP> \
  REPO_URL=https://github.com/YOUR_ORG/monolift.git bash setup.sh
```

The script will:
- Install Docker, Python 3.12, uv, nginx, certbot
- Create `monolift` system user
- Clone the repo to `/opt/monolift`
- Set up Python virtualenv and install dependencies
- Start Agentex Docker stack (Temporal, Redis, Postgres, MongoDB)
- Install and enable `gantry-api` and `gantry-worker` systemd services
- Configure nginx with SSL via Let's Encrypt
- Enable UFW firewall (SSH + HTTPS only)

---

## 5. Configure Environment Variables

The script copies `.env.production.example` to `/opt/monolift/.env` if no `.env` exists. Fill it in:

```bash
ssh monolift@<SERVER_IP>
nano /opt/monolift/.env
```

Required values to fill in:

| Variable | How to get it |
|----------|---------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API keys |
| `GH_TOKEN` | GitHub → Settings → Developer settings → PAT (classic), scopes: `repo`, `issues`, `pull_requests` |
| `GITHUB_WEBHOOK_SECRET` | Run: `openssl rand -hex 32` |
| `INTERNAL_API_KEY` | Run: `openssl rand -hex 32` |

After editing:

```bash
sudo systemctl restart gantry-api gantry-worker
```

Verify:

```bash
sudo systemctl status gantry-api
sudo systemctl status gantry-worker
curl https://api.monolift.dev/health
```

---

## 6. Vercel — Deploy the UI

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repo
3. Set **Root Directory** to `apps/web`
4. Set **Framework Preset** to `Vite`
5. Add environment variables (Settings → Environment Variables):

| Variable | Value |
|----------|-------|
| `VITE_GANTRY_API_URL` | `https://api.monolift.dev` |

6. Click **Deploy**
7. Add custom domain: `app.monolift.dev`
   - Vercel will give you DNS records to add (usually a CNAME)
   - SSL is automatic

Local dev UI: `cd apps/web && npm run dev` (Vite `:5173`, proxies `/v1` → API).

---

## 7. GitHub Webhook (for Issues → auto-PR)

In the GitHub repo you want to wire up:

1. Settings → Webhooks → Add webhook
2. **Payload URL**: `https://api.monolift.dev/github/webhook`
3. **Content type**: `application/json`
4. **Secret**: same value as `GITHUB_WEBHOOK_SECRET` in `.env`
5. **Events**: select "Issues" (and optionally "Issue comments")
6. Click **Add webhook**

Test it: add the `gantry` label to any open issue. Within ~30 seconds a comment should appear.

---

## 8. Create First API Key

SSH into the server and create a key:

```bash
ssh monolift@<SERVER_IP>
curl -s -X POST http://localhost:8001/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "my-first-key"}' | jq .
```

Copy the returned `key` value — it's shown only once.

---

## 9. Smoke Test

```bash
# Health
curl https://api.monolift.dev/health

# Swagger UI
open https://api.monolift.dev/docs

# Submit a task
curl -X POST https://api.monolift.dev/tasks \
  -H "Authorization: Bearer gantry_<your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add a hello-world endpoint to FastAPI",
    "project_id": "proj_test",
    "github_owner": "YOUR_ORG",
    "github_repo": "test-repo"
  }' | jq .
```

---

## 10. Ongoing Operations

### View logs

```bash
sudo journalctl -u gantry-api -f
sudo journalctl -u gantry-worker -f
docker compose -f /opt/monolift/deploy/docker-compose.prod.yml logs -f agentex
```

### Deploy a new version

```bash
ssh monolift@<SERVER_IP>
cd /opt/monolift
git pull
source .venv/bin/activate
uv pip install -e '.[api]' --quiet
sudo systemctl restart gantry-api gantry-worker
```

### Restart Agentex stack

```bash
ssh monolift@<SERVER_IP>
docker compose -f /opt/monolift/deploy/docker-compose.prod.yml restart
```

### Renew SSL (auto via cron, but manually if needed)

```bash
sudo certbot renew --dry-run
```

---

## Architecture Reference

```
Browser / API clients
        │
        ▼
  Vercel (free)                    Hetzner CX22 ($4.50/mo)
  ┌──────────────┐                 ┌────────────────────────────────────┐
  │  Next.js UI  │ ──HTTPS──────▶ │  nginx (SSL)                       │
  │  app.mono..  │                 │    api.monolift.dev  → :8001        │
  └──────────────┘                 │    platform.mono..  → :5003        │
                                   │                                    │
                                   │  gantry-api (systemd)   :8001      │
                                   │  gantry-worker (systemd)           │
                                   │                                    │
                                   │  Docker:                           │
                                   │    agentex          :5003          │
                                   │    temporal         :7233          │
                                   │    postgres         :5432          │
                                   │    mongodb          :27017         │
                                   │    redis            :6379          │
                                   └────────────────────────────────────┘
```
