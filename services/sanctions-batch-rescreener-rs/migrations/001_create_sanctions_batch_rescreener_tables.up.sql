-- Migration: 001_create_sanctions_batch_rescreener_tables
-- Service: sanctions-batch-rescreener-rs
-- Created: 2026-06-09
-- Description: Initial schema for sanctions-batch-rescreener-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS sanctions_batch_rescreener_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'primary',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    data JSONB NOT NULL DEFAULT '{}',
    amount_kobo BIGINT DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    reference VARCHAR(128) UNIQUE,
    created_by VARCHAR(128),
    updated_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1
);

-- Audit trail table
CREATE TABLE IF NOT EXISTS sanctions_batch_rescreener_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES sanctions_batch_rescreener_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS sanctions_batch_rescreener_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sanctions_batch_rescreener_tenant ON sanctions_batch_rescreener_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_batch_rescreener_status ON sanctions_batch_rescreener_records(status);
CREATE INDEX IF NOT EXISTS idx_sanctions_batch_rescreener_type ON sanctions_batch_rescreener_records(type);
CREATE INDEX IF NOT EXISTS idx_sanctions_batch_rescreener_created ON sanctions_batch_rescreener_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sanctions_batch_rescreener_reference ON sanctions_batch_rescreener_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sanctions_batch_rescreener_audit_record ON sanctions_batch_rescreener_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_batch_rescreener_audit_created ON sanctions_batch_rescreener_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sanctions_batch_rescreener_idempotency_expires ON sanctions_batch_rescreener_idempotency(expires_at);

-- Row-level security
ALTER TABLE sanctions_batch_rescreener_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY sanctions_batch_rescreener_tenant_isolation ON sanctions_batch_rescreener_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_sanctions_batch_rescreener_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sanctions_batch_rescreener_updated
    BEFORE UPDATE ON sanctions_batch_rescreener_records
    FOR EACH ROW EXECUTE FUNCTION update_sanctions_batch_rescreener_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_sanctions_batch_rescreener_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM sanctions_batch_rescreener_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
