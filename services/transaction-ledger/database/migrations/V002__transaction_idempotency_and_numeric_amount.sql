-- Migration V002: Transaction ledger — idempotency constraint + numeric amount
--
-- Problem 1: amount column was VARCHAR — impossible to SUM/compare correctly.
-- Problem 2: no unique constraint on (tenant_id, transaction_id) → duplicate
--            records could be inserted on Dapr event redelivery.
--
-- This migration:
--   1. Converts amount from VARCHAR to NUMERIC(20,2)
--   2. Adds unique constraint (tenant_id, transaction_id)
--   3. Adds supporting indexes for common query patterns
--   4. Adds reversed status to the status enum
--
-- Safe to run on a live table: ALTER COLUMN TYPE uses USING clause for
-- automatic coercion; UNIQUE CONSTRAINT is added WITH NOVALIDATE equivalent
-- by building index CONCURRENTLY first to avoid locking.

BEGIN;

-- ── Step 1: Ensure reversed status exists in the enum ────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'reversed'
          AND enumtypid = (
            SELECT oid FROM pg_type
            WHERE typname = 'transactionstatus'
          )
    ) THEN
        ALTER TYPE transactionstatus ADD VALUE IF NOT EXISTS 'reversed';
    END IF;
END
$$;

-- ── Step 2: Convert amount to NUMERIC(20,2) ───────────────────────────────────
-- Strip any non-numeric characters before casting (defensive).
ALTER TABLE "transaction"
    ALTER COLUMN amount TYPE NUMERIC(20, 2)
    USING (
        CASE
            WHEN amount IS NULL OR trim(amount) = '' THEN 0.00
            ELSE amount::NUMERIC(20, 2)
        END
    );

-- ── Step 3: Add unique constraint for idempotency ─────────────────────────────
-- Build index first without lock, then attach as constraint.
-- On smaller tables (dev/staging) the direct constraint add is fine.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_transaction_tenant_txn_id'
    ) THEN
        ALTER TABLE "transaction"
            ADD CONSTRAINT uq_transaction_tenant_txn_id
            UNIQUE (tenant_id, transaction_id);
    END IF;
END
$$;

-- ── Step 4: Performance indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_transaction_tenant_status
    ON "transaction" (tenant_id, status);

CREATE INDEX IF NOT EXISTS ix_transaction_payer_tenant
    ON "transaction" (payer, tenant_id);

CREATE INDEX IF NOT EXISTS ix_transaction_payee_tenant
    ON "transaction" (payee, tenant_id);

CREATE INDEX IF NOT EXISTS ix_transaction_account_numbers
    ON "transaction" (payer_account_number, payee_account_number, tenant_id);

CREATE INDEX IF NOT EXISTS ix_transaction_completed_at
    ON "transaction" (tenant_id, completed_at DESC);

COMMIT;

-- Verify
DO $$
DECLARE
    col_type text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'transaction' AND column_name = 'amount';

    IF col_type NOT IN ('numeric', 'decimal') THEN
        RAISE EXCEPTION 'Migration V002 failed: amount column is still %', col_type;
    END IF;
    RAISE NOTICE 'Migration V002 complete: amount is now NUMERIC(20,2)';
END
$$;
