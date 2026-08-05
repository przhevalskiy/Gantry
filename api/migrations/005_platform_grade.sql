-- Gantry Phase 2 — quotas + audit log
-- Idempotent — safe to re-run via scripts/migrate_db.py

CREATE TABLE IF NOT EXISTS org_quotas (
    org_id               UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    max_concurrent_tasks INT NOT NULL DEFAULT 10,
    max_tasks_per_day    INT NOT NULL DEFAULT 500,
    max_bulk_size        INT NOT NULL DEFAULT 50,
    requests_per_minute  INT NOT NULL DEFAULT 120,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO org_quotas (org_id)
SELECT id FROM organizations
ON CONFLICT (org_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key_id        UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    action        TEXT NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}',
    ip_address    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_org_created ON audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_key_id ON audit_log(key_id);
