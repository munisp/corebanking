-- Migration: 001_create_kyc_self_service_tables
-- Service: kyc-self-service-py
-- Created: 2026-06-09
-- Description: Initial schema for kyc-self-service-py

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS kyc_self_service_records (
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
CREATE TABLE IF NOT EXISTS kyc_self_service_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES kyc_self_service_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS kyc_self_service_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kyc_self_service_tenant ON kyc_self_service_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_self_service_status ON kyc_self_service_records(status);
CREATE INDEX IF NOT EXISTS idx_kyc_self_service_type ON kyc_self_service_records(type);
CREATE INDEX IF NOT EXISTS idx_kyc_self_service_created ON kyc_self_service_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_self_service_reference ON kyc_self_service_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kyc_self_service_audit_record ON kyc_self_service_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_kyc_self_service_audit_created ON kyc_self_service_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_self_service_idempotency_expires ON kyc_self_service_idempotency(expires_at);

-- Row-level security
ALTER TABLE kyc_self_service_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY kyc_self_service_tenant_isolation ON kyc_self_service_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_kyc_self_service_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kyc_self_service_updated
    BEFORE UPDATE ON kyc_self_service_records
    FOR EACH ROW EXECUTE FUNCTION update_kyc_self_service_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_kyc_self_service_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM kyc_self_service_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
