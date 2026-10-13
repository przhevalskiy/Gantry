-- Phase E: org-installed firm packs (enable/disable + per-pack daily quota).
-- Packs are product packaging over swarm-factory — not separate ACP agents.

CREATE TABLE IF NOT EXISTS org_firm_packs (
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    pack_id             TEXT NOT NULL,
    version             TEXT NOT NULL DEFAULT '1',
    enabled             BOOLEAN NOT NULL DEFAULT true,
    max_tasks_per_day   INT NOT NULL DEFAULT 200,
    installed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, pack_id)
);

CREATE INDEX IF NOT EXISTS idx_org_firm_packs_enabled
    ON org_firm_packs (org_id) WHERE enabled = true;

-- Auto-install built-in SWE factory for the default org (idempotent).
INSERT INTO org_firm_packs (org_id, pack_id, version, enabled, max_tasks_per_day)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'swe-factory',
    '1',
    true,
    500
)
ON CONFLICT (org_id, pack_id) DO NOTHING;
