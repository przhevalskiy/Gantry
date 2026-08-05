-- Gantry Phase 1 — org secrets + lifecycle event tracking
-- Idempotent — safe to re-run via scripts/migrate_db.py

CREATE TABLE IF NOT EXISTS org_secrets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS org_secrets_org_id ON org_secrets(org_id);

ALTER TABLE api_tasks ADD COLUMN IF NOT EXISTS events_fired TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
