# Use cases

How Gantry is meant to be used **today** (API-first). A future frontend is an optional client of the same flows — not a different product.

---

## 1. Headless backlog → PR

**Who:** Eng leads, platform teams  
**Flow:** Create key → link GitHub project → `POST /v1/tasks` with a goal → poll or webhook → review PR.

```bash
curl -X POST "$API/v1/tasks" \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"goal":"Add /health that returns 200","project_id":"proj_…","tier":1}'
```

**Success:** `GET /v1/tasks/{id}` shows `status: completed` and `result.pr_url` (or `branch` / `patch` / `report` per playbook).

---

## 2. CI / automation submitter

**Who:** GitHub Actions, internal bots  
**Flow:** Store org API key as secret; on schedule or label, submit task with `webhook_url` or poll; gate merge on structured result.

Use scopes: `tasks:write` + `projects:read`. Prefer idempotent callers and org webhooks (`POST /v1/webhooks`) over scraping messages.

---

## 3. Bulk sprint intake

**Who:** Tech leads dumping a Monday backlog  
**Flow:** `POST /v1/tasks/bulk` with many goals on one project. Each item is an independent Foreman run (H-BULK isolation).

---

## 4. Playbook job packets

**Who:** Orgs repeating the same engagement type  
**Examples:** `platform-backlog`, `a11y-remediation`, `monorepo-slice`  
**Flow:** Install firm pack → `POST /v1/playbooks/run` or `POST /v1/tasks` with `"playbook": "…"`.

Playbooks configure seats, stages, oracle overlays, and artifact type — they do **not** spawn new ACP agents (**P2**).

---

## 5. HITL-gated complex work

**Who:** Teams that want plan / deploy approval  
**Flow:** Tier ≥ 2 pauses at architect (and optionally devops). Client:

1. Stream `GET /v1/tasks/{id}/events` until `type: hitl`
2. `GET /v1/tasks/{id}/hitl` for pending checkpoints
3. `POST /v1/tasks/{id}/hitl` (or `/approve`) with decision

Audit records the action (**C3**).

---

## 6. Ticketing ingress

**Who:** Linear / Jira / GitHub Issues  
**Flow:** Configure integration webhook → ticket creates or updates a Gantry task → result comments back when configured.

See [`integrations/`](./integrations/).

---

## 7. BYOK / org LLM policy

**Who:** Enterprises with their own Anthropic (or configured) keys  
**Flow:** Store secret via `/v1/secrets` or pass `llm` on submit. See [`platform/llm-byok.md`](./platform/llm-byok.md).

---

## 8. Future UI (deferred)

**Who:** Operators using a Muse-like messaging client  
**Constraint:** Same `/v1/*` surfaces only (**I1**, **I8**). No Next proxy, no second backend.

When rebuilding:

| UI moment | API |
|-----------|-----|
| File a matter | `POST /v1/tasks` |
| Engagement stream | `GET /v1/tasks/{id}/events` |
| Partner approval card | `GET/POST …/hitl` |
| Practices catalog | `GET/POST /v1/packs` |
| Briefs | `/v1/playbooks` |
| Deliverable climax | task `result` |

Restart notes: [`platform/frontend-architecture.md`](./platform/frontend-architecture.md) · [`brand/frontend-greenfield.md`](./brand/frontend-greenfield.md).

---

## Anti-use-cases

| Don’t | Why |
|-------|-----|
| Treat Gantry as interactive pair programming | Wrong latency / interaction model |
| Deploy one ACP agent per playbook or “bot” | Breaks **C1** / **P2** |
| Scrape agent chat for `pr_url` | Breaks **I3** |
| Require Vercel/UI for core ops | Breaks **I1** |
