-- Rollback: 001_create_platform_operations_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_platform_operations_engine_updated ON platform_operations_engine_records;
DROP FUNCTION IF EXISTS update_platform_operations_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_platform_operations_engine_idempotency();
DROP POLICY IF EXISTS platform_operations_engine_tenant_isolation ON platform_operations_engine_records;
DROP TABLE IF EXISTS platform_operations_engine_idempotency;
DROP TABLE IF EXISTS platform_operations_engine_audit;
DROP TABLE IF EXISTS platform_operations_engine_records;
COMMIT;
