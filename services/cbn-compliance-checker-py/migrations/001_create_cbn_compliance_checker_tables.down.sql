-- Rollback: 001_create_cbn_compliance_checker_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cbn_compliance_checker_updated ON cbn_compliance_checker_records;
DROP FUNCTION IF EXISTS update_cbn_compliance_checker_timestamp();
DROP FUNCTION IF EXISTS cleanup_cbn_compliance_checker_idempotency();
DROP POLICY IF EXISTS cbn_compliance_checker_tenant_isolation ON cbn_compliance_checker_records;
DROP TABLE IF EXISTS cbn_compliance_checker_idempotency;
DROP TABLE IF EXISTS cbn_compliance_checker_audit;
DROP TABLE IF EXISTS cbn_compliance_checker_records;
COMMIT;
