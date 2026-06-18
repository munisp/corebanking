-- Rollback: 001_create_ndpr_compliance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ndpr_compliance_updated ON ndpr_compliance_records;
DROP FUNCTION IF EXISTS update_ndpr_compliance_timestamp();
DROP FUNCTION IF EXISTS cleanup_ndpr_compliance_idempotency();
DROP POLICY IF EXISTS ndpr_compliance_tenant_isolation ON ndpr_compliance_records;
DROP TABLE IF EXISTS ndpr_compliance_idempotency;
DROP TABLE IF EXISTS ndpr_compliance_audit;
DROP TABLE IF EXISTS ndpr_compliance_records;
COMMIT;
