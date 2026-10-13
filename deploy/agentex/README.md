# Agentex dependency stack

This compose file boots **Scale Agentex** (and its Temporal / Redis / Postgres / Mongo), not Gantry microservices.

Gantry attaches as a citizen:

| Process | Owner | Talks to |
|---------|--------|----------|
| `agentex` + data stores | Agentex platform | — |
| `gantry-api` (systemd/Helm) | Gantry | `AGENTEX_BASE_URL` |
| `gantry-worker` (systemd/Helm) | Gantry | `TEMPORAL_ADDRESS` + Agentex ACP |

## Modes

**Bundle (bootstrap / single VPS)** — start this compose, then API + worker:

```bash
export GANTRY_HOME=/opt/gantry
docker compose -f deploy/agentex/docker-compose.yml up -d
```

**External cluster (preferred at scale)** — skip this compose; set:

```bash
AGENTEX_BASE_URL=http://agentex.internal:5003
TEMPORAL_ADDRESS=temporal.internal:7233
```

See [`docs/platform/agentex-cluster.md`](../../docs/platform/agentex-cluster.md) and [`docs/platform/stack-debloat.md`](../../docs/platform/stack-debloat.md).

Do **not** put Gantry tenant keys / quotas in Agentex Postgres or Mongo. Use Gantry `DATABASE_URL` (or `GANTRY_HOME` files).
