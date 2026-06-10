-- Rollback: 001_create_express_rate_limiter_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_express_rate_limiter_updated ON express_rate_limiter_records;
DROP FUNCTION IF EXISTS update_express_rate_limiter_timestamp();
DROP FUNCTION IF EXISTS cleanup_express_rate_limiter_idempotency();
DROP POLICY IF EXISTS express_rate_limiter_tenant_isolation ON express_rate_limiter_records;
DROP TABLE IF EXISTS express_rate_limiter_idempotency;
DROP TABLE IF EXISTS express_rate_limiter_audit;
DROP TABLE IF EXISTS express_rate_limiter_records;
COMMIT;
