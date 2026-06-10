-- Rollback: 001_create_voice_nlu_banking_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_voice_nlu_banking_updated ON voice_nlu_banking_records;
DROP FUNCTION IF EXISTS update_voice_nlu_banking_timestamp();
DROP FUNCTION IF EXISTS cleanup_voice_nlu_banking_idempotency();
DROP POLICY IF EXISTS voice_nlu_banking_tenant_isolation ON voice_nlu_banking_records;
DROP TABLE IF EXISTS voice_nlu_banking_idempotency;
DROP TABLE IF EXISTS voice_nlu_banking_audit;
DROP TABLE IF EXISTS voice_nlu_banking_records;
COMMIT;
