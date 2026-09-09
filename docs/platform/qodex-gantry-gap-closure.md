# Qodex UI ↔ Gantry backend — gap closure plan

**Status:** Complete (2026-09-09)  
**Scope:** Close integration gaps between `apps/web` (Gantry web shell) and Gantry `:8001` `/v1/*`.

## Invariants (must hold)

| ID | Rule |
|----|------|
| **M1** | No Qodex domain backend — no Hive, GA4/GSC, MarComms/VDR intake, CoSight |
| **M2** | UI talks only to Gantry `/v1/*` (+ `/health`); no Qodex `:8000` |
| **M3** | Gantry SSE emits generic types only; UI adapter maps → Qodex stream UX |
| **M6** | Vercel serves static `apps/web` only |

## Gap matrix

| Gap | Phase | Fix | Acceptance |
|-----|-------|-----|------------|
| HITL checklist submits new task | G1 | Approve/Reject → `POST /v1/tasks/{id}/hitl` | Checkpoint unblocks without new `POST /v1/tasks` |
| Hubspace fields ignored | G2 | Form → `name` + `github_url`; drop Qodex locks | Create/update hits Gantry with repo URL |
| MarComms copy in UI | G3 | Factory starters + generic checklist labels | M1 grep clean in `apps/web/src` |
| Discussions not linked to runs | G4 | `task_id` on discussion; run detail route | `/runs/:id` shows task status |
| Supabase required at boot | G5 | Optional when `VITE_GANTRY_PLATFORM=true` | Build/run without Supabase env |
| Attachments/files throw | G6 | Graceful disabled state | Upload shows message, no crash |
| No factory nav | G7 | `/runs/:taskId` + link from chat | User can open run after submit |
| Docs drift | G8 | Update sse-events consumer path | Docs match `gantry/` adapter |

## Phases

### G1 — HITL wiring

- Store `task_id` on discussion when task submitted
- `ChecklistMessage` with `intent=factory_hitl` → Approve/Reject calls `gantryClient.hitl`
- Do **not** route HITL buttons through `sendMessage`

### G2 — Hubspace → Gantry projects

- `Project.github_url` mapped from Gantry API
- `CreateProjectModal`: name + GitHub URL (+ optional local notes)
- Remove MarComms request-type picker from create flow

### G3 — Factory semantics (UI copy)

- Replace `sampleQuestions`, ChatArea quick actions with factory goal starters
- Generic checklist labels (checkpoint, workflow, description)
- Empty-state copy: each chat message starts one factory run

### G4 — Discussion ↔ task persistence

- `Discussion.task_id` in localStorage store
- `discussionLocal` syncs task id on submit
- Run detail page reads `GET /v1/tasks/{id}`

### G5 — Deploy hardening

- `supabase.ts`: no throw when Gantry platform mode without env vars
- `.env.example`: Supabase commented optional

### G6 — Attachments / project files

- Return empty list; upload shows inline “not available on Gantry yet”
- Hide or disable upload controls where needed

### G7 — Factory run route

- `GET /runs/:taskId` — status, PR link, reconnect SSE
- Submitted banner in chat links to run page

### G8 — Verification

```bash
bash scripts/release_gate.sh
rg -i "hive_api|ga4_property|show_checklist|marcomms|web_services" apps/web/src && exit 1 || true
cd apps/web && npm run build
```

## Out of scope (explicit)

- Legacy LLM conversational layer before factory submit (would need new backend surface)
- Cross-device discussion sync (would need public `/v1/discussions` — not M2 minimal)
- CoSight / analytics dashboards
- Reintroducing Qodex `:8000`

## Release gate

All phases must pass `scripts/release_gate.sh` and M1 grep on `apps/web/src`.
