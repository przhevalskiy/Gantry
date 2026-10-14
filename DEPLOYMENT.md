# Gantry — Deployment (API + worker)

Production surface is the **Gantry API + Temporal worker** on a VPS (or cluster), talking to an **Agentex** stack (Temporal / Redis / Agentex DB). There is **no in-repo static UI** and no third-party SPA hosting for a product frontend.

Architecture: [`docs/architecture.md`](docs/architecture.md) · Cluster join: [`docs/platform/agentex-cluster.md`](docs/platform/agentex-cluster.md)

---

## 1. Prerequisites

- [ ] VPS or Kubernetes (e.g. Hetzner Ubuntu 22.04+)
- [ ] Domain for API (e.g. `api.example.com`)
- [ ] Anthropic (or configured) LLM credentials for the worker
- [ ] GitHub App or PAT for repo access
- [ ] Agentex available (bundled on same host or external)

---

## 2. Bootstrap server

```bash
ssh root@<SERVER_IP>
git clone <this-repo> /opt/gantry
cd /opt/gantry
bash deploy/setup.sh
```

Compose reference: `deploy/docker-compose.prod.yml`  
Smoke: `bash deploy/smoke.sh`  
Bootstrap first API key: `bash deploy/bootstrap-api-key.sh`

---

## 3. DNS

| Type | Name | Value |
|------|------|-------|
| A | `api.<domain>` | `<SERVER_IP>` |

TLS via your reverse proxy (Caddy / nginx / Traefik). Point `GANTRY_CORS_ORIGINS` at any future browser clients when they exist.

---

## 4. Required env (sketch)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Gantry Postgres (omit for file fallback in tiny envs — not multi-tenant prod) |
| `AGENTEX_BASE_URL` | Agentex API |
| `TEMPORAL_ADDRESS` | Temporal frontend |
| `GANTRY_AGENT_NAME` | Must be `swarm-factory` (C4) |
| `ANTHROPIC_API_KEY` / org secrets | LLM |
| `GANTRY_BOOTSTRAP_TOKEN` | Optional first-key gate |
| `GANTRY_CORS_ORIGINS` | Browser clients (comma-separated) |

Full matrices live in `deploy/` and Helm values under `deploy/helm/gantry/`.

---

## 5. Helm / Agentex citizen

```yaml
agentex:
  agentName: swarm-factory
```

See [`docs/platform/agentex-cluster.md`](docs/platform/agentex-cluster.md).

---

## 6. Verify

```bash
curl -s https://api.<domain>/health
curl -s https://api.<domain>/status
bash deploy/smoke.sh
bash scripts/release_gate.sh   # from a filled venv
```

---

## 7. What not to deploy from this repo

- No static SPA root directory in this repository
- No Next.js (or other) reverse-proxy in front of `/v1`
- UI, when rebuilt, is a separate optional client of `https://api.<domain>/v1/*` only (I8)
