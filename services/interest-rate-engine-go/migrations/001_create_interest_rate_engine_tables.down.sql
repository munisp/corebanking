-- Rollback: 001_create_interest_rate_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_interest_rate_engine_updated ON interest_rate_engine_records;
DROP FUNCTION IF EXISTS update_interest_rate_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_interest_rate_engine_idempotency();
DROP POLICY IF EXISTS interest_rate_engine_tenant_isolation ON interest_rate_engine_records;
DROP TABLE IF EXISTS interest_rate_engine_idempotency;
DROP TABLE IF EXISTS interest_rate_engine_audit;
DROP TABLE IF EXISTS interest_rate_engine_records;
COMMIT;
