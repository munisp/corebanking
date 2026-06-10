-- Rollback: 001_create_kyc_self_service_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kyc_self_service_updated ON kyc_self_service_records;
DROP FUNCTION IF EXISTS update_kyc_self_service_timestamp();
DROP FUNCTION IF EXISTS cleanup_kyc_self_service_idempotency();
DROP POLICY IF EXISTS kyc_self_service_tenant_isolation ON kyc_self_service_records;
DROP TABLE IF EXISTS kyc_self_service_idempotency;
DROP TABLE IF EXISTS kyc_self_service_audit;
DROP TABLE IF EXISTS kyc_self_service_records;
COMMIT;
