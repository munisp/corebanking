-- Rollback: 001_create_kafka_streaming_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kafka_streaming_updated ON kafka_streaming_records;
DROP FUNCTION IF EXISTS update_kafka_streaming_timestamp();
DROP FUNCTION IF EXISTS cleanup_kafka_streaming_idempotency();
DROP POLICY IF EXISTS kafka_streaming_tenant_isolation ON kafka_streaming_records;
DROP TABLE IF EXISTS kafka_streaming_idempotency;
DROP TABLE IF EXISTS kafka_streaming_audit;
DROP TABLE IF EXISTS kafka_streaming_records;
COMMIT;
