# Deep dive: swarm-factory (Foreman)

One ACP citizen — the firm’s front desk — runs one Temporal Foreman workflow that **staffs Operators** as child workflows. There is no second task agent and no per-seat ACP bot.

**Code:** `workflows/swarm_orchestrator.py`, `workflows/swarm/`, `workflows/agents/`, `schemas/crew.py`  
**Citizen rules:** [`../platform/agentex-citizen.md`](../platform/agentex-citizen.md) · **Firm persona:** [`../brand/persona-the-firm.md`](../brand/persona-the-firm.md)

---

## Default SWE engagement DAG

```
PM → Architect → Builders (parallel tracks) → Inspector ↺ heal
       → Reviewer → Security → DevOps → structured artifact
```

This is the **full-service software-engineering practice** default. Playbooks may overlay a `stage_graph` (Phase C) but still execute inside this firm — not a forked engine (**M4**, **I7**).

| Stage | Firm seat | Job |
|-------|-----------|-----|
| **PM** | Engagement lead | Enrich goal; optional clarification HITL |
| **Architect** | Tech lead | Repo map, parallel tracks, conflict resolution; plan HITL |
| **Builder** | Implementation | Tool-using LLM loop per track |
| **Inspector** | QA / build gate | Tests / lint / types; emit heal instructions |
| **Reviewer** | Senior review | Diff / logic review → may re-enter heal |
| **Security** | Security review | Secrets / CVE patterns; can block ship |
| **DevOps** | Delivery | Close engagement: branch / commit / push / optional PR |

Heal cycles restore from git snapshot before retrying Builder. Wrong plans can return to Architect before burning more cycles. Client approvals are HITL checkpoints (partner gates), not companion chat.

---

## Tiers and autonomy

| Tier | Autonomy | Tracks | Heal | Gates |
|------|----------|--------|------|-------|
| 0 Micro | L2 | 1 | 0 | none |
| 1 Lightweight | L3 | 1 | 1 | PM |
| 2 Standard | L4 | 2 | 2 | + architect |
| 3 Full Crew | L5 | 4 | 2 | + devops |

Oracle depth: [`../platform/oracle-tiers.md`](../platform/oracle-tiers.md).

Submit overrides:

```json
{
  "tier": 2,
  "pipeline": {
    "max_parallel_tracks": 2,
    "max_heal_cycles": 2,
    "disable_agents": ["pm"]
  }
}
```

---

## Artifact types (P4)

DevOps emits one of:

| `artifact_type` | Meaning |
|-----------------|--------|
| `pr` | Branch + opened PR |
| `branch` | Push branch, skip PR create |
| `patch` | Diff bundle without push identity as PR |
| `report` | Analysis / remediation report, no git push |

Primary consumer field: structured `result` on the task (**I3**).

---

## Catalog

`GET /v1/agents` returns the Operator catalog + autonomy table. Only **`swarm-factory`** (Foreman) accepts ACP `task/create`. Sibling names are Temporal seats, not deployable bots (**C1**, **C2**).

---

## Failure and durability

- Temporal persists workflow state across worker restarts.
- Worker pushes `running` / `waiting_approval` / terminal via `/internal/db/tasks/{id}/status`.
- Builds upserted via `/internal/db/builds`.
- Poller scrapes Agentex only as fallback ([`../platform/event-model.md`](../platform/event-model.md)).
