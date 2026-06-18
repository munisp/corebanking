-- Rollback: 001_create_chatbot_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_chatbot_updated ON chatbot_records;
DROP FUNCTION IF EXISTS update_chatbot_timestamp();
DROP FUNCTION IF EXISTS cleanup_chatbot_idempotency();
DROP POLICY IF EXISTS chatbot_tenant_isolation ON chatbot_records;
DROP TABLE IF EXISTS chatbot_idempotency;
DROP TABLE IF EXISTS chatbot_audit;
DROP TABLE IF EXISTS chatbot_records;
COMMIT;
