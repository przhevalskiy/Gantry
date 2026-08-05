-- Per-org default LLM provider settings (BYOK via secrets reference)
-- Idempotent — safe to re-run via scripts/migrate_db.py

ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT 'anthropic';
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS llm_api_key_secret TEXT;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS llm_sonnet_model TEXT;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS llm_haiku_model TEXT;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS llm_openai_base_url TEXT;
