-- Rollback: 001_create_insurance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_insurance_updated ON insurance_records;
DROP FUNCTION IF EXISTS update_insurance_timestamp();
DROP FUNCTION IF EXISTS cleanup_insurance_idempotency();
DROP POLICY IF EXISTS insurance_tenant_isolation ON insurance_records;
DROP TABLE IF EXISTS insurance_idempotency;
DROP TABLE IF EXISTS insurance_audit;
DROP TABLE IF EXISTS insurance_records;
COMMIT;
