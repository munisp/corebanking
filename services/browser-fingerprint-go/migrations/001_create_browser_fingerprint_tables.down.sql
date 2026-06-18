-- Rollback: 001_create_browser_fingerprint_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_browser_fingerprint_updated ON browser_fingerprint_records;
DROP FUNCTION IF EXISTS update_browser_fingerprint_timestamp();
DROP FUNCTION IF EXISTS cleanup_browser_fingerprint_idempotency();
DROP POLICY IF EXISTS browser_fingerprint_tenant_isolation ON browser_fingerprint_records;
DROP TABLE IF EXISTS browser_fingerprint_idempotency;
DROP TABLE IF EXISTS browser_fingerprint_audit;
DROP TABLE IF EXISTS browser_fingerprint_records;
COMMIT;
