# Frontend technical architecture — restart baseline

**Status:** Greenfield scaffold under `apps/web` — structure only; features slice-by-slice.  
**Tree:** [`frontend-structure.md`](./frontend-structure.md)  
**Product direction:** [`../brand/frontend-greenfield.md`](../brand/frontend-greenfield.md)  
**Brand / identity:** [`../brand/README.md`](../brand/README.md) · [`../brand/frontend-agent-representation.md`](../brand/frontend-agent-representation.md)  
**Backend lock:** Phases A–E ([`composable-crew-roadmap.md`](./composable-crew-roadmap.md)) — I1, I7, I8, C1, P1–P4

---

## 1. What stays true without a UI

The product is the **firm’s control plane** (API-first). UI is optional (I8).

```
Brand (firm) + Operator identity guidelines
                    │
                    ▼  (future client, built incrementally)
        thin client modules
                    │
                    ▼
     HTTP / SSE / HITL  →  /v1/*  (work orders, approvals, practices)
                    │
                    ▼
   FastAPI → Foreman (swarm-factory) staffs Operators → structured artifact
```

---

## 2. Backend surfaces any future UI must bind to

| API surface | Brand term |
|-------------|------------|
| `POST/GET /v1/tasks`, followup, terminate, report, traces | Matters / jobs |
| `GET /v1/tasks/{id}/events` | Engagement stream (SSE) |
| `POST/GET /v1/tasks/{id}/hitl` | Partner approval |
| `GET/POST/PATCH /v1/playbooks`, `POST …/run` | Briefs |
| `GET/POST/PATCH/DELETE /v1/packs` | Practices |
| `GET /v1/agents` | Operators catalog |
| `GET/POST… /v1/workspaces` | Workspaces / repos |
| `POST/GET/DELETE /v1/artifacts` + task `result` | Deliverables |

Invariants: one ACP `swarm-factory` (C1/I7); no bot marketplace; structured `result` climax (P1).

---

## 3. Experience direction (when rebuilding)

- **Muse / messaging architecture** — conversation-first; not a product tab bar.  
- **Foreman** = conversational anchor; **Operators** = visible L5 crew (portraits).  
- **HITL** = deterministic cards on REST.  
- **Success** = artifact from `result`, not chat farewell.

Detailed IA and module names from the withdrawn greenfield attempt are **non-binding**. Rebuild chooses structure slice by slice.

---

## 4. Restart checklist

- [x] Backend A–E in place  
- [x] Brand guides in `docs/brand/`  
- [x] Empty FE scaffold (`apps/web` + [`frontend-structure.md`](./frontend-structure.md))  
- [x] ComposeHome → `POST /v1/tasks` (slice 1)  
- [x] Engagement SSE `GET …/events` (slice 2)  
- [ ] Next: HITL cards → `POST …/hitl`
