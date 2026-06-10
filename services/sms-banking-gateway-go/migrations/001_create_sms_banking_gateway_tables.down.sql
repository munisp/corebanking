-- Rollback: 001_create_sms_banking_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sms_banking_gateway_updated ON sms_banking_gateway_records;
DROP FUNCTION IF EXISTS update_sms_banking_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_sms_banking_gateway_idempotency();
DROP POLICY IF EXISTS sms_banking_gateway_tenant_isolation ON sms_banking_gateway_records;
DROP TABLE IF EXISTS sms_banking_gateway_idempotency;
DROP TABLE IF EXISTS sms_banking_gateway_audit;
DROP TABLE IF EXISTS sms_banking_gateway_records;
COMMIT;
