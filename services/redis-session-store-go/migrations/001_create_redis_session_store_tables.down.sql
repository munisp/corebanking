-- Rollback: 001_create_redis_session_store_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_redis_session_store_updated ON redis_session_store_records;
DROP FUNCTION IF EXISTS update_redis_session_store_timestamp();
DROP FUNCTION IF EXISTS cleanup_redis_session_store_idempotency();
DROP POLICY IF EXISTS redis_session_store_tenant_isolation ON redis_session_store_records;
DROP TABLE IF EXISTS redis_session_store_idempotency;
DROP TABLE IF EXISTS redis_session_store_audit;
DROP TABLE IF EXISTS redis_session_store_records;
COMMIT;
