# Frontend structure — greenfield scaffold

**Status:** Canonical tree for `apps/web` restart. Structure only — no feature fill until slices are approved.  
**Wireframe reference:** Manus-class shell (sidebar + sky stage + composer) — **geometry stolen; product story remapped to firm.**  
**Locks:** [`../brand/frontend-greenfield.md`](../brand/frontend-greenfield.md) · [`../brand/voice-and-look.md`](../brand/voice-and-look.md) · [`../brand/frontend-agent-representation.md`](../brand/frontend-agent-representation.md) · [`frontend-architecture.md`](./frontend-architecture.md)

---

## Product IA (wireframe → firm)

| Wireframe | Gantry surface | Backend |
|-----------|----------------|---------|
| New task | **New run** (compose home) | `POST /v1/tasks` |
| (home composer) | Work-order entry → opens engagement | tasks + SSE |
| Agent → “Deploy your agent…” | **Refused** — not a bot deploy product | — |
| — | **Team** (Operators directory) | `GET /v1/agents` |
| Skills | **Briefs** (playbooks) | `/v1/playbooks` |
| Plugins / Scheduled | **Deferred** (v0 nav omits) | — |
| Library | Folded into **Runs** for v0 | `GET /v1/tasks` |
| Projects | **Projects** (workspaces/repos) | `/v1/projects` |
| Tasks list | **Runs** (matters) | `/v1/tasks` |
| — | **Practices** (firm packs) | `/v1/packs` |

Experience target: **messaging-first engagement** (Foreman chat + floor + HITL cards + artifact), not a tabbed ops console, not messenger-agent deploy.

---

## Exact tree

```
apps/web/
├── README.md                 # FE-only run notes
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── index.html
├── .env.example              # VITE_GANTRY_API_URL
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx              # bootstrap
    ├── App.tsx               # router + shell
    ├── vite-env.d.ts
    ├── design/
    │   ├── tokens.css        # firm tokens (lavender shell, Albert Sans, CTA)
    │   └── global.css
    ├── lib/
    │   └── paths.ts          # route path constants
    ├── shell/
    │   ├── AppShell.tsx      # sidebar + atmosphere stage
    │   ├── Sidebar.tsx
    │   ├── SidebarNav.tsx    # New run / Runs / Practices / Team / Briefs / Projects
    │   ├── UserChip.tsx
    │   └── Atmosphere.tsx    # sky / gradient backdrop (wireframe mood)
    ├── routes/
    │   ├── ComposeHome.tsx   # “file a work order” empty state + composer
    │   ├── Engagement.tsx    # active matter (messaging) — stub
    │   ├── Runs.tsx          # matter list — stub
    │   ├── Practices.tsx     # pack catalog — stub (not deploy-agent)
    │   ├── Team.tsx          # Operator directory — stub
    │   ├── Briefs.tsx        # playbooks — stub
    │   └── Projects.tsx      # workspaces — stub
    ├── modules/
    │   ├── composer/         # work-order input + suggestion chips
    │   │   ├── Composer.tsx
    │   │   └── SuggestionChips.tsx
    │   ├── engagement-floor/ # Operator portraits (later)
    │   │   └── index.ts
    │   ├── stream/           # SSE / bubbles (later)
    │   │   └── index.ts
    │   ├── hitl/             # partner approval cards (later)
    │   │   └── index.ts
    │   └── artifacts/        # deliverable climax (later)
    │       └── index.ts
    └── services/
        └── gantry/
            ├── client.ts     # thin /v1 fetch (no orchestration)
            └── types.ts
```

---

## Route map (v0)

| Path | Screen | Slice status |
|------|--------|--------------|
| `/` | ComposeHome — firm greeting + composer | **Scaffold chrome** |
| `/runs` | Runs list | Stub |
| `/runs/:taskId` | Engagement (messaging + floor + HITL) | Stub shell |
| `/practices` | Firm packs | Stub |
| `/team` | Operators | Stub |
| `/briefs` | Playbooks | Stub |
| `/projects` | Projects / workspaces | Stub |

---

## What this scaffold includes

- Vite + React + TypeScript app under `apps/web`
- App shell matching wireframe geometry (sidebar + **grooved** center stage + composer home)
- Lucide icons only (no emoji in UI chrome)
- Input bars: `--input-padding-inline: 2rem` (+ vertical padding for chrome)
- Design tokens from brand voice/look
- Stub routes with firm copy (no Agent deploy landing)
- Thin `services/gantry` placeholder pointing at `VITE_GANTRY_API_URL`

## What this scaffold explicitly does **not** include

- Live task submit / SSE / HITL wiring (next slices)
- Operator portrait art kit
- Auth/billing (“Free plan”) beyond placeholder chrome
- Messenger deploy / Skills marketplace / Plugins nav
- Resurrected deleted console/messaging code

---

## Slice order (after structure lands)

1. ComposeHome polish + `POST /v1/tasks` submit  
2. Engagement thread + `GET …/events` SSE  
3. HITL cards → `POST …/hitl`  
4. Engagement floor portraits  
5. Practices / Team / Briefs read-only catalogs  
6. Artifact climax from `result`

Every slice talks only to `/v1/*` (I8).
