# Oracle tiers (H-ORA)

Gantry maps **complexity tiers** to **oracle depth** — the verification steps the Inspector runs before DevOps opens a PR. Tiers align with Agentex autonomy levels (L2–L5); see `project/schema/crew.py`.

## Tier → oracle matrix

| Tier | Label | Autonomy | Parallel tracks | Heal cycles | HITL checkpoints | Oracle steps |
|------|-------|----------|-----------------|-------------|------------------|--------------|
| 0 | Micro | L2 | 1 | 0 | — | Lint only (lightweight); tests skipped if deps missing |
| 1 | Lightweight | L3 | 1 | 1 | PM clarify | Tests + lint + type check (when configured) |
| 2 | Standard | L4 | 2 | 2 | PM, architect plan, max heals | Full QA suite; baseline regression filter |
| 3 | Full Crew | L5 | 4 | 2 | PM, architect plan, max heals, devops | Full QA + Security agent + deploy HITL |

## Default oracle pipeline

1. **Baseline** — Foreman runs configured test command on unmodified repo; pre-existing failures are excluded from heal scope.
2. **Build** — Parallel Builders execute Architect tracks.
3. **Inspector** — Tests, lint, type check (commands from Architect `qa_commands` or discovery).
4. **Reviewer** — Logic/contract review (skipped in lightweight mode).
5. **Security** — Secret/CVE scan (tier ≥ 2, not lightweight).
6. **DevOps** — Branch, commit, push, PR (tier 3 may require deploy HITL).

## Playbook oracle extensions (M4)

Vertical playbooks add **config overlays** — no separate workflow fork.

| Playbook | Vertical | Oracle extension |
|----------|----------|------------------|
| `platform-backlog` | V-PLAT | Default tier-1 oracle; single track |
| `a11y-remediation` | V-A11Y | Inspector overlay + optional `qa_commands.a11y` (eslint jsx-a11y / pa11y) |
| `monorepo-slice` | V-MONO | Architect overlay enforces package-boundary tracks; H-CON resolves file collisions |

Playbook config lives in `project/schema/playbooks.py`. Submit with `playbook` on `POST /v1/tasks`.

## Conflict oracle (H-CON)

When parallel tracks claim the same file, Foreman runs `_resolve_track_conflicts` before Builders start. Warnings are:

- Emitted as Agentex messages
- Stored on task metadata as `track_warnings[]` (visible on `GET /v1/tasks/{id}`)

## HITL oracle (H-HITL)

Checkpoints block the Foreman until the user approves via `POST /v1/tasks/{id}/hitl` or SDK `tasks.hitl()`. Pending checkpoints appear in task metadata as `pending_hitl[]` and on SSE as `type: hitl` events.

See also: `docs/platform/sse-events.md`, `docs/platform/agentex-citizen.md`.
