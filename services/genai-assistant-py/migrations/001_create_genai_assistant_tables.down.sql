-- Rollback: 001_create_genai_assistant_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_genai_assistant_updated ON genai_assistant_records;
DROP FUNCTION IF EXISTS update_genai_assistant_timestamp();
DROP FUNCTION IF EXISTS cleanup_genai_assistant_idempotency();
DROP POLICY IF EXISTS genai_assistant_tenant_isolation ON genai_assistant_records;
DROP TABLE IF EXISTS genai_assistant_idempotency;
DROP TABLE IF EXISTS genai_assistant_audit;
DROP TABLE IF EXISTS genai_assistant_records;
COMMIT;
