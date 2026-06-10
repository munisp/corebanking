-- Rollback: 001_create_postgres_persistence_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_postgres_persistence_updated ON postgres_persistence_records;
DROP FUNCTION IF EXISTS update_postgres_persistence_timestamp();
DROP FUNCTION IF EXISTS cleanup_postgres_persistence_idempotency();
DROP POLICY IF EXISTS postgres_persistence_tenant_isolation ON postgres_persistence_records;
DROP TABLE IF EXISTS postgres_persistence_idempotency;
DROP TABLE IF EXISTS postgres_persistence_audit;
DROP TABLE IF EXISTS postgres_persistence_records;
COMMIT;
