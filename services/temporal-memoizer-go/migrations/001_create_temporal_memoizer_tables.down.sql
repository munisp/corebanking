-- Rollback: 001_create_temporal_memoizer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_temporal_memoizer_updated ON temporal_memoizer_records;
DROP FUNCTION IF EXISTS update_temporal_memoizer_timestamp();
DROP FUNCTION IF EXISTS cleanup_temporal_memoizer_idempotency();
DROP POLICY IF EXISTS temporal_memoizer_tenant_isolation ON temporal_memoizer_records;
DROP TABLE IF EXISTS temporal_memoizer_idempotency;
DROP TABLE IF EXISTS temporal_memoizer_audit;
DROP TABLE IF EXISTS temporal_memoizer_records;
COMMIT;
