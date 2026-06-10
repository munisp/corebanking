-- Rollback: 001_create_cbn_tiered_kyc_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cbn_tiered_kyc_updated ON cbn_tiered_kyc_records;
DROP FUNCTION IF EXISTS update_cbn_tiered_kyc_timestamp();
DROP FUNCTION IF EXISTS cleanup_cbn_tiered_kyc_idempotency();
DROP POLICY IF EXISTS cbn_tiered_kyc_tenant_isolation ON cbn_tiered_kyc_records;
DROP TABLE IF EXISTS cbn_tiered_kyc_idempotency;
DROP TABLE IF EXISTS cbn_tiered_kyc_audit;
DROP TABLE IF EXISTS cbn_tiered_kyc_records;
COMMIT;
