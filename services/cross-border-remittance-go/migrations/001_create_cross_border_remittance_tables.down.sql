-- Rollback: 001_create_cross_border_remittance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cross_border_remittance_updated ON cross_border_remittance_records;
DROP FUNCTION IF EXISTS update_cross_border_remittance_timestamp();
DROP FUNCTION IF EXISTS cleanup_cross_border_remittance_idempotency();
DROP POLICY IF EXISTS cross_border_remittance_tenant_isolation ON cross_border_remittance_records;
DROP TABLE IF EXISTS cross_border_remittance_idempotency;
DROP TABLE IF EXISTS cross_border_remittance_audit;
DROP TABLE IF EXISTS cross_border_remittance_records;
COMMIT;
