-- Rollback: 001_create_regulatory_reporting_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_regulatory_reporting_updated ON regulatory_reporting_records;
DROP FUNCTION IF EXISTS update_regulatory_reporting_timestamp();
DROP FUNCTION IF EXISTS cleanup_regulatory_reporting_idempotency();
DROP POLICY IF EXISTS regulatory_reporting_tenant_isolation ON regulatory_reporting_records;
DROP TABLE IF EXISTS regulatory_reporting_idempotency;
DROP TABLE IF EXISTS regulatory_reporting_audit;
DROP TABLE IF EXISTS regulatory_reporting_records;
COMMIT;
