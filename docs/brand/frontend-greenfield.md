# Greenfield frontend — deferred restart

**Status:** Frontend removed from the repo. Rebuild **piece by piece** only after backend + brand are locked.  
**Research:** [`research-muse.md`](./research-muse.md)  
**Brand:** [`positioning.md`](./positioning.md) · [`persona-the-firm.md`](./persona-the-firm.md) · [`frontend-agent-representation.md`](./frontend-agent-representation.md) · [`voice-and-look.md`](./voice-and-look.md)  
**Backend lock:** Gantry API + Temporal Foreman (`swarm-factory`) + playbooks/packs — C1/I7/P1  
**Prior architecture notes (reference only):** [`../platform/frontend-architecture.md`](../platform/frontend-architecture.md)

---

## Current state

| Layer | Status |
|-------|--------|
| **Backend** | In place — `/v1/*`, Temporal Foreman, firm packs, HITL, SSE, structured `result` |
| **Brand strategy + guidelines** | In place — firm persona, voice/look, Operator identity, Muse research |
| **`apps/web`** | **Removed** — no product UI in-tree |

Do not resurrect the deleted console/messaging shells. Next frontend work starts empty and ships incrementally against the API + brand docs.

---

## Direction when we rebuild (not implemented)

Experience target remains Muse-like **messaging** (iMessage patterns: conversation, bubbles, presence, Goals/Floor as secondary sheets) over an L5 firm backend — **not** a tabbed ops console, **not** a companion pet product.

| Steal | Refuse |
|-------|--------|
| Continuous conversation + presence + HITL cards + artifacts | Per-user Muse VM / personal companion identity |
| Goals as durable matters | Bot marketplace |
| Visible Operator crew (L5) | Hiding the firm behind one renameable pet |

One line:

> Chat with the firm. Watch the floor work. Take the artifact home. — built later, API-first.

---

## Restart rule

1. Confirm backend + brand inventory (this PR).  
2. Add frontend **one slice at a time** (e.g. auth shell → main chat → HITL card → …).  
3. Every slice talks only to existing `/v1/*`; no shadow orchestration in the browser (I8).
