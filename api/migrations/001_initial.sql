-- Gantry production schema
-- Run once: python scripts/migrate_db.py

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS projects (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      TEXT NOT NULL DEFAULT 'system',
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL,
    repo_path    TEXT NOT NULL,
    github_url   TEXT,
    github_owner TEXT,
    github_repo  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_user_slug ON projects(user_id, slug);
CREATE INDEX IF NOT EXISTS projects_user_id ON projects(user_id);

CREATE TABLE IF NOT EXISTS builds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     TEXT NOT NULL UNIQUE,
    project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL DEFAULT 'system',
    branch      TEXT,
    pr_url      TEXT,
    quality_score NUMERIC(4,1),
    status      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS builds_project_id ON builds(project_id);
CREATE INDEX IF NOT EXISTS builds_task_id ON builds(task_id);
CREATE INDEX IF NOT EXISTS builds_user_id ON builds(user_id);

CREATE TABLE IF NOT EXISTS ui_state (
    user_id    TEXT NOT NULL,
    task_id    TEXT NOT NULL,
    open_tabs  JSONB NOT NULL DEFAULT '[]',
    active_tab TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, task_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id           TEXT PRIMARY KEY,
    active_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    last_task_id      TEXT,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
