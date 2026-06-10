-- Rollback: 001_create_backup_manager_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_backup_manager_updated ON backup_manager_records;
DROP FUNCTION IF EXISTS update_backup_manager_timestamp();
DROP FUNCTION IF EXISTS cleanup_backup_manager_idempotency();
DROP POLICY IF EXISTS backup_manager_tenant_isolation ON backup_manager_records;
DROP TABLE IF EXISTS backup_manager_idempotency;
DROP TABLE IF EXISTS backup_manager_audit;
DROP TABLE IF EXISTS backup_manager_records;
COMMIT;
