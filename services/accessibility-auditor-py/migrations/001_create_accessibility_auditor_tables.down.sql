-- Rollback: 001_create_accessibility_auditor_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_accessibility_auditor_updated ON accessibility_auditor_records;
DROP FUNCTION IF EXISTS update_accessibility_auditor_timestamp();
DROP FUNCTION IF EXISTS cleanup_accessibility_auditor_idempotency();
DROP POLICY IF EXISTS accessibility_auditor_tenant_isolation ON accessibility_auditor_records;
DROP TABLE IF EXISTS accessibility_auditor_idempotency;
DROP TABLE IF EXISTS accessibility_auditor_audit;
DROP TABLE IF EXISTS accessibility_auditor_records;
COMMIT;
