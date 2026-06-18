-- Rollback: 001_create_syndicated_loans_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_syndicated_loans_updated ON syndicated_loans_records;
DROP FUNCTION IF EXISTS update_syndicated_loans_timestamp();
DROP FUNCTION IF EXISTS cleanup_syndicated_loans_idempotency();
DROP POLICY IF EXISTS syndicated_loans_tenant_isolation ON syndicated_loans_records;
DROP TABLE IF EXISTS syndicated_loans_idempotency;
DROP TABLE IF EXISTS syndicated_loans_audit;
DROP TABLE IF EXISTS syndicated_loans_records;
COMMIT;
