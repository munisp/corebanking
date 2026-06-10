-- Rollback: 001_create_interest_computation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_interest_computation_updated ON interest_computation_records;
DROP FUNCTION IF EXISTS update_interest_computation_timestamp();
DROP FUNCTION IF EXISTS cleanup_interest_computation_idempotency();
DROP POLICY IF EXISTS interest_computation_tenant_isolation ON interest_computation_records;
DROP TABLE IF EXISTS interest_computation_idempotency;
DROP TABLE IF EXISTS interest_computation_audit;
DROP TABLE IF EXISTS interest_computation_records;
COMMIT;
