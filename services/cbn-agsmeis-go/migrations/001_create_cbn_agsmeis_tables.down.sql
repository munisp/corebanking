-- Rollback: 001_create_cbn_agsmeis_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cbn_agsmeis_updated ON cbn_agsmeis_records;
DROP FUNCTION IF EXISTS update_cbn_agsmeis_timestamp();
DROP FUNCTION IF EXISTS cleanup_cbn_agsmeis_idempotency();
DROP POLICY IF EXISTS cbn_agsmeis_tenant_isolation ON cbn_agsmeis_records;
DROP TABLE IF EXISTS cbn_agsmeis_idempotency;
DROP TABLE IF EXISTS cbn_agsmeis_audit;
DROP TABLE IF EXISTS cbn_agsmeis_records;
COMMIT;
