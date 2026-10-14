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
    │   ├── Engagement.tsx    # active matter — GET task + SSE stream
    │   ├── Runs.tsx          # matter list — stub
    │   ├── Practices.tsx     # pack catalog — stub (not deploy-agent)
    │   ├── Team.tsx          # Operator directory — stub
    │   ├── Briefs.tsx        # playbooks — stub
    │   └── Projects.tsx      # workspaces — stub
    ├── modules/
    │   ├── composer/         # Claude-shaped bar + `+` menu (project/brief)
    │   │   ├── Composer.tsx
    │   │   ├── ComposerMenu.tsx
    │   │   └── SuggestionChips.tsx
    │   ├── auth/
    │   │   └── ApiKeyField.tsx   # sidebar UserChip settings (not hero)
    │   ├── engagement-floor/ # Operator roster rail (slice 4)
    │   │   ├── index.ts
    │   │   ├── EngagementFloor.tsx
    │   │   └── OperatorPortrait.tsx
    │   ├── stream/           # SSE timeline (slice 2)
    │   │   ├── index.ts
    │   │   ├── StreamTimeline.tsx
    │   │   └── useTaskEventStream.ts
    │   ├── hitl/             # partner approval cards (slice 3)
    │   │   ├── index.ts
    │   │   ├── HitlCard.tsx
    │   │   └── HitlPanel.tsx
    │   └── artifacts/        # deliverable climax (slice 6)
    │       ├── index.ts
    │       └── ArtifactClimax.tsx
    └── services/
        └── gantry/
            ├── client.ts     # thin /v1 fetch (no orchestration)
            └── types.ts
```

---

## Route map (v0)

| Path | Screen | Slice status |
|------|--------|--------------|
| `/` | ComposeHome — firm greeting + composer | **Compose bar** — `+` project/brief + `POST /v1/tasks`; API key in sidebar |
| `/runs` | Runs list | **Wired** — `GET /v1/tasks` → Engagement (`?project=` filter) |
| `/runs/:taskId` | Engagement (messaging-first) | **Wired** — Foreman thread + follow-up + inline HITL + compact floor + artifact |
| `/practices` | Firm packs | **Wired** — list + install/enable |
| `/team` | Operators | **Wired** — `GET /v1/agents` + portraits |
| `/briefs` | Playbooks | **Wired** — list + “Use on new run” |
| `/projects` | Projects / workspaces | **Wired** — list/create + link to runs |

---

## What this scaffold includes

- Vite + React + TypeScript app under `apps/web`
- App shell matching wireframe geometry (sidebar + **grooved** center stage + composer home)
- Lucide icons only (no emoji in UI chrome)
- Input bars: compact padding; submit/control size `2rem`
- Design tokens from brand voice/look
- All primary nav routes wired to `/v1/*` (no Agent deploy landing)
- Thin `services/gantry` client pointing at `VITE_GANTRY_API_URL`

## What this scaffold explicitly does **not** include

- Full portrait art kit (`operator-portraits@1`) — CSS silhouette shells for now
- Auth/billing beyond API key in sidebar UserChip
- Messenger deploy / Skills marketplace / Plugins nav
- Resurrected deleted console/messaging code

---

## Slice order (after structure lands)

1. ~~ComposeHome + `POST /v1/tasks` submit~~ **done** (auth key field, project picker, navigate to engagement)  
2. ~~Engagement thread + `GET …/events` SSE~~ **done** (typed stream client + timeline)  
3. ~~HITL cards → `POST …/hitl`~~ **done** (deterministic approve/reject cards)  
4. ~~Engagement floor portraits~~ **done** (CSS silhouette roster + presence)  
5. ~~Practices / Team / Briefs read-only catalogs~~ **done**  
6. ~~Artifact climax from `result`~~ **done**

Every slice talks only to `/v1/*` (I8).
