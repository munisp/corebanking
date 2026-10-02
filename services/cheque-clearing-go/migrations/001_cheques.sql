-- MN-21: cheque lifecycle persistence (expand-only). Also applied
-- idempotently at service startup (initDB) for environments without a
-- migration runner.
CREATE TABLE IF NOT EXISTS cheques (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    cheque_number TEXT NOT NULL,
    amount_kobo BIGINT NOT NULL,          -- integer minor units, never float
    currency TEXT NOT NULL DEFAULT 'NGN',
    drawer_account TEXT NOT NULL,         -- TB account id (hex)
    payee_account TEXT NOT NULL,          -- TB account id (hex) or external ref
    bank_code TEXT,
    branch_code TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | clearing | cleared | dishonored | returned
    hold_transfer_id TEXT,                -- TB pending transfer id (hex) placed at presentment
    dishonor_reason TEXT,
    presented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cleared_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cheque_number, drawer_account) -- idempotent presentment
);

-- Fail-soft outbox for dishonor-fee journals to gl-engine-go.
CREATE TABLE IF NOT EXISTS cheque_outbox (
    id BIGSERIAL PRIMARY KEY,
    cheque_id TEXT NOT NULL,
    kind TEXT NOT NULL,                   -- dishonor_fee_journal
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);
