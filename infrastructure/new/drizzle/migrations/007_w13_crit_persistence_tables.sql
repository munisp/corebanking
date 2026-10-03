-- 007: W13-FIX-CRIT — persistence tables for the 9 CRITICAL data-loss findings
-- Services also CREATE TABLE IF NOT EXISTS at boot (canonical fail-closed
-- pattern); this migration provisions them via the schema runner as well.
-- All DDL is idempotent (IF NOT EXISTS).

-- ─── chatbot-service (C1/C2/C3) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chatbot_intents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    intent TEXT NOT NULL,
    patterns JSONB NOT NULL DEFAULT '[]',
    responses JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    require_auth BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chatbot_intents_tenant ON chatbot_intents (tenant_id);

CREATE TABLE IF NOT EXISTS chatbot_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_tenant ON chatbot_sessions (tenant_id);

CREATE TABLE IF NOT EXISTS chatbot_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    intent TEXT NOT NULL DEFAULT '',
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session ON chatbot_messages (session_id, id);

CREATE TABLE IF NOT EXISTS chatbot_handoffs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    agent_id TEXT NOT NULL DEFAULT '',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chatbot_handoffs_session ON chatbot_handoffs (session_id);

CREATE TABLE IF NOT EXISTS chatbot_training_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chatbot_training_jobs_tenant ON chatbot_training_jobs (tenant_id, created_at DESC);

-- ─── kpi-threshold-monitor-rs (C4) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kpi_thresholds (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    metric_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    condition TEXT NOT NULL,
    threshold_value DOUBLE PRECISION NOT NULL,
    severity TEXT NOT NULL,
    action TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    cooldown_minutes INTEGER NOT NULL DEFAULT 0,
    last_triggered TIMESTAMPTZ,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kpi_alerts (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    role TEXT NOT NULL,
    metric_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    current_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    message TEXT NOT NULL DEFAULT '',
    action_taken TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_kpi_alerts_status ON kpi_alerts (status);
CREATE INDEX IF NOT EXISTS idx_kpi_alerts_role ON kpi_alerts (role);

-- ─── pin-block-engine-rs (C6) — hash + salt only, never the PIN ─────────────
CREATE TABLE IF NOT EXISTS pin_hashes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    account_number TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    hash_hex TEXT NOT NULL,
    salt TEXT NOT NULL,
    iterations INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pin_hashes_tenant ON pin_hashes (tenant_id);

-- ─── telegram-service (C7) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_messages (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT '',
    chat_id BIGINT NOT NULL,
    direction TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat ON telegram_messages (chat_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_status ON telegram_messages (status);

-- ─── watchlist-manager-rs (C8) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_watchlist_entries_tenant ON watchlist_entries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_entries_status ON watchlist_entries (status);

-- ─── wire-transfer-monitor-rs (C9) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wire_transfer_monitor_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wtm_records_tenant ON wire_transfer_monitor_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_wtm_records_status ON wire_transfer_monitor_records (status);
