-- Rollback: 001_create_escrow_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_escrow_updated ON escrow_records;
DROP FUNCTION IF EXISTS update_escrow_timestamp();
DROP FUNCTION IF EXISTS cleanup_escrow_idempotency();
DROP POLICY IF EXISTS escrow_tenant_isolation ON escrow_records;
DROP TABLE IF EXISTS escrow_idempotency;
DROP TABLE IF EXISTS escrow_audit;
DROP TABLE IF EXISTS escrow_records;
COMMIT;
