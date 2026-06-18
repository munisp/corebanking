-- Rollback: 001_create_batch_aggregator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_batch_aggregator_updated ON batch_aggregator_records;
DROP FUNCTION IF EXISTS update_batch_aggregator_timestamp();
DROP FUNCTION IF EXISTS cleanup_batch_aggregator_idempotency();
DROP POLICY IF EXISTS batch_aggregator_tenant_isolation ON batch_aggregator_records;
DROP TABLE IF EXISTS batch_aggregator_idempotency;
DROP TABLE IF EXISTS batch_aggregator_audit;
DROP TABLE IF EXISTS batch_aggregator_records;
COMMIT;
