-- Rollback: 001_create_corporate_doc_verification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_corporate_doc_verification_updated ON corporate_doc_verification_records;
DROP FUNCTION IF EXISTS update_corporate_doc_verification_timestamp();
DROP FUNCTION IF EXISTS cleanup_corporate_doc_verification_idempotency();
DROP POLICY IF EXISTS corporate_doc_verification_tenant_isolation ON corporate_doc_verification_records;
DROP TABLE IF EXISTS corporate_doc_verification_idempotency;
DROP TABLE IF EXISTS corporate_doc_verification_audit;
DROP TABLE IF EXISTS corporate_doc_verification_records;
COMMIT;
