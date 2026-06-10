-- Rollback: 001_create_cbn_returns_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cbn_returns_updated ON cbn_returns_records;
DROP FUNCTION IF EXISTS update_cbn_returns_timestamp();
DROP FUNCTION IF EXISTS cleanup_cbn_returns_idempotency();
DROP POLICY IF EXISTS cbn_returns_tenant_isolation ON cbn_returns_records;
DROP TABLE IF EXISTS cbn_returns_idempotency;
DROP TABLE IF EXISTS cbn_returns_audit;
DROP TABLE IF EXISTS cbn_returns_records;
COMMIT;
