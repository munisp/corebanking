-- Rollback: 001_create_multi_entity_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_multi_entity_updated ON multi_entity_records;
DROP FUNCTION IF EXISTS update_multi_entity_timestamp();
DROP FUNCTION IF EXISTS cleanup_multi_entity_idempotency();
DROP POLICY IF EXISTS multi_entity_tenant_isolation ON multi_entity_records;
DROP TABLE IF EXISTS multi_entity_idempotency;
DROP TABLE IF EXISTS multi_entity_audit;
DROP TABLE IF EXISTS multi_entity_records;
COMMIT;
