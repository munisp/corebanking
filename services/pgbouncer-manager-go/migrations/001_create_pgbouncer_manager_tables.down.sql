-- Rollback: 001_create_pgbouncer_manager_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_pgbouncer_manager_updated ON pgbouncer_manager_records;
DROP FUNCTION IF EXISTS update_pgbouncer_manager_timestamp();
DROP FUNCTION IF EXISTS cleanup_pgbouncer_manager_idempotency();
DROP POLICY IF EXISTS pgbouncer_manager_tenant_isolation ON pgbouncer_manager_records;
DROP TABLE IF EXISTS pgbouncer_manager_idempotency;
DROP TABLE IF EXISTS pgbouncer_manager_audit;
DROP TABLE IF EXISTS pgbouncer_manager_records;
COMMIT;
