-- Rollback: 001_create_voice_banking_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_voice_banking_gateway_updated ON voice_banking_gateway_records;
DROP FUNCTION IF EXISTS update_voice_banking_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_voice_banking_gateway_idempotency();
DROP POLICY IF EXISTS voice_banking_gateway_tenant_isolation ON voice_banking_gateway_records;
DROP TABLE IF EXISTS voice_banking_gateway_idempotency;
DROP TABLE IF EXISTS voice_banking_gateway_audit;
DROP TABLE IF EXISTS voice_banking_gateway_records;
COMMIT;
