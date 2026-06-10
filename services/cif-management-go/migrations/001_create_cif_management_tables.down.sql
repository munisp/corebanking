-- Rollback: 001_create_cif_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cif_management_updated ON cif_management_records;
DROP FUNCTION IF EXISTS update_cif_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_cif_management_idempotency();
DROP POLICY IF EXISTS cif_management_tenant_isolation ON cif_management_records;
DROP TABLE IF EXISTS cif_management_idempotency;
DROP TABLE IF EXISTS cif_management_audit;
DROP TABLE IF EXISTS cif_management_records;
COMMIT;
