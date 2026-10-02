-- Rollback for 005_w11_performance_indexes.sql
-- DROP ... CONCURRENTLY also cannot run inside a transaction block:
-- keep this file free of BEGIN/COMMIT (mirrors the up migration).
DROP INDEX CONCURRENTLY IF EXISTS idx_journalentries_tenant_posting;
DROP INDEX CONCURRENTLY IF EXISTS idx_journalentries_txnref;
DROP INDEX CONCURRENTLY IF EXISTS idx_journalentries_reversal;
DROP INDEX CONCURRENTLY IF EXISTS idx_accounts_customer_tenant_created;
