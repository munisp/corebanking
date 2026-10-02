-- Migration V004: W11 performance indexes — transaction-ledger
--
-- Wave-11 remediation (findings DI-02, DI-03; auditor:
-- work/w11/findings/data-integration.md section A).
--
-- Runner: database/migrate.py connects with autocommit=True and each script
-- owns its own transactions (see migrate.py docstring). CREATE INDEX
-- CONCURRENTLY cannot run inside a transaction block, so this file has NO
-- BEGIN/COMMIT (unlike V002, which used plain CREATE INDEX inside BEGIN).
--
-- Table: "transaction" (quoted — reserved word), SQLAlchemy model at
-- models/transaction.py:29 (__tablename__ = "transaction").
-- Column DDL evidence (models/transaction.py):
--   payer @ :52, payer_account_number @ :53, payee_account_number @ :56,
--   status @ :65, completed_at @ :71, tenant_id @ :77,
--   created_at @ models/mixins.py:36 (TimestampMixin).
--
-- NOTE on DI-01 (ix_transaction_tenant_completed ON (tenant_id,
-- completed_at DESC)): deliberately NOT recreated here — V002 already created
-- the identical index as ix_transaction_completed_at
-- (database/migrations/V002__transaction_idempotency_and_numeric_amount.sql:75-76).
-- A second identical btree would only cost write throughput.
--
-- NOTE on DI-03 predicate case: the transactionstatus enum stores the Python
-- enum NAMES (SQLAlchemy Enum default), so the DB label is 'SUCCESS'
-- uppercase — confirmed by seed inserts using 'SUCCESS'
-- (seed_transactions.sql:13, seed_additional_accounts.sql:14+). The partial
-- predicate below must stay 'SUCCESS', not 'success'.

-- W11 perf (DI-02): supports
--   services/transaction-ledger/repositories/transaction.py:530-546
--   (fetch_account_number_transactions: WHERE tenant_id AND
--    (payer_account_number = X OR payee_account_number = X)
--    ORDER BY completed_at DESC).
--   The OR cannot use ix_transaction_account_numbers (payer,payee,tenant)
--   which requires equality on payer first; these two indexes serve the two
--   legs of the UNION ALL rewrite (payer leg / payee leg respectively).
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_transaction_payer_acct_time
  ON "transaction" (payer_account_number, tenant_id, completed_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_transaction_payee_acct_time
  ON "transaction" (payee_account_number, tenant_id, completed_at DESC);

-- W11 perf (DI-03): supports
--   services/transaction-ledger/repositories/transaction.py:589-602
--   (fetch_account_daily_debit_total: SUM(amount) WHERE tenant_id AND
--    payer = account AND status = SUCCESS AND created_at >= now()-24h —
--    executed per outgoing transfer for velocity-limit checks).
--   Partial index keeps only successful rows, so it stays small.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_transaction_payer_velocity
  ON "transaction" (payer, tenant_id, created_at) WHERE status = 'SUCCESS';
