-- Rollback: 001_create_animal_id_traceability_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_animal_id_traceability_updated ON animal_id_traceability_records;
DROP FUNCTION IF EXISTS update_animal_id_traceability_timestamp();
DROP FUNCTION IF EXISTS cleanup_animal_id_traceability_idempotency();
DROP POLICY IF EXISTS animal_id_traceability_tenant_isolation ON animal_id_traceability_records;
DROP TABLE IF EXISTS animal_id_traceability_idempotency;
DROP TABLE IF EXISTS animal_id_traceability_audit;
DROP TABLE IF EXISTS animal_id_traceability_records;
COMMIT;
