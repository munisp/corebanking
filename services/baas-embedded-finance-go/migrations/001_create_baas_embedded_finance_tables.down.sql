-- Rollback: 001_create_baas_embedded_finance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_baas_embedded_finance_updated ON baas_embedded_finance_records;
DROP FUNCTION IF EXISTS update_baas_embedded_finance_timestamp();
DROP FUNCTION IF EXISTS cleanup_baas_embedded_finance_idempotency();
DROP POLICY IF EXISTS baas_embedded_finance_tenant_isolation ON baas_embedded_finance_records;
DROP TABLE IF EXISTS baas_embedded_finance_idempotency;
DROP TABLE IF EXISTS baas_embedded_finance_audit;
DROP TABLE IF EXISTS baas_embedded_finance_records;
COMMIT;
