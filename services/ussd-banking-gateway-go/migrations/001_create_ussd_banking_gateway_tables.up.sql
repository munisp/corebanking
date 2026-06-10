-- Migration: 001_create_ussd_banking_gateway_tables
-- Service: ussd-banking-gateway-go
-- Created: 2026-06-09
-- Description: Initial schema for ussd-banking-gateway-go

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS ussd_banking_gateway_records (
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
CREATE TABLE IF NOT EXISTS ussd_banking_gateway_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES ussd_banking_gateway_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS ussd_banking_gateway_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ussd_banking_gateway_tenant ON ussd_banking_gateway_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ussd_banking_gateway_status ON ussd_banking_gateway_records(status);
CREATE INDEX IF NOT EXISTS idx_ussd_banking_gateway_type ON ussd_banking_gateway_records(type);
CREATE INDEX IF NOT EXISTS idx_ussd_banking_gateway_created ON ussd_banking_gateway_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ussd_banking_gateway_reference ON ussd_banking_gateway_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ussd_banking_gateway_audit_record ON ussd_banking_gateway_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_ussd_banking_gateway_audit_created ON ussd_banking_gateway_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ussd_banking_gateway_idempotency_expires ON ussd_banking_gateway_idempotency(expires_at);

-- Row-level security
ALTER TABLE ussd_banking_gateway_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY ussd_banking_gateway_tenant_isolation ON ussd_banking_gateway_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ussd_banking_gateway_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ussd_banking_gateway_updated
    BEFORE UPDATE ON ussd_banking_gateway_records
    FOR EACH ROW EXECUTE FUNCTION update_ussd_banking_gateway_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_ussd_banking_gateway_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM ussd_banking_gateway_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
