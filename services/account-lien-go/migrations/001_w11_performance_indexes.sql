-- W11 performance indexes — account-lien-go (finding DI-10)
--
-- This service has no migration runner today: its schema is created at boot
-- in main.go:65-79 (CREATE TABLE IF NOT EXISTS liens ... plus two
-- single-column indexes). Apply this file manually per service database,
-- off-peak:
--   psql $DATABASE_URL -f migrations/001_w11_performance_indexes.sql
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block — this file
-- deliberately has NO BEGIN/COMMIT and must be applied with psql -f
-- (autocommit), never via a runner that wraps files in a transaction.
--
-- DDL evidence: liens created at main.go:65, account_id @ main.go:67,
-- status @ main.go:72. Existing indexes are single-column
-- idx_liens_account(account_id) and idx_liens_status(status) (main.go:78-79);
-- Postgres cannot bitmap-AND them efficiently for this hot per-enquiry SUM.

-- W11 perf (DI-10): supports the balance-check lien total
--   services/account-lien-go/main.go:127:
--   SELECT COALESCE(SUM(amount_kobo),0) FROM liens
--   WHERE account_id = $1 AND status = 'active'
-- Partial index: only 'active' liens are ever summed, keeping it tiny.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_liens_account_active
  ON liens (account_id) WHERE status = 'active';
