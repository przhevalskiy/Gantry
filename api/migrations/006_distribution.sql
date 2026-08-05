-- Gantry Phase 3 — integrations + white-label settings
-- Idempotent — safe to re-run via scripts/migrate_db.py

ALTER TABLE projects ADD COLUMN IF NOT EXISTS linear_team_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS jira_project_key TEXT;

CREATE INDEX IF NOT EXISTS projects_linear_team ON projects(linear_team_id) WHERE linear_team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_jira_key ON projects(jira_project_key) WHERE jira_project_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS org_settings (
    org_id        UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    brand_name    TEXT,
    logo_url      TEXT,
    support_email TEXT,
    accent_color  TEXT DEFAULT '#f97316',
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO org_settings (org_id, brand_name)
SELECT id, name FROM organizations
ON CONFLICT (org_id) DO NOTHING;
