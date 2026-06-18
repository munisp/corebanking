-- Rollback: 001_create_credit_facility_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_credit_facility_updated ON credit_facility_records;
DROP FUNCTION IF EXISTS update_credit_facility_timestamp();
DROP FUNCTION IF EXISTS cleanup_credit_facility_idempotency();
DROP POLICY IF EXISTS credit_facility_tenant_isolation ON credit_facility_records;
DROP TABLE IF EXISTS credit_facility_idempotency;
DROP TABLE IF EXISTS credit_facility_audit;
DROP TABLE IF EXISTS credit_facility_records;
COMMIT;
