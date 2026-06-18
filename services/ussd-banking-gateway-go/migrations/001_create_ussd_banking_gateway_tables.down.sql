-- Rollback: 001_create_ussd_banking_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ussd_banking_gateway_updated ON ussd_banking_gateway_records;
DROP FUNCTION IF EXISTS update_ussd_banking_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_ussd_banking_gateway_idempotency();
DROP POLICY IF EXISTS ussd_banking_gateway_tenant_isolation ON ussd_banking_gateway_records;
DROP TABLE IF EXISTS ussd_banking_gateway_idempotency;
DROP TABLE IF EXISTS ussd_banking_gateway_audit;
DROP TABLE IF EXISTS ussd_banking_gateway_records;
COMMIT;
