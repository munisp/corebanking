-- Rollback: 001_create_sanctions_screening_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sanctions_screening_updated ON sanctions_screening_records;
DROP FUNCTION IF EXISTS update_sanctions_screening_timestamp();
DROP FUNCTION IF EXISTS cleanup_sanctions_screening_idempotency();
DROP POLICY IF EXISTS sanctions_screening_tenant_isolation ON sanctions_screening_records;
DROP TABLE IF EXISTS sanctions_screening_idempotency;
DROP TABLE IF EXISTS sanctions_screening_audit;
DROP TABLE IF EXISTS sanctions_screening_records;
COMMIT;
