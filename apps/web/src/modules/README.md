# Frontend modules (greenfield)

Additive domain packages for the Muse-like × L5 firm UI.  
**Architecture:** [`docs/platform/frontend-architecture.md`](../../../../docs/platform/frontend-architecture.md)  
**Brand:** [`docs/brand/frontend-greenfield.md`](../../../../docs/brand/frontend-greenfield.md)

Import **only** from `@/modules/<name>` barrels. Do not deep-import another module’s private files.

| Module | Backend | Brand term |
|--------|---------|------------|
| `kernel` | HTTP / SSE / auth / shell | Firm shell |
| `operators` | `/v1/agents` + presence | Operators / Foreman |
| `engagement` | tasks + SSE + followup | Engagement theater |
| `hitl` | `/v1/tasks/{id}/hitl` | Partner approval |
| `artifacts` | `result` + `/v1/artifacts` | Deliverables |
| `matters` | `GET /v1/tasks` | Matters / Jobs |
| `practices` | `/v1/packs` | Practices |
| `briefs` | `/v1/playbooks` | Briefs |
| `workspaces` | `/v1/workspaces` | Workspaces |
| `stage` | files / preview | Stage |
| `home` | composes above | Home first paint |

Legacy `features/*` remains until G0–G2 cutover.
