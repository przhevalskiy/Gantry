# Gantry Web (`apps/web`)

Gantry web UI — styling, branding, chat layout, and SSE streaming UX — wired to the **Gantry control plane** (`/v1/*` on `:8001`).

## Architecture

```
Browser (Vercel static)  →  Gantry API :8001  →  Agentex / Temporal / worker
```

- **M2:** No Qodex `:8000` backend. Chat submits factory runs via `POST /v1/tasks` and streams `GET /v1/tasks/{id}/events`.
- **Auth:** Gantry API key in localStorage (Profile → Gantry, or connect modal on first visit).
- **Local data:** Discussions and starters are stored in the browser when Gantry mode is on.

## Local dev

From repo root:

```bash
./dev.sh
```

Or separately:

```bash
# Terminal 1 — API on :8001
.venv/bin/uvicorn api.main:app --reload --port 8001

# Terminal 2 — UI on :5173 (proxies /v1 → :8001)
cd apps/web && npm ci && npm run dev
```

Open http://localhost:5173, paste a `gantry_*` API key, create a Hubspace (project), then chat to submit a factory run.

## Environment

Copy `.env.example` to `.env`. In production (Vercel), set:

| Variable | Purpose |
|----------|---------|
| `VITE_GANTRY_PLATFORM` | `true` (default) — Gantry adapter |
| `VITE_GANTRY_API_URL` | Public Gantry API origin, e.g. `https://api.example.com` |

## Verification

All phases complete. Run:

```bash
bash scripts/release_gate.sh
```

See [platform-merge-plan.md](platform-merge-plan.md) for merge invariants.

## Source

UI copied from Qodex `frontend/`; Gantry-specific wiring lives under `src/shared/services/gantry/`.
