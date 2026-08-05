# Horizontal Worker Scaling

Guide for running Gantry at platform scale — multiple workers, org isolation, and queue management.

---

## Architecture

```
                    ┌─────────────┐
  Integrators ─────►│ Gantry API  │  (stateless — scale horizontally)
                    └──────┬──────┘
                           │ submit task
                    ┌──────▼──────┐
                    │  Agentex    │  (:5003)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Temporal   │  (:7233)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Worker 1      Worker 2      Worker N
         (ACP+TW)      (ACP+TW)      (ACP+TW)
```

- **API**: Stateless FastAPI instances behind a load balancer. All share one Postgres.
- **Workers**: Each runs `agentex agents run` + Temporal worker. Scale by adding worker VMs.
- **Temporal**: Single cluster; workflows are durable regardless of which worker picks them up.

---

## Scaling the API

1. Run multiple uvicorn processes:
   ```bash
   uvicorn api.main:app --host 0.0.0.0 --port 8001 --workers 4
   ```
2. Put nginx or a cloud LB in front.
3. Set `DATABASE_URL` to a shared Postgres (required for multi-instance).
4. Rate limiting is in-memory per API instance — for strict global limits, add Redis-backed rate limiting in Phase 3.

---

## Scaling workers

Each worker needs:
- Access to Temporal (`TEMPORAL_ADDRESS`)
- Access to Agentex platform (`AGENTEX_BASE_URL`)
- Access to Gantry API for `db_upsert_build` (`GANTRY_API_URL` + `INTERNAL_API_KEY`)
- Anthropic API key(s) — cycle keys to raise LLM throughput ceiling

```bash
# Worker 1
AGENTEX_BASE_URL=http://agentex:5003 TEMPORAL_ADDRESS=temporal:7233 \
  agentex agents run --manifest manifest.yaml

# Worker 2 (same config, different host)
```

Temporal distributes workflows across workers on the same task queue automatically.

---

## Org quotas (built-in)

Per-org limits via `GET/PATCH /v1/quotas` (admin scope):

| Limit | Default | Purpose |
|---|---|---|
| `max_concurrent_tasks` | 10 | In-flight builds per org |
| `max_tasks_per_day` | 500 | Daily submission cap |
| `max_bulk_size` | 50 | Max tasks per bulk request |
| `requests_per_minute` | 120 | API rate limit per org |

Returns HTTP `429` when exceeded.

---

## Least-privilege API keys

Create scoped keys instead of admin:

```bash
curl -X POST http://localhost:8001/v1/keys \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -d '{
    "name": "ci-readonly",
    "scopes": ["tasks:read", "projects:read"]
  }'
```

| Scope | Grants |
|---|---|
| `tasks:read` | GET tasks, messages, report, events |
| `tasks:write` | POST tasks, bulk, approve, terminate |
| `projects:read` | GET projects, memory |
| `projects:write` | POST/PATCH projects |
| `secrets:read` | List secret names |
| `secrets:write` | Create/delete secrets |
| `admin` | Keys, webhooks, quotas, usage, audit |

---

## Monitoring

- `GET /status` — public health (DB, Agentex, active task count)
- `GET /v1/usage` — event summary per org
- `GET /v1/audit` — immutable action log
- `GET /v1/quotas` — limits vs current usage

---

## Bottlenecks at scale

| Bottleneck | Mitigation |
|---|---|
| LLM rate limits | Multiple Anthropic keys, Haiku for Tier 0/1 |
| GitHub API | GitHub App (Phase 3), PAT rotation |
| Single Postgres | Read replicas for GET endpoints; connection pool tuning |
| In-memory rate limits | Redis rate limiter (Phase 3) |
| Disk I/O on workers | Shared volume or clone-on-submit |

---

## Production checklist

- [ ] Postgres with `DATABASE_URL` on all API instances
- [ ] `GANTRY_SECRETS_KEY` set (Fernet key for org secrets)
- [ ] `GANTRY_BOOTSTRAP_TOKEN` unset after first admin key created
- [ ] At least 2 Temporal workers on separate hosts
- [ ] Org quotas tuned per customer tier
- [ ] Scoped API keys for CI (not admin)
- [ ] `/status` monitored by uptime checker
