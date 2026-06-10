-- Rollback: 001_create_kafka_consumer_optimizer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kafka_consumer_optimizer_updated ON kafka_consumer_optimizer_records;
DROP FUNCTION IF EXISTS update_kafka_consumer_optimizer_timestamp();
DROP FUNCTION IF EXISTS cleanup_kafka_consumer_optimizer_idempotency();
DROP POLICY IF EXISTS kafka_consumer_optimizer_tenant_isolation ON kafka_consumer_optimizer_records;
DROP TABLE IF EXISTS kafka_consumer_optimizer_idempotency;
DROP TABLE IF EXISTS kafka_consumer_optimizer_audit;
DROP TABLE IF EXISTS kafka_consumer_optimizer_records;
COMMIT;
