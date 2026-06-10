-- Rollback: 001_create_temporal_worker_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_temporal_worker_updated ON temporal_worker_records;
DROP FUNCTION IF EXISTS update_temporal_worker_timestamp();
DROP FUNCTION IF EXISTS cleanup_temporal_worker_idempotency();
DROP POLICY IF EXISTS temporal_worker_tenant_isolation ON temporal_worker_records;
DROP TABLE IF EXISTS temporal_worker_idempotency;
DROP TABLE IF EXISTS temporal_worker_audit;
DROP TABLE IF EXISTS temporal_worker_records;
COMMIT;
