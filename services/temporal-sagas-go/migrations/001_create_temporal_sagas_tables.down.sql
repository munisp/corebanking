-- Rollback: 001_create_temporal_sagas_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_temporal_sagas_updated ON temporal_sagas_records;
DROP FUNCTION IF EXISTS update_temporal_sagas_timestamp();
DROP FUNCTION IF EXISTS cleanup_temporal_sagas_idempotency();
DROP POLICY IF EXISTS temporal_sagas_tenant_isolation ON temporal_sagas_records;
DROP TABLE IF EXISTS temporal_sagas_idempotency;
DROP TABLE IF EXISTS temporal_sagas_audit;
DROP TABLE IF EXISTS temporal_sagas_records;
COMMIT;
