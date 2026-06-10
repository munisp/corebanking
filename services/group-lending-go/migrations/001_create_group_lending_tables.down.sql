-- Rollback: 001_create_group_lending_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_group_lending_updated ON group_lending_records;
DROP FUNCTION IF EXISTS update_group_lending_timestamp();
DROP FUNCTION IF EXISTS cleanup_group_lending_idempotency();
DROP POLICY IF EXISTS group_lending_tenant_isolation ON group_lending_records;
DROP TABLE IF EXISTS group_lending_idempotency;
DROP TABLE IF EXISTS group_lending_audit;
DROP TABLE IF EXISTS group_lending_records;
COMMIT;
