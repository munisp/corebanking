-- Rollback: 001_create_billing_ingestor_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_billing_ingestor_updated ON billing_ingestor_records;
DROP FUNCTION IF EXISTS update_billing_ingestor_timestamp();
DROP FUNCTION IF EXISTS cleanup_billing_ingestor_idempotency();
DROP POLICY IF EXISTS billing_ingestor_tenant_isolation ON billing_ingestor_records;
DROP TABLE IF EXISTS billing_ingestor_idempotency;
DROP TABLE IF EXISTS billing_ingestor_audit;
DROP TABLE IF EXISTS billing_ingestor_records;
COMMIT;
