-- Rollback: 001_create_kyc_aml_screening_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kyc_aml_screening_updated ON kyc_aml_screening_records;
DROP FUNCTION IF EXISTS update_kyc_aml_screening_timestamp();
DROP FUNCTION IF EXISTS cleanup_kyc_aml_screening_idempotency();
DROP POLICY IF EXISTS kyc_aml_screening_tenant_isolation ON kyc_aml_screening_records;
DROP TABLE IF EXISTS kyc_aml_screening_idempotency;
DROP TABLE IF EXISTS kyc_aml_screening_audit;
DROP TABLE IF EXISTS kyc_aml_screening_records;
COMMIT;
