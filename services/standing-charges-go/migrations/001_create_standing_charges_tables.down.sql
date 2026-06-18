-- Rollback: 001_create_standing_charges_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_standing_charges_updated ON standing_charges_records;
DROP FUNCTION IF EXISTS update_standing_charges_timestamp();
DROP FUNCTION IF EXISTS cleanup_standing_charges_idempotency();
DROP POLICY IF EXISTS standing_charges_tenant_isolation ON standing_charges_records;
DROP TABLE IF EXISTS standing_charges_idempotency;
DROP TABLE IF EXISTS standing_charges_audit;
DROP TABLE IF EXISTS standing_charges_records;
COMMIT;
