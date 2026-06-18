-- Rollback: 001_create_lakehouse_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_lakehouse_updated ON lakehouse_records;
DROP FUNCTION IF EXISTS update_lakehouse_timestamp();
DROP FUNCTION IF EXISTS cleanup_lakehouse_idempotency();
DROP POLICY IF EXISTS lakehouse_tenant_isolation ON lakehouse_records;
DROP TABLE IF EXISTS lakehouse_idempotency;
DROP TABLE IF EXISTS lakehouse_audit;
DROP TABLE IF EXISTS lakehouse_records;
COMMIT;
