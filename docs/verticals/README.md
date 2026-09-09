# Vertical playbooks (M4)

Verticals are **config overlays** on the same Foreman pipeline — no workflow forks. Playbook ids are accepted on `POST /v1/tasks` and merged into tier, branch prefix, and pipeline defaults.

## Horizontal matrix

| Playbook | Vertical | H-PAR | H-CON | H-ORA | H-HEAL | H-BULK | H-HITL | H-SSE |
|----------|----------|-------|-------|-------|--------|--------|--------|-------|
| `platform-backlog` | V-PLAT | ✓ (1 track) | ✓ | ✓ tier-1 | ✓ (1 cycle) | ✓ primary | tier ≥ 2 | ✓ |
| `a11y-remediation` | V-A11Y | ✓ (2 tracks) | ✓ | ✓ + a11y oracle | ✓ (2 cycles) | ✓ | ✓ tier ≥ 2 | ✓ |
| `monorepo-slice` | V-MONO | ✓ (3 tracks) | ✓ package overlay | ✓ | ✓ (2 cycles) | ✓ | ✓ tier ≥ 2 | ✓ |

See [`docs/platform/oracle-tiers.md`](../platform/oracle-tiers.md) for tier → oracle depth.

## Per-vertical docs

| Playbook | Doc |
|----------|-----|
| `platform-backlog` | [`platform-backlog.md`](platform-backlog.md) |
| `a11y-remediation` | Oracle overlay in `project/schema/playbooks.py` |
| `monorepo-slice` | Architect overlay in `project/schema/playbooks.py` |

Config source of truth: `project/schema/playbooks.py`.
