-- Gantry integrator schema (Phase 1)
-- Idempotent — safe to re-run via scripts/migrate_db.py

CREATE TABLE IF NOT EXISTS org_webhooks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    events     TEXT[] NOT NULL DEFAULT ARRAY['task.completed', 'task.failed'],
    secret     TEXT NOT NULL,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_webhooks_org_id ON org_webhooks(org_id);

CREATE TABLE IF NOT EXISTS usage_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key_id     UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    task_id    TEXT,
    metadata   JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_org_created ON usage_events(org_id, created_at DESC);

ALTER TABLE api_tasks ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS api_tasks_org_idempotency
    ON api_tasks(org_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
