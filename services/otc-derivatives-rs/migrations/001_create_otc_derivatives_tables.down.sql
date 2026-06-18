-- Rollback: 001_create_otc_derivatives_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_otc_derivatives_updated ON otc_derivatives_records;
DROP FUNCTION IF EXISTS update_otc_derivatives_timestamp();
DROP FUNCTION IF EXISTS cleanup_otc_derivatives_idempotency();
DROP POLICY IF EXISTS otc_derivatives_tenant_isolation ON otc_derivatives_records;
DROP TABLE IF EXISTS otc_derivatives_idempotency;
DROP TABLE IF EXISTS otc_derivatives_audit;
DROP TABLE IF EXISTS otc_derivatives_records;
COMMIT;
