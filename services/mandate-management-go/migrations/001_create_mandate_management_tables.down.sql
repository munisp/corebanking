-- Rollback: 001_create_mandate_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mandate_management_updated ON mandate_management_records;
DROP FUNCTION IF EXISTS update_mandate_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_mandate_management_idempotency();
DROP POLICY IF EXISTS mandate_management_tenant_isolation ON mandate_management_records;
DROP TABLE IF EXISTS mandate_management_idempotency;
DROP TABLE IF EXISTS mandate_management_audit;
DROP TABLE IF EXISTS mandate_management_records;
COMMIT;
