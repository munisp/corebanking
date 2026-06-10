-- Rollback: 001_create_video_kyc_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_video_kyc_updated ON video_kyc_records;
DROP FUNCTION IF EXISTS update_video_kyc_timestamp();
DROP FUNCTION IF EXISTS cleanup_video_kyc_idempotency();
DROP POLICY IF EXISTS video_kyc_tenant_isolation ON video_kyc_records;
DROP TABLE IF EXISTS video_kyc_idempotency;
DROP TABLE IF EXISTS video_kyc_audit;
DROP TABLE IF EXISTS video_kyc_records;
COMMIT;
