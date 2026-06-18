-- Rollback: 001_create_image_scanner_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_image_scanner_updated ON image_scanner_records;
DROP FUNCTION IF EXISTS update_image_scanner_timestamp();
DROP FUNCTION IF EXISTS cleanup_image_scanner_idempotency();
DROP POLICY IF EXISTS image_scanner_tenant_isolation ON image_scanner_records;
DROP TABLE IF EXISTS image_scanner_idempotency;
DROP TABLE IF EXISTS image_scanner_audit;
DROP TABLE IF EXISTS image_scanner_records;
COMMIT;
