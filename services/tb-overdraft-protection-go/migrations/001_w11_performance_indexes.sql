-- W11 performance indexes — tb-overdraft-protection-go (finding DI-09)
--
-- This service has no migration runner today: its schema is created at boot
-- in main.go:155-166 (CREATE TABLE IF NOT EXISTS ...). Apply this file
-- manually per service database, off-peak:
--   psql $DATABASE_URL -f migrations/001_w11_performance_indexes.sql
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block — this file
-- deliberately has NO BEGIN/COMMIT and must be applied with psql -f
-- (autocommit), never via a runner that wraps files in a transaction.
--
-- DDL evidence: tb_overdraft_facilities created at main.go:155,
-- account_id @ main.go:157, created_at @ main.go:164. The table previously
-- had NO secondary indexes (PK on facility_id only).

-- W11 perf (DI-09): supports the hot draw/auth lookup
--   services/tb-overdraft-protection-go/main.go:349 (also :464, :553, :666):
--   SELECT ... FROM tb_overdraft_facilities
--   WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_od_fac_account_created
  ON tb_overdraft_facilities (account_id, created_at DESC);
