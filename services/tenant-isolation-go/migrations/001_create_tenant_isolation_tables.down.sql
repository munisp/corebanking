-- Rollback: 001_create_tenant_isolation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tenant_isolation_updated ON tenant_isolation_records;
DROP FUNCTION IF EXISTS update_tenant_isolation_timestamp();
DROP FUNCTION IF EXISTS cleanup_tenant_isolation_idempotency();
DROP POLICY IF EXISTS tenant_isolation_tenant_isolation ON tenant_isolation_records;
DROP TABLE IF EXISTS tenant_isolation_idempotency;
DROP TABLE IF EXISTS tenant_isolation_audit;
DROP TABLE IF EXISTS tenant_isolation_records;
COMMIT;
