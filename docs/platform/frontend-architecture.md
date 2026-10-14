# Frontend technical architecture — restart baseline

**Status:** `apps/web` **removed**. This doc is the **reference** for the next piece-by-piece rebuild — not a description of shipped UI.  
**Product direction:** [`../brand/frontend-greenfield.md`](../brand/frontend-greenfield.md)  
**Brand / identity:** [`../brand/README.md`](../brand/README.md) · [`../brand/frontend-agent-representation.md`](../brand/frontend-agent-representation.md)  
**Backend lock:** Phases A–E ([`composable-crew-roadmap.md`](./composable-crew-roadmap.md)) — I1, I7, I8, C1, P1–P4

---

## 1. What stays true without a UI

The product is the **API factory**. UI is optional (I8).

```
Brand (firm) + Operator identity guidelines
                    │
                    ▼  (future apps/web, built incrementally)
        thin client modules
                    │
                    ▼
     HTTP / SSE / HITL  →  /v1/*
                    │
                    ▼
   FastAPI → Temporal Foreman (swarm-factory) → structured result
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
- [x] `apps/web` removed  
- [ ] Next: empty FE scaffold + first vertical slice (to be agreed)
