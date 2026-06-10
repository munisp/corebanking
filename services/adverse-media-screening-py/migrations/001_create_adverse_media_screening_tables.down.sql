-- Rollback: 001_create_adverse_media_screening_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_adverse_media_screening_updated ON adverse_media_screening_records;
DROP FUNCTION IF EXISTS update_adverse_media_screening_timestamp();
DROP FUNCTION IF EXISTS cleanup_adverse_media_screening_idempotency();
DROP POLICY IF EXISTS adverse_media_screening_tenant_isolation ON adverse_media_screening_records;
DROP TABLE IF EXISTS adverse_media_screening_idempotency;
DROP TABLE IF EXISTS adverse_media_screening_audit;
DROP TABLE IF EXISTS adverse_media_screening_records;
COMMIT;
