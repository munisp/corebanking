-- Rollback: 001_create_goaml_integration_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_goaml_integration_updated ON goaml_integration_records;
DROP FUNCTION IF EXISTS update_goaml_integration_timestamp();
DROP FUNCTION IF EXISTS cleanup_goaml_integration_idempotency();
DROP POLICY IF EXISTS goaml_integration_tenant_isolation ON goaml_integration_records;
DROP TABLE IF EXISTS goaml_integration_idempotency;
DROP TABLE IF EXISTS goaml_integration_audit;
DROP TABLE IF EXISTS goaml_integration_records;
COMMIT;
