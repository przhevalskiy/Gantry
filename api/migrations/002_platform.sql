-- Gantry platform schema (Phase 0)
-- Idempotent — safe to re-run via scripts/migrate_db.py

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Organizations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-4000-8000-000000000001', 'Default Organization', 'default')
ON CONFLICT (slug) DO NOTHING;

-- ── API keys ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    key_hash     TEXT NOT NULL UNIQUE,
    scopes       TEXT[] NOT NULL DEFAULT ARRAY['admin'],
    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash ON api_keys(key_hash);

-- ── Projects: org scope ──────────────────────────────────────────────────────

ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

UPDATE projects
SET org_id = '00000000-0000-4000-8000-000000000001'
WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS projects_org_id ON projects(org_id);

-- ── API task metadata (replaces api_tasks.json) ──────────────────────────────

CREATE TABLE IF NOT EXISTS api_tasks (
    task_id        TEXT PRIMARY KEY,
    org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
    key_id         UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    webhook_url    TEXT,
    source         TEXT NOT NULL DEFAULT 'api',
    status         TEXT,
    pr_url         TEXT,
    branch         TEXT,
    tier           INT,
    webhook_fired  BOOLEAN NOT NULL DEFAULT false,
    meta           JSONB NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_tasks_org_id ON api_tasks(org_id);
CREATE INDEX IF NOT EXISTS api_tasks_project_id ON api_tasks(project_id);
CREATE INDEX IF NOT EXISTS api_tasks_pending ON api_tasks(webhook_fired) WHERE webhook_fired = false;

-- ── Builds: structured results ───────────────────────────────────────────────

ALTER TABLE builds ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE builds ADD COLUMN IF NOT EXISTS tier INT;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS heal_cycles INT;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS files_changed INT;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS result JSONB;

UPDATE builds
SET org_id = '00000000-0000-4000-8000-000000000001'
WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS builds_org_id ON builds(org_id);
