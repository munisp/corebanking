-- Rollback: 001_create_tax_reporting_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tax_reporting_updated ON tax_reporting_records;
DROP FUNCTION IF EXISTS update_tax_reporting_timestamp();
DROP FUNCTION IF EXISTS cleanup_tax_reporting_idempotency();
DROP POLICY IF EXISTS tax_reporting_tenant_isolation ON tax_reporting_records;
DROP TABLE IF EXISTS tax_reporting_idempotency;
DROP TABLE IF EXISTS tax_reporting_audit;
DROP TABLE IF EXISTS tax_reporting_records;
COMMIT;
