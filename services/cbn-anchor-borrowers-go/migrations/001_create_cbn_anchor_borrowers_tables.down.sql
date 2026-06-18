-- Rollback: 001_create_cbn_anchor_borrowers_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cbn_anchor_borrowers_updated ON cbn_anchor_borrowers_records;
DROP FUNCTION IF EXISTS update_cbn_anchor_borrowers_timestamp();
DROP FUNCTION IF EXISTS cleanup_cbn_anchor_borrowers_idempotency();
DROP POLICY IF EXISTS cbn_anchor_borrowers_tenant_isolation ON cbn_anchor_borrowers_records;
DROP TABLE IF EXISTS cbn_anchor_borrowers_idempotency;
DROP TABLE IF EXISTS cbn_anchor_borrowers_audit;
DROP TABLE IF EXISTS cbn_anchor_borrowers_records;
COMMIT;
