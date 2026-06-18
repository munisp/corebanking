-- Rollback: 001_create_security_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_security_gateway_updated ON security_gateway_records;
DROP FUNCTION IF EXISTS update_security_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_security_gateway_idempotency();
DROP POLICY IF EXISTS security_gateway_tenant_isolation ON security_gateway_records;
DROP TABLE IF EXISTS security_gateway_idempotency;
DROP TABLE IF EXISTS security_gateway_audit;
DROP TABLE IF EXISTS security_gateway_records;
COMMIT;
