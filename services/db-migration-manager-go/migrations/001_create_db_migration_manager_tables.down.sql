-- Rollback: 001_create_db_migration_manager_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_db_migration_manager_updated ON db_migration_manager_records;
DROP FUNCTION IF EXISTS update_db_migration_manager_timestamp();
DROP FUNCTION IF EXISTS cleanup_db_migration_manager_idempotency();
DROP POLICY IF EXISTS db_migration_manager_tenant_isolation ON db_migration_manager_records;
DROP TABLE IF EXISTS db_migration_manager_idempotency;
DROP TABLE IF EXISTS db_migration_manager_audit;
DROP TABLE IF EXISTS db_migration_manager_records;
COMMIT;
