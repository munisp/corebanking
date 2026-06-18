-- Rollback: 001_create_ip_allowlist_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ip_allowlist_updated ON ip_allowlist_records;
DROP FUNCTION IF EXISTS update_ip_allowlist_timestamp();
DROP FUNCTION IF EXISTS cleanup_ip_allowlist_idempotency();
DROP POLICY IF EXISTS ip_allowlist_tenant_isolation ON ip_allowlist_records;
DROP TABLE IF EXISTS ip_allowlist_idempotency;
DROP TABLE IF EXISTS ip_allowlist_audit;
DROP TABLE IF EXISTS ip_allowlist_records;
COMMIT;
