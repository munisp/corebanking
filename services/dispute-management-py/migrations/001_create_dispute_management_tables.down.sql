-- Rollback: 001_create_dispute_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_dispute_management_updated ON dispute_management_records;
DROP FUNCTION IF EXISTS update_dispute_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_dispute_management_idempotency();
DROP POLICY IF EXISTS dispute_management_tenant_isolation ON dispute_management_records;
DROP TABLE IF EXISTS dispute_management_idempotency;
DROP TABLE IF EXISTS dispute_management_audit;
DROP TABLE IF EXISTS dispute_management_records;
COMMIT;
