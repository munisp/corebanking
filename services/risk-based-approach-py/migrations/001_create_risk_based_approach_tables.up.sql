-- Migration: 001_create_risk_based_approach_tables
-- Service: risk-based-approach-py
-- Created: 2026-06-09
-- Description: Initial schema for risk-based-approach-py

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS risk_based_approach_records (
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
CREATE TABLE IF NOT EXISTS risk_based_approach_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES risk_based_approach_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS risk_based_approach_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_risk_based_approach_tenant ON risk_based_approach_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_based_approach_status ON risk_based_approach_records(status);
CREATE INDEX IF NOT EXISTS idx_risk_based_approach_type ON risk_based_approach_records(type);
CREATE INDEX IF NOT EXISTS idx_risk_based_approach_created ON risk_based_approach_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_based_approach_reference ON risk_based_approach_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_based_approach_audit_record ON risk_based_approach_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_risk_based_approach_audit_created ON risk_based_approach_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_based_approach_idempotency_expires ON risk_based_approach_idempotency(expires_at);

-- Row-level security
ALTER TABLE risk_based_approach_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_based_approach_tenant_isolation ON risk_based_approach_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_risk_based_approach_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_risk_based_approach_updated
    BEFORE UPDATE ON risk_based_approach_records
    FOR EACH ROW EXECUTE FUNCTION update_risk_based_approach_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_risk_based_approach_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM risk_based_approach_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
