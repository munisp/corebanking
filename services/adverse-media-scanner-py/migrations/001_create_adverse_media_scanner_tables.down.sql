-- Rollback: 001_create_adverse_media_scanner_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_adverse_media_scanner_updated ON adverse_media_scanner_records;
DROP FUNCTION IF EXISTS update_adverse_media_scanner_timestamp();
DROP FUNCTION IF EXISTS cleanup_adverse_media_scanner_idempotency();
DROP POLICY IF EXISTS adverse_media_scanner_tenant_isolation ON adverse_media_scanner_records;
DROP TABLE IF EXISTS adverse_media_scanner_idempotency;
DROP TABLE IF EXISTS adverse_media_scanner_audit;
DROP TABLE IF EXISTS adverse_media_scanner_records;
COMMIT;
