-- Rollback: 001_create_exam_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_exam_management_updated ON exam_management_records;
DROP FUNCTION IF EXISTS update_exam_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_exam_management_idempotency();
DROP POLICY IF EXISTS exam_management_tenant_isolation ON exam_management_records;
DROP TABLE IF EXISTS exam_management_idempotency;
DROP TABLE IF EXISTS exam_management_audit;
DROP TABLE IF EXISTS exam_management_records;
COMMIT;
