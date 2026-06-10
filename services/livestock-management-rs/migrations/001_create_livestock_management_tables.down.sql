-- Rollback: 001_create_livestock_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_livestock_management_updated ON livestock_management_records;
DROP FUNCTION IF EXISTS update_livestock_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_livestock_management_idempotency();
DROP POLICY IF EXISTS livestock_management_tenant_isolation ON livestock_management_records;
DROP TABLE IF EXISTS livestock_management_idempotency;
DROP TABLE IF EXISTS livestock_management_audit;
DROP TABLE IF EXISTS livestock_management_records;
COMMIT;
