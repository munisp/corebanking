-- Rollback: 001_create_kafka_schema_registry_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kafka_schema_registry_updated ON kafka_schema_registry_records;
DROP FUNCTION IF EXISTS update_kafka_schema_registry_timestamp();
DROP FUNCTION IF EXISTS cleanup_kafka_schema_registry_idempotency();
DROP POLICY IF EXISTS kafka_schema_registry_tenant_isolation ON kafka_schema_registry_records;
DROP TABLE IF EXISTS kafka_schema_registry_idempotency;
DROP TABLE IF EXISTS kafka_schema_registry_audit;
DROP TABLE IF EXISTS kafka_schema_registry_records;
COMMIT;
