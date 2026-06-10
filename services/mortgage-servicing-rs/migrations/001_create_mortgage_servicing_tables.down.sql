-- Rollback: 001_create_mortgage_servicing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mortgage_servicing_updated ON mortgage_servicing_records;
DROP FUNCTION IF EXISTS update_mortgage_servicing_timestamp();
DROP FUNCTION IF EXISTS cleanup_mortgage_servicing_idempotency();
DROP POLICY IF EXISTS mortgage_servicing_tenant_isolation ON mortgage_servicing_records;
DROP TABLE IF EXISTS mortgage_servicing_idempotency;
DROP TABLE IF EXISTS mortgage_servicing_audit;
DROP TABLE IF EXISTS mortgage_servicing_records;
COMMIT;
