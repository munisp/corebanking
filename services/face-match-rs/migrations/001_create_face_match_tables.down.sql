-- Rollback: 001_create_face_match_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_face_match_updated ON face_match_records;
DROP FUNCTION IF EXISTS update_face_match_timestamp();
DROP FUNCTION IF EXISTS cleanup_face_match_idempotency();
DROP POLICY IF EXISTS face_match_tenant_isolation ON face_match_records;
DROP TABLE IF EXISTS face_match_idempotency;
DROP TABLE IF EXISTS face_match_audit;
DROP TABLE IF EXISTS face_match_records;
COMMIT;
