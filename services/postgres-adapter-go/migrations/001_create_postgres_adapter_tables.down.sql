-- Rollback: 001_create_postgres_adapter_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_postgres_adapter_updated ON postgres_adapter_records;
DROP FUNCTION IF EXISTS update_postgres_adapter_timestamp();
DROP FUNCTION IF EXISTS cleanup_postgres_adapter_idempotency();
DROP POLICY IF EXISTS postgres_adapter_tenant_isolation ON postgres_adapter_records;
DROP TABLE IF EXISTS postgres_adapter_idempotency;
DROP TABLE IF EXISTS postgres_adapter_audit;
DROP TABLE IF EXISTS postgres_adapter_records;
COMMIT;
