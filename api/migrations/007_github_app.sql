-- Gantry GitHub App installations (org-scoped)
-- Idempotent — safe to re-run via scripts/migrate_db.py

CREATE TABLE IF NOT EXISTS github_installations (
    installation_id      BIGINT PRIMARY KEY,
    org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_login        TEXT NOT NULL,
    account_type         TEXT NOT NULL DEFAULT 'Organization',
    repository_selection TEXT NOT NULL DEFAULT 'selected',
    repos                JSONB NOT NULL DEFAULT '[]',
    suspended_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS github_installations_org_id ON github_installations(org_id);
CREATE INDEX IF NOT EXISTS github_installations_account ON github_installations(account_login);
