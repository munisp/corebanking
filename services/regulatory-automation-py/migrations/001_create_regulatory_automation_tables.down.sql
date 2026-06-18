-- Rollback: 001_create_regulatory_automation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_regulatory_automation_updated ON regulatory_automation_records;
DROP FUNCTION IF EXISTS update_regulatory_automation_timestamp();
DROP FUNCTION IF EXISTS cleanup_regulatory_automation_idempotency();
DROP POLICY IF EXISTS regulatory_automation_tenant_isolation ON regulatory_automation_records;
DROP TABLE IF EXISTS regulatory_automation_idempotency;
DROP TABLE IF EXISTS regulatory_automation_audit;
DROP TABLE IF EXISTS regulatory_automation_records;
COMMIT;
