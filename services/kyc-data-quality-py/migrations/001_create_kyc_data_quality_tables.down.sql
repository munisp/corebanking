-- Rollback: 001_create_kyc_data_quality_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kyc_data_quality_updated ON kyc_data_quality_records;
DROP FUNCTION IF EXISTS update_kyc_data_quality_timestamp();
DROP FUNCTION IF EXISTS cleanup_kyc_data_quality_idempotency();
DROP POLICY IF EXISTS kyc_data_quality_tenant_isolation ON kyc_data_quality_records;
DROP TABLE IF EXISTS kyc_data_quality_idempotency;
DROP TABLE IF EXISTS kyc_data_quality_audit;
DROP TABLE IF EXISTS kyc_data_quality_records;
COMMIT;
