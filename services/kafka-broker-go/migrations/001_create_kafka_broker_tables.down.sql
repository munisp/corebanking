-- Rollback: 001_create_kafka_broker_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kafka_broker_updated ON kafka_broker_records;
DROP FUNCTION IF EXISTS update_kafka_broker_timestamp();
DROP FUNCTION IF EXISTS cleanup_kafka_broker_idempotency();
DROP POLICY IF EXISTS kafka_broker_tenant_isolation ON kafka_broker_records;
DROP TABLE IF EXISTS kafka_broker_idempotency;
DROP TABLE IF EXISTS kafka_broker_audit;
DROP TABLE IF EXISTS kafka_broker_records;
COMMIT;
