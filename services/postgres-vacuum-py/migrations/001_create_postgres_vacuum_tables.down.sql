-- Rollback: 001_create_postgres_vacuum_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_postgres_vacuum_updated ON postgres_vacuum_records;
DROP FUNCTION IF EXISTS update_postgres_vacuum_timestamp();
DROP FUNCTION IF EXISTS cleanup_postgres_vacuum_idempotency();
DROP POLICY IF EXISTS postgres_vacuum_tenant_isolation ON postgres_vacuum_records;
DROP TABLE IF EXISTS postgres_vacuum_idempotency;
DROP TABLE IF EXISTS postgres_vacuum_audit;
DROP TABLE IF EXISTS postgres_vacuum_records;
COMMIT;
