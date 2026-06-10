-- Rollback: 001_create_clickjack_defender_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_clickjack_defender_updated ON clickjack_defender_records;
DROP FUNCTION IF EXISTS update_clickjack_defender_timestamp();
DROP FUNCTION IF EXISTS cleanup_clickjack_defender_idempotency();
DROP POLICY IF EXISTS clickjack_defender_tenant_isolation ON clickjack_defender_records;
DROP TABLE IF EXISTS clickjack_defender_idempotency;
DROP TABLE IF EXISTS clickjack_defender_audit;
DROP TABLE IF EXISTS clickjack_defender_records;
COMMIT;
