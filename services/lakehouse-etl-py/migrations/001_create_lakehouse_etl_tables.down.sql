-- Rollback: 001_create_lakehouse_etl_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_lakehouse_etl_updated ON lakehouse_etl_records;
DROP FUNCTION IF EXISTS update_lakehouse_etl_timestamp();
DROP FUNCTION IF EXISTS cleanup_lakehouse_etl_idempotency();
DROP POLICY IF EXISTS lakehouse_etl_tenant_isolation ON lakehouse_etl_records;
DROP TABLE IF EXISTS lakehouse_etl_idempotency;
DROP TABLE IF EXISTS lakehouse_etl_audit;
DROP TABLE IF EXISTS lakehouse_etl_records;
COMMIT;
