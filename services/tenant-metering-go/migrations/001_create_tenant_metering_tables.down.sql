-- Rollback: 001_create_tenant_metering_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tenant_metering_updated ON tenant_metering_records;
DROP FUNCTION IF EXISTS update_tenant_metering_timestamp();
DROP FUNCTION IF EXISTS cleanup_tenant_metering_idempotency();
DROP POLICY IF EXISTS tenant_metering_tenant_isolation ON tenant_metering_records;
DROP TABLE IF EXISTS tenant_metering_idempotency;
DROP TABLE IF EXISTS tenant_metering_audit;
DROP TABLE IF EXISTS tenant_metering_records;
COMMIT;
