-- Rollback: 001_create_lcr_nsfr_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_lcr_nsfr_updated ON lcr_nsfr_records;
DROP FUNCTION IF EXISTS update_lcr_nsfr_timestamp();
DROP FUNCTION IF EXISTS cleanup_lcr_nsfr_idempotency();
DROP POLICY IF EXISTS lcr_nsfr_tenant_isolation ON lcr_nsfr_records;
DROP TABLE IF EXISTS lcr_nsfr_idempotency;
DROP TABLE IF EXISTS lcr_nsfr_audit;
DROP TABLE IF EXISTS lcr_nsfr_records;
COMMIT;
