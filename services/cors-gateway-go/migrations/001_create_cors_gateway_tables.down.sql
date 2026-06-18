-- Rollback: 001_create_cors_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cors_gateway_updated ON cors_gateway_records;
DROP FUNCTION IF EXISTS update_cors_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_cors_gateway_idempotency();
DROP POLICY IF EXISTS cors_gateway_tenant_isolation ON cors_gateway_records;
DROP TABLE IF EXISTS cors_gateway_idempotency;
DROP TABLE IF EXISTS cors_gateway_audit;
DROP TABLE IF EXISTS cors_gateway_records;
COMMIT;
