-- Rollback: 001_create_efass_kyc_returns_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_efass_kyc_returns_updated ON efass_kyc_returns_records;
DROP FUNCTION IF EXISTS update_efass_kyc_returns_timestamp();
DROP FUNCTION IF EXISTS cleanup_efass_kyc_returns_idempotency();
DROP POLICY IF EXISTS efass_kyc_returns_tenant_isolation ON efass_kyc_returns_records;
DROP TABLE IF EXISTS efass_kyc_returns_idempotency;
DROP TABLE IF EXISTS efass_kyc_returns_audit;
DROP TABLE IF EXISTS efass_kyc_returns_records;
COMMIT;
