-- V005 (W13-RISK-20/21): wire the transaction_audit writer + deprecate the
-- superseded transaction_idempotency table.
--
-- RISK-20: transaction_audit was created in V003 with RLS + indexes but had
-- NO writer — no trigger and no code path — so the ledger audit trail was
-- never recorded. This migration installs a trigger on "transaction" that
-- records created / updated / reversed actions with old/new amount (kobo)
-- and status. The trigger runs inside the same DB transaction as the write,
-- so audit persistence is fail-closed: if the audit row cannot be written,
-- the business write rolls back too.
--
-- RISK-21: transaction_idempotency (V003) is dead — idempotency is enforced
-- by the uq_transaction_tenant_txn_id constraint with INSERT ... ON CONFLICT
-- DO NOTHING in repositories/transaction.py (initiate_transaction). The
-- table is kept for backward compatibility but marked DEPRECATED; no code
-- may write it.

-- ─── 1. Audit trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION transaction_audit_record() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO transaction_audit (
            transaction_id, tenant_id, action,
            old_amount_kobo, new_amount_kobo,
            old_status, new_status,
            changed_by, metadata
        ) VALUES (
            NEW.transaction_id, NEW.tenant_id, 'created',
            NULL, NEW.amount_kobo,
            NULL, NEW.status::text,
            current_setting('app.tenant_id', true),
            jsonb_build_object('source', 'transaction_audit_record', 'op', TG_OP)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Record only financially meaningful changes (status or amount);
        -- touch-only updates (e.g. note edits) are not audit events.
        IF NEW.status IS DISTINCT FROM OLD.status
           OR NEW.amount IS DISTINCT FROM OLD.amount THEN
            INSERT INTO transaction_audit (
                transaction_id, tenant_id, action,
                old_amount_kobo, new_amount_kobo,
                old_status, new_status,
                changed_by, metadata
            ) VALUES (
                NEW.transaction_id, NEW.tenant_id,
                CASE WHEN NEW.status::text = 'reversed' THEN 'reversed' ELSE 'updated' END,
                OLD.amount_kobo, NEW.amount_kobo,
                OLD.status::text, NEW.status::text,
                current_setting('app.tenant_id', true),
                jsonb_build_object('source', 'transaction_audit_record', 'op', TG_OP)
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transaction_audit'
    ) THEN
        CREATE TRIGGER trg_transaction_audit
            AFTER INSERT OR UPDATE ON "transaction"
            FOR EACH ROW EXECUTE FUNCTION transaction_audit_record();
    END IF;
END
$$;

-- ─── 2. Deprecation marker for the dead idempotency table ─────────────────────
COMMENT ON TABLE transaction_idempotency IS
    'DEPRECATED (W13-RISK-21): no writer exists. Idempotency is enforced by '
    'the uq_transaction_tenant_txn_id unique constraint on "transaction" with '
    'INSERT ... ON CONFLICT DO NOTHING (repositories/transaction.py). Kept for '
    'backward compatibility only; do not write new rows here.';
