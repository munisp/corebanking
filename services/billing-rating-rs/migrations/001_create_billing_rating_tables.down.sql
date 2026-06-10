-- Rollback: 001_create_billing_rating_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_billing_rating_updated ON billing_rating_records;
DROP FUNCTION IF EXISTS update_billing_rating_timestamp();
DROP FUNCTION IF EXISTS cleanup_billing_rating_idempotency();
DROP POLICY IF EXISTS billing_rating_tenant_isolation ON billing_rating_records;
DROP TABLE IF EXISTS billing_rating_idempotency;
DROP TABLE IF EXISTS billing_rating_audit;
DROP TABLE IF EXISTS billing_rating_records;
COMMIT;
