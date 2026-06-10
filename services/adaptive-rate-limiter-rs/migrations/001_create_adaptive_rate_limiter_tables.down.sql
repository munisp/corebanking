-- Rollback: 001_create_adaptive_rate_limiter_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_adaptive_rate_limiter_updated ON adaptive_rate_limiter_records;
DROP FUNCTION IF EXISTS update_adaptive_rate_limiter_timestamp();
DROP FUNCTION IF EXISTS cleanup_adaptive_rate_limiter_idempotency();
DROP POLICY IF EXISTS adaptive_rate_limiter_tenant_isolation ON adaptive_rate_limiter_records;
DROP TABLE IF EXISTS adaptive_rate_limiter_idempotency;
DROP TABLE IF EXISTS adaptive_rate_limiter_audit;
DROP TABLE IF EXISTS adaptive_rate_limiter_records;
COMMIT;
