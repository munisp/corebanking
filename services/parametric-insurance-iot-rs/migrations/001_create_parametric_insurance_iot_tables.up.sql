-- Migration: 001_create_parametric_insurance_iot_tables
-- Service: parametric-insurance-iot-rs
-- Created: 2026-06-09
-- Description: Initial schema for parametric-insurance-iot-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS parametric_insurance_iot_records (
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
CREATE TABLE IF NOT EXISTS parametric_insurance_iot_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES parametric_insurance_iot_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS parametric_insurance_iot_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parametric_insurance_iot_tenant ON parametric_insurance_iot_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parametric_insurance_iot_status ON parametric_insurance_iot_records(status);
CREATE INDEX IF NOT EXISTS idx_parametric_insurance_iot_type ON parametric_insurance_iot_records(type);
CREATE INDEX IF NOT EXISTS idx_parametric_insurance_iot_created ON parametric_insurance_iot_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parametric_insurance_iot_reference ON parametric_insurance_iot_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parametric_insurance_iot_audit_record ON parametric_insurance_iot_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_parametric_insurance_iot_audit_created ON parametric_insurance_iot_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parametric_insurance_iot_idempotency_expires ON parametric_insurance_iot_idempotency(expires_at);

-- Row-level security
ALTER TABLE parametric_insurance_iot_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY parametric_insurance_iot_tenant_isolation ON parametric_insurance_iot_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_parametric_insurance_iot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parametric_insurance_iot_updated
    BEFORE UPDATE ON parametric_insurance_iot_records
    FOR EACH ROW EXECUTE FUNCTION update_parametric_insurance_iot_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_parametric_insurance_iot_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM parametric_insurance_iot_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
