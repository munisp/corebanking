-- Rollback: 001_create_open_banking_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_open_banking_gateway_updated ON open_banking_gateway_records;
DROP FUNCTION IF EXISTS update_open_banking_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_open_banking_gateway_idempotency();
DROP POLICY IF EXISTS open_banking_gateway_tenant_isolation ON open_banking_gateway_records;
DROP TABLE IF EXISTS open_banking_gateway_idempotency;
DROP TABLE IF EXISTS open_banking_gateway_audit;
DROP TABLE IF EXISTS open_banking_gateway_records;
COMMIT;
