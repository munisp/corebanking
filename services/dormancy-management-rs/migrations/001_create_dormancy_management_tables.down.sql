-- Rollback: 001_create_dormancy_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_dormancy_management_updated ON dormancy_management_records;
DROP FUNCTION IF EXISTS update_dormancy_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_dormancy_management_idempotency();
DROP POLICY IF EXISTS dormancy_management_tenant_isolation ON dormancy_management_records;
DROP TABLE IF EXISTS dormancy_management_idempotency;
DROP TABLE IF EXISTS dormancy_management_audit;
DROP TABLE IF EXISTS dormancy_management_records;
COMMIT;
