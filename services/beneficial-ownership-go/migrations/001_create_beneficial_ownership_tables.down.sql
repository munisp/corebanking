-- Rollback: 001_create_beneficial_ownership_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_beneficial_ownership_updated ON beneficial_ownership_records;
DROP FUNCTION IF EXISTS update_beneficial_ownership_timestamp();
DROP FUNCTION IF EXISTS cleanup_beneficial_ownership_idempotency();
DROP POLICY IF EXISTS beneficial_ownership_tenant_isolation ON beneficial_ownership_records;
DROP TABLE IF EXISTS beneficial_ownership_idempotency;
DROP TABLE IF EXISTS beneficial_ownership_audit;
DROP TABLE IF EXISTS beneficial_ownership_records;
COMMIT;
