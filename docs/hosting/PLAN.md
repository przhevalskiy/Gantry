# Gantry — Concrete Hosting Plan

Step-by-step plan for this repo. Ops runbook: [`DEPLOYMENT.md`](../../DEPLOYMENT.md). Deploy invariants: [`apps/web/src/deploy/invariants.ts`](../../apps/web/src/deploy/invariants.ts).

---

## Architecture (fixed split)

| Surface | Repo path | Host | Public URL |
|---------|-----------|------|------------|
| **UI** | `apps/web` → `dist/` | **Vercel** (static SPA) | `https://app.<domain>` |
| **API** | `api/` + systemd | **VPS** (nginx → :8001) | `https://api.<domain>` |
| **Worker** | `worker.py` + systemd | **VPS** | — |
| **Gantry Postgres** (optional) | `DATABASE_URL` | **VPS or managed** | internal only |
| **Agentex cluster** | `deploy/agentex/` *or external* | **Same VPS (bundle) or shared cluster** | optional `https://platform.<domain>` |

Agentex owns Temporal / Redis / Agentex Postgres / Mongo. Gantry does **not** treat those as product microservices — see [`docs/platform/stack-debloat.md`](../platform/stack-debloat.md).

**Modes:** `AGENTEX_MODE=bundle` (default CX22) starts `deploy/agentex/docker-compose.yml`. `AGENTEX_MODE=external` skips compose and attaches via `AGENTEX_BASE_URL` + `TEMPORAL_ADDRESS`.

**Never on Vercel:** API, worker, Temporal, Agentex, secrets, SSE proxy.

**Browser rule:** UI calls `VITE_GANTRY_API_URL` directly (see `apps/web/src/deploy/env.ts`).

---

## Phase 0 — Preconditions (1–2 hours)

Do this before provisioning servers.

- [ ] **Domain** — e.g. `gantry.dev` (or subdomain of existing domain)
- [ ] **GitHub** — repo pushed; decide public vs private
- [ ] **Accounts** — [Vercel](https://vercel.com), [Hetzner](https://console.hetzner.cloud) (or existing VPS)
- [ ] **API keys ready** (store in password manager, not git):
  - `ANTHROPIC_API_KEY`
  - `GH_TOKEN` (classic PAT: `repo`, `pull_requests`) or GitHub App (preferred long-term)
  - Generated: `GITHUB_WEBHOOK_SECRET`, `INTERNAL_API_KEY`, `GANTRY_BOOTSTRAP_TOKEN`

**Repo files to know:**

| File | Purpose |
|------|---------|
| `DEPLOYMENT.md` | Full bootstrap + ops |
| `deploy/setup.sh` | Hetzner one-shot install |
| `deploy/agentex/docker-compose.yml` | Agentex dependency stack (bundle mode) |
| `deploy/nginx.conf` | TLS reverse proxy template |
| `.env.production.example` | VPS env template |
| `apps/web/.env.example` | Vercel env template |
| `apps/web/vercel.json` | SPA build + rewrites |

---

## Phase 1 — Staging (half day)

Goal: **one real URL for UI + one for API**, one task submitted end-to-end.

### 1A. VPS (API + worker + Agentex)

1. Create Hetzner **CX22** (Ubuntu 22.04), note `<SERVER_IP>`.
2. DNS (can use staging subdomains first):

   | Type | Name | Value |
   |------|------|-------|
   | A | `api.staging.<domain>` | `<SERVER_IP>` |
   | A | `platform.staging.<domain>` | `<SERVER_IP>` |

3. Bootstrap:

   ```bash
   ssh root@<SERVER_IP>
   REPO_URL=https://github.com/<org>/Gantry.git \
   DOMAIN_API=api.staging.<domain> \
   DOMAIN_PLATFORM=platform.staging.<domain> \
   EMAIL_CERTBOT=ops@<domain> \
   bash deploy/setup.sh
   ```

4. Configure env on server:

   ```bash
   ssh gantry@<SERVER_IP>
   cp /opt/gantry/.env.production.example /opt/gantry/.env   # if not already
   nano /opt/gantry/.env
   sudo systemctl restart gantry-api gantry-worker
   ```

   **Minimum staging `.env`:**

   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   GH_TOKEN=ghp_...
   GITHUB_WEBHOOK_SECRET=<openssl rand -hex 32>
   INTERNAL_API_KEY=<openssl rand -hex 32>
   GANTRY_WEB_URL=https://<vercel-preview-or-staging-app-url>
   GANTRY_CORS_ORIGINS=https://<vercel-preview-or-staging-app-url>
   AGENTEX_BASE_URL=http://localhost:5003
   TEMPORAL_ADDRESS=localhost:7233
   GANTRY_AGENT_NAME=swarm-factory
   GANTRY_HOME=/opt/gantry/.gantry
   # Staging can skip DATABASE_URL initially (file-backed keys); prod should set it.
   ```

5. Smoke test:

   ```bash
   curl -sf https://api.staging.<domain>/health
   bash deploy/smoke.sh https://api.staging.<domain>
   ```

### 1B. Vercel (UI)

1. [vercel.com/new](https://vercel.com/new) → Import GitHub repo.
2. **Root Directory:** `apps/web`
3. **Framework:** Vite (auto from `vercel.json`)
4. **Environment variables** (Preview + Production):

   | Variable | Value |
   |----------|-------|
   | `VITE_GANTRY_API_URL` | `https://api.staging.<domain>` |

   Do **not** set `VITE_GANTRY_DEV_AUTH_BYPASS` on Vercel.

5. Deploy → note preview URL (e.g. `gantry-xxx.vercel.app`).
6. Update VPS `.env`: set `GANTRY_WEB_URL` and `GANTRY_CORS_ORIGINS` to the Vercel URL(s), comma-separated if preview + custom domain.
7. `sudo systemctl restart gantry-api`

### 1C. First API key + UI login

```bash
# On VPS (or via bootstrap token if configured)
curl -s -X POST http://localhost:8001/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"staging"}' | jq .
```

Paste `gantry_*` key in UI → Account settings (or localStorage flow your auth uses).

### 1D. End-to-end acceptance

- [ ] Open Vercel URL → `/runs/new` loads
- [ ] Submit a small greenfield goal
- [ ] Task appears in sidebar; run stream connects (SSE to API)
- [ ] Worker logs show activity: `sudo journalctl -u gantry-worker -f`

---

## Phase 2 — Production hardening (before public launch)

### DNS (production)

| Type | Name | Target |
|------|------|--------|
| A | `api.<domain>` | VPS IP |
| A | `platform.<domain>` | VPS IP |
| CNAME | `app.<domain>` | Vercel (from Vercel domain settings) |

### Vercel production env

| Variable | Production value |
|----------|------------------|
| `VITE_GANTRY_API_URL` | `https://api.<domain>` |

Point custom domain `app.<domain>` in Vercel.

### VPS production env (add to `.env`)

```bash
GANTRY_WEB_URL=https://app.<domain>
GANTRY_CORS_ORIGINS=https://app.<domain>,https://*.vercel.app
DATABASE_URL=postgresql://...
GANTRY_BOOTSTRAP_TOKEN=<strong random>
GANTRY_SECRETS_KEY=<Fernet key>
# GANTRY_DEV_AUTH_BYPASS unset / false
```

CORS is enforced in `api/main.py` via `GANTRY_CORS_ORIGINS` (see `api/config.py`).

### GitHub

- [ ] Webhook → `https://api.<domain>/github/webhook` (optional for Issues automation)
- [ ] GitHub App install (preferred over org-wide PAT)

### CI (this repo)

Workflow: `.github/workflows/hosting-check.yml`

- On PR / push to `main`: `apps/web` production build + `scripts/release_gate.sh` subset
- Blocks merges that break Vercel build or deploy invariants

Optional later: Vercel Git integration auto-deploys on merge to `main`.

---

## Phase 3 — Scale (when CX22 is tight)

Signals: worker queue backlog, agent timeouts, RAM > 85% sustained.

| Step | Action |
|------|--------|
| 1 | Resize VPS → CX32 |
| 2 | Move Postgres to managed DB; set `DATABASE_URL` |
| 3 | Split worker onto second VM or use `deploy/helm/gantry/` on K8s |
| 4 | Keep UI on Vercel — no change |

---

## Environment matrix

| Variable | Where | Required prod | Notes |
|----------|-------|---------------|-------|
| `VITE_GANTRY_API_URL` | Vercel | ✅ | Public API origin |
| `VITE_GANTRY_DEV_AUTH_BYPASS` | Vercel | ❌ forbidden | Local only |
| `ANTHROPIC_API_KEY` | VPS `.env` | ✅ | Worker LLM |
| `GH_TOKEN` or GitHub App | VPS `.env` | ✅ | PRs / repo ops |
| `GITHUB_WEBHOOK_SECRET` | VPS `.env` | optional | Issues webhook |
| `INTERNAL_API_KEY` | VPS `.env` | ✅ | `/internal/*` |
| `GANTRY_WEB_URL` | VPS `.env` | ✅ | OAuth redirects, CORS default |
| `GANTRY_CORS_ORIGINS` | VPS `.env` | ✅ prod | Comma-separated UI origins |
| `DATABASE_URL` | VPS `.env` | ✅ multi-user | Postgres |
| `GANTRY_BOOTSTRAP_TOKEN` | VPS `.env` | recommended | First key creation |
| `GANTRY_DEV_AUTH_BYPASS` | VPS `.env` | ❌ forbidden | `./dev.sh` only |

---

## Verification checklist (copy before go-live)

```bash
# Local (before push)
bash scripts/hosting-check.sh

# API on VPS
curl -sf https://api.<domain>/health
bash deploy/smoke.sh https://api.<domain>

# After Vercel deploy — on VPS
bash deploy/configure-ui-origin.sh https://<your-vercel-url>
sudo systemctl restart gantry-api

# First API key — on VPS
bash deploy/bootstrap-api-key.sh staging

# CORS (should include Access-Control-Allow-Origin for app origin)
curl -sI -X OPTIONS https://api.<domain>/v1/tasks \
  -H 'Origin: https://app.<domain>' \
  -H 'Access-Control-Request-Method: POST' | rg -i 'access-control'

# UI build invariants
cd apps/web && npm run build

# Full gate (local, with venv)
./scripts/release_gate.sh
```

---

## What not to do

- Put FastAPI or worker on Vercel serverless
- Proxy `/v1` through `vercel.json` rewrites
- Commit `.env` or API keys
- Enable `GANTRY_DEV_AUTH_BYPASS` on staging/production VPS or Vercel
- Use `allow_origins=["*"]` with credentials in production (fixed in `api/main.py`)

---

## Suggested timeline

| Week | Milestone |
|------|-----------|
| 1 | Phase 0 + Phase 1A (VPS staging API healthy) |
| 1 | Phase 1B–1D (Vercel + one E2E task) |
| 2 | Phase 2 (custom domain, CORS lock, DATABASE_URL, bootstrap token) |
| 3+ | Phase 3 as needed |

Next action: **run Phase 1A** with your real domain and paste the Vercel preview URL into `GANTRY_CORS_ORIGINS`.
