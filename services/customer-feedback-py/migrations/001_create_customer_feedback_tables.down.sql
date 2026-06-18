-- Rollback: 001_create_customer_feedback_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_customer_feedback_updated ON customer_feedback_records;
DROP FUNCTION IF EXISTS update_customer_feedback_timestamp();
DROP FUNCTION IF EXISTS cleanup_customer_feedback_idempotency();
DROP POLICY IF EXISTS customer_feedback_tenant_isolation ON customer_feedback_records;
DROP TABLE IF EXISTS customer_feedback_idempotency;
DROP TABLE IF EXISTS customer_feedback_audit;
DROP TABLE IF EXISTS customer_feedback_records;
COMMIT;
