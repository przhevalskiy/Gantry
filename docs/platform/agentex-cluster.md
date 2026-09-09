# Add Gantry to an Agentex cluster

Gantry is an Agentex **L5** agent named `swarm-factory`. The Foreman is the only ACP `task/create` target. Child roles (PM, Architect, Builder, Inspector, Reviewer, Security, DevOps, HITL) are Temporal workflows on the same worker — composed by the Foreman, not replaced by ACP (platform invariant I7).

REST remains the integrator API (`POST /v1/tasks` → structured `result.pr_url`). ACP is the Agentex-track door for other agents on the same cluster.

## Prerequisites

- Agentex platform reachable (default `:5003`)
- Temporal reachable (default `:7233`)
- This repo’s worker (`python worker.py` / Helm worker) registered against that cluster

## Register the agent

Point the worker at the existing cluster:

```bash
export AGENTEX_BASE_URL=http://agentex:5003
export GANTRY_AGENT_NAME=swarm-factory   # also accepted as AGENT_NAME
export TEMPORAL_ADDRESS=temporal:7233
export WORKFLOW_TASK_QUEUE=gantry_queue
```

Helm (`deploy/helm/gantry`):

```yaml
agentex:
  baseUrl: http://agentex:5003
  agentName: swarm-factory
temporal:
  address: temporal:7233
```

`manifest.yaml` must keep `acp_type: async` and `agent.name: swarm-factory`. Child workflow names in that file must match `worker.py` registration.

## ACP invoke (other Agentex agents)

```http
POST {AGENTEX_BASE_URL}/agents/name/swarm-factory/rpc
Content-Type: application/json
```

```json
{
  "jsonrpc": "2.0",
  "method": "task/create",
  "params": {
    "params": {
      "query": "Add a health check endpoint",
      "prompt": "Add a health check endpoint",
      "project_id": "<gantry project id>",
      "tier": -1
    }
  }
}
```

Do not `task/create` against `gantry-builder` (or other child names). Those workflows are not independent ACP agents.

## REST catalog and HITL

```bash
curl http://localhost:8001/v1/agents \
  -H "Authorization: Bearer $GANTRY_API_KEY"

curl -X POST http://localhost:8001/v1/tasks/$TASK_ID/hitl \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "checkpoint": "architect_plan",
    "workflow_id": "<approval workflow id>",
    "approved": true
  }'
```

`GET /v1/agents` returns crew identities, L2–L5 tier mapping, HITL checkpoint names, and the ACP example above.

Existing `POST /v1/tasks/{id}/approve` still works.

## Autonomy (Agentex L-levels)

| Gantry tier | Label | Agentex level |
|-------------|-------|----------------|
| 0 | Micro | L2 |
| 1 | Lightweight | L3 |
| 2 | Standard | L4 |
| 3 | Full Crew | L5 |

Plan: [`agentex-citizen.md`](./agentex-citizen.md)

Factory UI (Vercel): [`apps/web`](../../apps/web/) — consumes `GET /v1/tasks/{id}/events` SSE.
