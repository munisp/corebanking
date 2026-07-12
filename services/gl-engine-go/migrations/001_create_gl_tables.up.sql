-- GL Engine Schema — canonical version
-- All monetary columns: BIGINT kobo (1 NGN = 100 kobo). No NUMERIC, no FLOAT.
-- Every table: RLS on tenant_id, version column, deleted_at, audit + idempotency siblings.

-- ─── glAccounts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "glAccounts" (
    "glAccountCode"     TEXT        NOT NULL,
    "tenantId"          TEXT        NOT NULL,
    "name"              TEXT        NOT NULL,
    "category"          TEXT        NOT NULL,  -- asset, liability, equity, revenue, expense
    "subcategory"       TEXT        NOT NULL,
    "parentCode"        TEXT,
    "currency"          TEXT        NOT NULL DEFAULT 'NGN',
    "balance_kobo"      BIGINT      NOT NULL DEFAULT 0,   -- kobo integer — never float
    "status"            TEXT        NOT NULL DEFAULT 'active',
    "isControlAccount"  INTEGER     NOT NULL DEFAULT 0,
    "version"           INTEGER     NOT NULL DEFAULT 1,
    "deleted_at"        TIMESTAMPTZ,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("tenantId", "glAccountCode")
);

ALTER TABLE "glAccounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "glAccounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY gl_accounts_tenant ON "glAccounts"
    USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_gl_accounts_tenant   ON "glAccounts"("tenantId");
CREATE INDEX IF NOT EXISTS idx_gl_accounts_category ON "glAccounts"("tenantId", "category");

-- ─── journalEntries ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "journalEntries" (
    "entryId"           TEXT        NOT NULL,
    "tenantId"          TEXT        NOT NULL,
    "accountId"         TEXT        NOT NULL,
    "glAccountCode"     TEXT        NOT NULL,
    "type"              TEXT        NOT NULL,  -- debit, credit
    "amount_kobo"       BIGINT      NOT NULL,  -- kobo integer — must be > 0
    "currency"          TEXT        NOT NULL DEFAULT 'NGN',
    "narration"         TEXT        NOT NULL,
    "transactionRef"    TEXT        NOT NULL,
    "batchId"           TEXT,
    "postingDate"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "valueDate"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "version"           INTEGER     NOT NULL DEFAULT 1,
    "deleted_at"        TIMESTAMPTZ,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("tenantId", "entryId"),
    CONSTRAINT je_amount_positive CHECK ("amount_kobo" > 0)
);

ALTER TABLE "journalEntries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journalEntries" FORCE ROW LEVEL SECURITY;
CREATE POLICY je_tenant ON "journalEntries"
    USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_je_tenant_gl    ON "journalEntries"("tenantId", "glAccountCode");
CREATE INDEX IF NOT EXISTS idx_je_tenant_date  ON "journalEntries"("tenantId", "postingDate" DESC);
CREATE INDEX IF NOT EXISTS idx_je_tenant_ref   ON "journalEntries"("tenantId", "transactionRef");

-- ─── trialBalances ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "trialBalances" (
    "trialBalanceId"        TEXT        NOT NULL,
    "tenantId"              TEXT        NOT NULL,
    "glAccountCode"         TEXT        NOT NULL,
    "periodStart"           TIMESTAMPTZ NOT NULL,
    "periodEnd"             TIMESTAMPTZ NOT NULL,
    "opening_balance_kobo"  BIGINT      NOT NULL DEFAULT 0,
    "total_debits_kobo"     BIGINT      NOT NULL DEFAULT 0,
    "total_credits_kobo"    BIGINT      NOT NULL DEFAULT 0,
    "closing_balance_kobo"  BIGINT      NOT NULL DEFAULT 0,
    "currency"              TEXT        NOT NULL DEFAULT 'NGN',
    "status"                TEXT        NOT NULL DEFAULT 'draft',  -- draft, approved, submitted
    "version"               INTEGER     NOT NULL DEFAULT 1,
    "deleted_at"            TIMESTAMPTZ,
    "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("trialBalanceId"),
    UNIQUE ("tenantId", "glAccountCode", "periodStart", "periodEnd")
);

ALTER TABLE "trialBalances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trialBalances" FORCE ROW LEVEL SECURITY;
CREATE POLICY tb_tenant ON "trialBalances"
    USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_tb_tenant_period ON "trialBalances"("tenantId", "periodEnd" DESC);

-- ─── efassMapping ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "efassMapping" (
    "glCodeStart"       TEXT NOT NULL,
    "glCodeEnd"         TEXT NOT NULL,
    "mbrForm"           TEXT NOT NULL,
    "mbrLine"           INTEGER NOT NULL,
    "lineName"          TEXT NOT NULL,
    "reportCategory"    TEXT NOT NULL,  -- assets, liabilities, equity, income, expenses
    "cbnCode"           TEXT NOT NULL,
    "signConvention"    TEXT NOT NULL DEFAULT 'normal',  -- normal, negate
    PRIMARY KEY ("mbrForm", "mbrLine")
);

-- efassMapping is read-only regulatory config — no RLS or tenant isolation needed.
CREATE INDEX IF NOT EXISTS idx_efass_form ON "efassMapping"("mbrForm", "mbrLine");

-- ─── GL Idempotency table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "glIdempotency" (
    "idempotencyKey"    TEXT        NOT NULL,
    "tenantId"          TEXT        NOT NULL,
    "entryId"           TEXT        NOT NULL,
    "responseBody"      JSONB       NOT NULL DEFAULT '{}',
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expiresAt"         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    PRIMARY KEY ("tenantId", "idempotencyKey")
);

ALTER TABLE "glIdempotency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "glIdempotency" FORCE ROW LEVEL SECURITY;
CREATE POLICY gl_idempotency_tenant ON "glIdempotency"
    USING ("tenantId" = current_setting('app.tenant_id', true));

-- ─── GL Audit table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "glAudit" (
    "id"                    BIGSERIAL   PRIMARY KEY,
    "tenantId"              TEXT        NOT NULL,
    "glAccountCode"         TEXT        NOT NULL,
    "action"                TEXT        NOT NULL,  -- post_journal, period_close, account_created
    "old_balance_kobo"      BIGINT,
    "new_balance_kobo"      BIGINT,
    "entry_id"              TEXT,
    "changed_by"            TEXT,
    "changedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "metadata"              JSONB       NOT NULL DEFAULT '{}'
);

ALTER TABLE "glAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "glAudit" FORCE ROW LEVEL SECURITY;
CREATE POLICY gl_audit_tenant ON "glAudit"
    USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_gl_audit_account ON "glAudit"("tenantId", "glAccountCode", "changedAt" DESC);
