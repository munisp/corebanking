-- Rollback: 001_create_kafka_batch_producer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kafka_batch_producer_updated ON kafka_batch_producer_records;
DROP FUNCTION IF EXISTS update_kafka_batch_producer_timestamp();
DROP FUNCTION IF EXISTS cleanup_kafka_batch_producer_idempotency();
DROP POLICY IF EXISTS kafka_batch_producer_tenant_isolation ON kafka_batch_producer_records;
DROP TABLE IF EXISTS kafka_batch_producer_idempotency;
DROP TABLE IF EXISTS kafka_batch_producer_audit;
DROP TABLE IF EXISTS kafka_batch_producer_records;
COMMIT;
