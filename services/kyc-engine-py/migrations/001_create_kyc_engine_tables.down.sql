-- Rollback: 001_create_kyc_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kyc_engine_updated ON kyc_engine_records;
DROP FUNCTION IF EXISTS update_kyc_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_kyc_engine_idempotency();
DROP POLICY IF EXISTS kyc_engine_tenant_isolation ON kyc_engine_records;
DROP TABLE IF EXISTS kyc_engine_idempotency;
DROP TABLE IF EXISTS kyc_engine_audit;
DROP TABLE IF EXISTS kyc_engine_records;
COMMIT;
