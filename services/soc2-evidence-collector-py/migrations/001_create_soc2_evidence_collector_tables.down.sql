-- Rollback: 001_create_soc2_evidence_collector_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_soc2_evidence_collector_updated ON soc2_evidence_collector_records;
DROP FUNCTION IF EXISTS update_soc2_evidence_collector_timestamp();
DROP FUNCTION IF EXISTS cleanup_soc2_evidence_collector_idempotency();
DROP POLICY IF EXISTS soc2_evidence_collector_tenant_isolation ON soc2_evidence_collector_records;
DROP TABLE IF EXISTS soc2_evidence_collector_idempotency;
DROP TABLE IF EXISTS soc2_evidence_collector_audit;
DROP TABLE IF EXISTS soc2_evidence_collector_records;
COMMIT;
