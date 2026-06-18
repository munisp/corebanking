-- Rollback: 001_create_livestock_insurance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_livestock_insurance_updated ON livestock_insurance_records;
DROP FUNCTION IF EXISTS update_livestock_insurance_timestamp();
DROP FUNCTION IF EXISTS cleanup_livestock_insurance_idempotency();
DROP POLICY IF EXISTS livestock_insurance_tenant_isolation ON livestock_insurance_records;
DROP TABLE IF EXISTS livestock_insurance_idempotency;
DROP TABLE IF EXISTS livestock_insurance_audit;
DROP TABLE IF EXISTS livestock_insurance_records;
COMMIT;
