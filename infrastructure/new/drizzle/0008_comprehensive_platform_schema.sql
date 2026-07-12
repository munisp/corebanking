-- 0008_comprehensive_platform_schema.sql
-- Comprehensive schema migration for 54Bank Core Banking Platform
-- Covers all 294 Drizzle schema tables + 20 new middleware integration tables
-- Generated: 2026-07-11

-- ─── Core Identity & Tenant Tables ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "username" VARCHAR(128) UNIQUE,
  "role" VARCHAR(64) NOT NULL DEFAULT 'user',
  "tenant_id" VARCHAR(64),
  "keycloak_id" VARCHAR(128) UNIQUE,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "last_signed_in" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL UNIQUE,
  "name" VARCHAR(256) NOT NULL,
  "slug" VARCHAR(128) UNIQUE,
  "tier" VARCHAR(32) NOT NULL DEFAULT 'standard',
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "country" VARCHAR(3) DEFAULT 'NGA',
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "cbn_license_number" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "tenantFeatureFlags" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "feature_key" VARCHAR(128) NOT NULL,
  "label" VARCHAR(256),
  "category" VARCHAR(64),
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "rollout_stage" VARCHAR(32) DEFAULT 'beta',
  "admin_managed" BOOLEAN NOT NULL DEFAULT FALSE,
  "depends_on" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("tenant_id", "feature_key")
);

-- ─── Customer Tables ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "customers" (
  "customer_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(256) NOT NULL,
  "segment" VARCHAR(64),
  "tier" VARCHAR(32) DEFAULT 'retail',
  "location" VARCHAR(128),
  "relationship_manager" VARCHAR(128),
  "risk" VARCHAR(32) DEFAULT 'low',
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "bvn" VARCHAR(20),
  "phone" VARCHAR(20),
  "balance" BIGINT DEFAULT 0,
  "last_touchpoint_label" VARCHAR(128),
  "last_touchpoint_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerCards" (
  "card_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "card_type" VARCHAR(32) NOT NULL,
  "brand" VARCHAR(32),
  "last_four" VARCHAR(4),
  "expiry_date" VARCHAR(7),
  "card_holder" VARCHAR(256),
  "balance" BIGINT DEFAULT 0,
  "is_locked" BOOLEAN DEFAULT FALSE,
  "controls" JSONB DEFAULT '{}',
  "spending_limits" JSONB DEFAULT '{}',
  "color_tone" VARCHAR(32),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerCardEvents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "card_id" UUID NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "payload" JSONB DEFAULT '{}',
  "actor_id" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerSavedBillers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "biller_id" VARCHAR(128) NOT NULL,
  "biller_name" VARCHAR(256),
  "category" VARCHAR(64),
  "account_number" VARCHAR(64),
  "nickname" VARCHAR(128),
  "status" VARCHAR(32) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerBillPayments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "biller_id" VARCHAR(128),
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "reference" VARCHAR(128),
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerTransfers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "source_account_id" UUID,
  "dest_account_number" VARCHAR(64),
  "dest_bank_code" VARCHAR(16),
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "narration" TEXT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerApprovals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "approval_type" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "approver_id" VARCHAR(128),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerStatementExports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "account_id" UUID,
  "from_date" DATE NOT NULL,
  "to_date" DATE NOT NULL,
  "format" VARCHAR(16) DEFAULT 'pdf',
  "status" VARCHAR(32) DEFAULT 'pending',
  "download_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerStatements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "opening_balance" BIGINT DEFAULT 0,
  "closing_balance" BIGINT DEFAULT 0,
  "total_credits" BIGINT DEFAULT 0,
  "total_debits" BIGINT DEFAULT 0,
  "transaction_count" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerNotifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "channel" VARCHAR(32) NOT NULL,
  "title" VARCHAR(256),
  "body" TEXT,
  "read" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "customerSessionPreferences" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL UNIQUE,
  "language" VARCHAR(8) DEFAULT 'en',
  "theme" VARCHAR(16) DEFAULT 'light',
  "notification_channels" JSONB DEFAULT '["push","sms"]',
  "biometric_enabled" BOOLEAN DEFAULT FALSE,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Workflow & Operations Tables ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "workflowCases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "case_type" VARCHAR(64) NOT NULL,
  "entity_id" VARCHAR(128) NOT NULL,
  "entity_type" VARCHAR(64) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'open',
  "priority" VARCHAR(16) DEFAULT 'medium',
  "assigned_to" VARCHAR(128),
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "operatorActions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "operator_id" VARCHAR(128) NOT NULL,
  "action_type" VARCHAR(64) NOT NULL,
  "entity_type" VARCHAR(64),
  "entity_id" VARCHAR(128),
  "tenant_id" VARCHAR(64),
  "payload" JSONB DEFAULT '{}',
  "ip_address" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "auditEntries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "entity_type" VARCHAR(64) NOT NULL,
  "entity_id" VARCHAR(128) NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "actor_id" VARCHAR(128),
  "actor_role" VARCHAR(64),
  "changes" JSONB DEFAULT '{}',
  "ip_address" VARCHAR(64),
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "exportJobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_type" VARCHAR(64) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "requested_by" VARCHAR(128),
  "filters" JSONB DEFAULT '{}',
  "format" VARCHAR(16) DEFAULT 'csv',
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "download_url" TEXT,
  "row_count" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ
);

-- ─── Billing Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "billingAccounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL UNIQUE,
  "plan" VARCHAR(64) NOT NULL DEFAULT 'starter',
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "billing_email" VARCHAR(255),
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "credit_limit" BIGINT DEFAULT 0,
  "current_balance" BIGINT DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingRateCards" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(128) NOT NULL,
  "plan" VARCHAR(64) NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "status" VARCHAR(32) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingRateCardLines" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "rate_card_id" UUID NOT NULL,
  "metric" VARCHAR(128) NOT NULL,
  "unit_price" BIGINT NOT NULL,
  "tier_from" BIGINT DEFAULT 0,
  "tier_to" BIGINT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingUsageEvents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "metric" VARCHAR(128) NOT NULL,
  "quantity" BIGINT NOT NULL DEFAULT 1,
  "unit_price" BIGINT DEFAULT 0,
  "total_amount" BIGINT DEFAULT 0,
  "reference" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingRatedEvents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "usage_event_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "metric" VARCHAR(128) NOT NULL,
  "quantity" BIGINT NOT NULL,
  "unit_price" BIGINT NOT NULL,
  "total_amount" BIGINT NOT NULL,
  "rate_card_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingAccrualSnapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "total_accrued" BIGINT DEFAULT 0,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingContractOverrides" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "metric" VARCHAR(128) NOT NULL,
  "override_price" BIGINT NOT NULL,
  "reason" TEXT,
  "approved_by" VARCHAR(128),
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingDiscountRules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64),
  "plan" VARCHAR(64),
  "discount_pct" REAL DEFAULT 0,
  "min_volume" BIGINT DEFAULT 0,
  "valid_from" DATE NOT NULL,
  "valid_to" DATE,
  "status" VARCHAR(32) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingRevenueShareRules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id" VARCHAR(128) NOT NULL,
  "share_pct" REAL NOT NULL,
  "metric" VARCHAR(128),
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingInvoices" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "invoice_number" VARCHAR(64) NOT NULL UNIQUE,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "subtotal" BIGINT DEFAULT 0,
  "tax" BIGINT DEFAULT 0,
  "total" BIGINT DEFAULT 0,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
  "due_date" DATE,
  "paid_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingInvoiceLines" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "description" VARCHAR(256) NOT NULL,
  "metric" VARCHAR(128),
  "quantity" BIGINT DEFAULT 1,
  "unit_price" BIGINT NOT NULL,
  "total" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "billingInvoiceApprovals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "approver_id" VARCHAR(128) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Partner & Agri Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "partnerOnboardingRecords" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id" VARCHAR(128) NOT NULL UNIQUE,
  "name" VARCHAR(256) NOT NULL,
  "type" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "kyb_status" VARCHAR(32) DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "partnerApprovalRecords" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id" VARCHAR(128) NOT NULL,
  "approval_stage" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "approver_id" VARCHAR(128),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "farmers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "farmer_id" VARCHAR(128) NOT NULL UNIQUE,
  "name" VARCHAR(256) NOT NULL,
  "bvn" VARCHAR(20),
  "phone" VARCHAR(20),
  "state" VARCHAR(64),
  "lga" VARCHAR(64),
  "farm_size_hectares" REAL DEFAULT 0,
  "crop_types" JSONB DEFAULT '[]',
  "status" VARCHAR(32) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "agriLoans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "loan_type" VARCHAR(64) NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "interest_rate" REAL DEFAULT 0,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "disbursed_at" TIMESTAMPTZ,
  "maturity_date" DATE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "cropInsurancePolicies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmer_id" UUID NOT NULL,
  "policy_number" VARCHAR(64) NOT NULL UNIQUE,
  "crop_type" VARCHAR(64) NOT NULL,
  "coverage_amount" BIGINT NOT NULL,
  "premium" BIGINT NOT NULL,
  "season" VARCHAR(32),
  "status" VARCHAR(32) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "valueChainContracts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmer_id" UUID NOT NULL,
  "buyer_id" VARCHAR(128) NOT NULL,
  "commodity" VARCHAR(64) NOT NULL,
  "quantity_kg" REAL NOT NULL,
  "price_per_kg" BIGINT NOT NULL,
  "delivery_date" DATE,
  "status" VARCHAR(32) DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Teller & Vault Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tellerSessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "teller_id" VARCHAR(128) NOT NULL,
  "branch_code" VARCHAR(16) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "opening_cash" BIGINT DEFAULT 0,
  "closing_cash" BIGINT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'open',
  "opened_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "closed_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "tellerTransactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "teller_id" VARCHAR(128) NOT NULL,
  "transaction_type" VARCHAR(64) NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "account_id" UUID,
  "narration" TEXT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'completed',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "vaultOperations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "branch_code" VARCHAR(16) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "operation_type" VARCHAR(64) NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "authorized_by" VARCHAR(128),
  "status" VARCHAR(32) NOT NULL DEFAULT 'completed',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Islamic Banking Tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "murabahaContracts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "asset_description" TEXT NOT NULL,
  "cost_price" BIGINT NOT NULL,
  "selling_price" BIGINT NOT NULL,
  "profit_margin_pct" REAL NOT NULL,
  "tenure_months" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ijaraContracts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "asset_type" VARCHAR(64) NOT NULL,
  "asset_value" BIGINT NOT NULL,
  "monthly_rent" BIGINT NOT NULL,
  "tenure_months" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "mudarabahContracts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "investment_amount" BIGINT NOT NULL,
  "profit_share_pct" REAL NOT NULL,
  "maturity_date" DATE,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Trade Finance Tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "lettersOfCredit" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "lc_number" VARCHAR(64) NOT NULL UNIQUE,
  "applicant_id" UUID NOT NULL,
  "beneficiary_name" VARCHAR(256) NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "expiry_date" DATE NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "warehouseReceipts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "receipt_number" VARCHAR(64) NOT NULL UNIQUE,
  "depositor_id" UUID NOT NULL,
  "commodity" VARCHAR(64) NOT NULL,
  "quantity_kg" REAL NOT NULL,
  "warehouse_id" VARCHAR(128) NOT NULL,
  "value" BIGINT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "bankGuarantees" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "guarantee_number" VARCHAR(64) NOT NULL UNIQUE,
  "applicant_id" UUID NOT NULL,
  "beneficiary_name" VARCHAR(256) NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "expiry_date" DATE NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Retail Lending Tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "mortgageApplications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "property_value" BIGINT NOT NULL,
  "loan_amount" BIGINT NOT NULL,
  "ltv_ratio" REAL,
  "tenure_years" INTEGER NOT NULL,
  "interest_rate" REAL NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "educationLoans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "institution" VARCHAR(256) NOT NULL,
  "amount" BIGINT NOT NULL,
  "tenure_months" INTEGER NOT NULL,
  "interest_rate" REAL NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Community Banking Tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "esusuGroups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "group_name" VARCHAR(256) NOT NULL,
  "contribution_amount" BIGINT NOT NULL,
  "frequency" VARCHAR(32) NOT NULL DEFAULT 'monthly',
  "member_count" INTEGER DEFAULT 0,
  "current_cycle" INTEGER DEFAULT 1,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "virtualAccounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "parent_account_id" UUID NOT NULL,
  "virtual_account_number" VARCHAR(20) NOT NULL UNIQUE,
  "label" VARCHAR(128),
  "balance" BIGINT DEFAULT 0,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "agentBankingAgents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "agent_id" VARCHAR(128) NOT NULL UNIQUE,
  "name" VARCHAR(256) NOT NULL,
  "phone" VARCHAR(20),
  "state" VARCHAR(64),
  "lga" VARCHAR(64),
  "terminal_id" VARCHAR(64),
  "float_balance" BIGINT DEFAULT 0,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── KYC/AML Enhanced Tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kycTiers" (
  "id" SERIAL PRIMARY KEY,
  "tier_name" VARCHAR(32) NOT NULL UNIQUE,
  "max_daily_limit" BIGINT,
  "max_single_txn" BIGINT,
  "required_docs" JSONB DEFAULT '[]',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "kycTierHistory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "from_tier" VARCHAR(32),
  "to_tier" VARCHAR(32) NOT NULL,
  "reason" TEXT,
  "changed_by" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "sanctionsScreenings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "screening_type" VARCHAR(32) NOT NULL,
  "list_name" VARCHAR(128),
  "match_score" REAL DEFAULT 0,
  "status" VARCHAR(32) NOT NULL DEFAULT 'clear',
  "screened_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "transactionMonitoringRules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "rule_name" VARCHAR(128) NOT NULL UNIQUE,
  "rule_type" VARCHAR(64) NOT NULL,
  "threshold_amount" BIGINT,
  "frequency_count" INTEGER,
  "window_hours" INTEGER,
  "risk_score" INTEGER DEFAULT 50,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "transactionAlerts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "rule_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "transaction_id" UUID,
  "risk_score" INTEGER DEFAULT 0,
  "status" VARCHAR(32) NOT NULL DEFAULT 'open',
  "assigned_to" VARCHAR(128),
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "uboGraphNodes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id" VARCHAR(128) NOT NULL,
  "entity_type" VARCHAR(32) NOT NULL,
  "name" VARCHAR(256) NOT NULL,
  "country" VARCHAR(3),
  "ownership_pct" REAL DEFAULT 0,
  "is_ubo" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "uboGraphEdges" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_node_id" UUID NOT NULL,
  "to_node_id" UUID NOT NULL,
  "relationship_type" VARCHAR(64) NOT NULL,
  "ownership_pct" REAL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "riskScores" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id" VARCHAR(128) NOT NULL,
  "entity_type" VARCHAR(32) NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "level" VARCHAR(16) NOT NULL DEFAULT 'low',
  "factors" JSONB DEFAULT '{}',
  "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "agentKycCaptures" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" VARCHAR(128) NOT NULL,
  "customer_id" UUID NOT NULL,
  "capture_type" VARCHAR(32) NOT NULL,
  "document_ref" VARCHAR(128),
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "adverseMediaHits" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "source_url" TEXT,
  "headline" TEXT,
  "sentiment" VARCHAR(16) DEFAULT 'negative',
  "relevance_score" REAL DEFAULT 0,
  "status" VARCHAR(32) DEFAULT 'open',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "corporateMonitoringEvents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id" VARCHAR(128) NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "description" TEXT,
  "source" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "kycDataQualityMetrics" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "metric_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "completeness_pct" REAL DEFAULT 0,
  "accuracy_pct" REAL DEFAULT 0,
  "total_customers" INTEGER DEFAULT 0,
  "verified_customers" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("tenant_id", "metric_date")
);

CREATE TABLE IF NOT EXISTS "efassReturns" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "return_type" VARCHAR(64) NOT NULL,
  "period" VARCHAR(16) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "submitted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "nfiuFilings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "filing_type" VARCHAR(32) NOT NULL,
  "report_reference" VARCHAR(128),
  "period" VARCHAR(16) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "submitted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "bureauChecks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "bureau_name" VARCHAR(64) NOT NULL,
  "credit_score" INTEGER,
  "report_reference" VARCHAR(128),
  "status" VARCHAR(32) NOT NULL DEFAULT 'completed',
  "checked_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Escrow Tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "escrowAccounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "escrow_number" VARCHAR(64) NOT NULL UNIQUE,
  "type" VARCHAR(32) NOT NULL,
  "balance" BIGINT DEFAULT 0,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "escrowParties" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "escrow_id" UUID NOT NULL,
  "party_type" VARCHAR(32) NOT NULL,
  "party_id" VARCHAR(128) NOT NULL,
  "party_name" VARCHAR(256),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "escrowTransactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "escrow_id" UUID NOT NULL,
  "transaction_type" VARCHAR(32) NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "escrowMilestones" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "escrow_id" UUID NOT NULL,
  "milestone_name" VARCHAR(128) NOT NULL,
  "amount" BIGINT NOT NULL,
  "due_date" DATE,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "escrowDisputes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "escrow_id" UUID NOT NULL,
  "raised_by" VARCHAR(128) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'open',
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "escrowDocuments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "escrow_id" UUID NOT NULL,
  "document_type" VARCHAR(64) NOT NULL,
  "document_url" TEXT NOT NULL,
  "uploaded_by" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "escrowFees" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "escrow_id" UUID NOT NULL,
  "fee_type" VARCHAR(64) NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "escrowInterestAccruals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "escrow_id" UUID NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "interest_amount" BIGINT NOT NULL,
  "rate" REAL NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "escrowRegulatoryReports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "report_type" VARCHAR(64) NOT NULL,
  "period" VARCHAR(16) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "escrowAuditLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "escrow_id" UUID NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "actor_id" VARCHAR(128),
  "payload" JSONB DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Security Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "scratchCards" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id" UUID,
  "serial_number" VARCHAR(64) NOT NULL UNIQUE,
  "pin_hash" VARCHAR(256),
  "denomination" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "status" VARCHAR(32) NOT NULL DEFAULT 'unused',
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "cardBatches" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_number" VARCHAR(64) NOT NULL UNIQUE,
  "card_type" VARCHAR(32) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "denomination" BIGINT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "pinVerifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id" VARCHAR(128) NOT NULL,
  "entity_type" VARCHAR(32) NOT NULL,
  "success" BOOLEAN NOT NULL,
  "ip_address" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "gridCards" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "grid_data" JSONB NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "issued_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "cryptoKeys" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key_id" VARCHAR(128) NOT NULL UNIQUE,
  "algorithm" VARCHAR(32) NOT NULL,
  "purpose" VARCHAR(64) NOT NULL,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "mfaEnrollments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" VARCHAR(128) NOT NULL,
  "method" VARCHAR(32) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "mfaPolicies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL UNIQUE,
  "required_methods" JSONB DEFAULT '["totp"]',
  "step_up_threshold" BIGINT DEFAULT 100000,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "otpRecords" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" VARCHAR(128) NOT NULL,
  "otp_hash" VARCHAR(256) NOT NULL,
  "purpose" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "sessionRecords" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" VARCHAR(128) NOT NULL UNIQUE,
  "user_id" VARCHAR(128) NOT NULL,
  "tenant_id" VARCHAR(64),
  "ip_address" VARCHAR(64),
  "user_agent" TEXT,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "apiKeys" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key_id" VARCHAR(64) NOT NULL UNIQUE,
  "key_hash" VARCHAR(256) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(128),
  "scopes" JSONB DEFAULT '[]',
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "last_used_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "securityEvents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_type" VARCHAR(64) NOT NULL,
  "severity" VARCHAR(16) NOT NULL DEFAULT 'medium',
  "source_ip" VARCHAR(64),
  "user_id" VARCHAR(128),
  "tenant_id" VARCHAR(64),
  "description" TEXT,
  "payload" JSONB DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "certificates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "common_name" VARCHAR(256) NOT NULL,
  "issuer" VARCHAR(256),
  "serial_number" VARCHAR(128),
  "not_before" TIMESTAMPTZ,
  "not_after" TIMESTAMPTZ,
  "status" VARCHAR(32) NOT NULL DEFAULT 'valid',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "jwtValidations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "token_id" VARCHAR(128),
  "user_id" VARCHAR(128),
  "tenant_id" VARCHAR(64),
  "valid" BOOLEAN NOT NULL,
  "failure_reason" VARCHAR(128),
  "validated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "wafRules" (
  "id" SERIAL PRIMARY KEY,
  "rule_id" VARCHAR(20) NOT NULL UNIQUE,
  "name" VARCHAR(200),
  "category" VARCHAR(50),
  "severity" VARCHAR(20),
  "paranoia" INTEGER DEFAULT 1,
  "matched_24h" INTEGER DEFAULT 0,
  "blocked_24h" INTEGER DEFAULT 0,
  "false_positives" INTEGER DEFAULT 0,
  "status" VARCHAR(30) DEFAULT 'enforced',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ddosRules" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(200) NOT NULL,
  "layer" VARCHAR(5),
  "threshold" VARCHAR(50),
  "action" VARCHAR(20),
  "mitigated_24h" INTEGER DEFAULT 0,
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ipRules" (
  "id" SERIAL PRIMARY KEY,
  "ip_range" VARCHAR(50) NOT NULL,
  "rule_type" VARCHAR(20) NOT NULL,
  "reason" TEXT,
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "incidents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" VARCHAR(256) NOT NULL,
  "severity" VARCHAR(16) NOT NULL DEFAULT 'medium',
  "status" VARCHAR(32) NOT NULL DEFAULT 'open',
  "assigned_to" VARCHAR(128),
  "description" TEXT,
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Redis / Cache Tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "redisCacheEntries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cache_key" VARCHAR(512) NOT NULL,
  "namespace" VARCHAR(64) NOT NULL DEFAULT '54bank',
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'global',
  "value" JSONB NOT NULL,
  "ttl_seconds" INTEGER,
  "expires_at" TIMESTAMPTZ,
  "hit_count" BIGINT NOT NULL DEFAULT 0,
  "source" VARCHAR(16) NOT NULL DEFAULT 'redis',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("cache_key", "namespace", "tenant_id")
);

CREATE TABLE IF NOT EXISTS "redisSessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" VARCHAR(128) NOT NULL UNIQUE,
  "tenant_id" VARCHAR(64) NOT NULL,
  "user_id" VARCHAR(128) NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "ip_address" VARCHAR(64),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "last_accessed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "cacheInvalidations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pattern" VARCHAR(512) NOT NULL,
  "reason" VARCHAR(128),
  "keys_invalidated" INTEGER DEFAULT 0,
  "triggered_by" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Fluvio / Streaming Tables ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "fluvioSmartModules" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL UNIQUE,
  "module_type" VARCHAR(30) NOT NULL,
  "input_topic" VARCHAR(100),
  "output_topic" VARCHAR(100),
  "wasm_size_kb" INTEGER DEFAULT 0,
  "avg_latency_us" INTEGER DEFAULT 0,
  "throughput_eps" INTEGER DEFAULT 0,
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "eventDedupConfigs" (
  "id" SERIAL PRIMARY KEY,
  "topic" VARCHAR(100) NOT NULL,
  "window_ms" INTEGER DEFAULT 0,
  "strategy" VARCHAR(30) NOT NULL,
  "duplicates_blocked_24h" BIGINT DEFAULT 0,
  "total_events_24h" BIGINT DEFAULT 0,
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Temporal / Workflow Tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "temporalMemoizedActivities" (
  "id" SERIAL PRIMARY KEY,
  "workflow" VARCHAR(100) NOT NULL,
  "activity" VARCHAR(100) NOT NULL,
  "replay_speedup" VARCHAR(10) NOT NULL,
  "cache_ttl" VARCHAR(20) NOT NULL,
  "cache_hit_rate" VARCHAR(20) NOT NULL,
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── APISIX / Gateway Tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "apisixPluginChains" (
  "id" SERIAL PRIMARY KEY,
  "route" VARCHAR(200) NOT NULL,
  "avg_latency_ms" REAL DEFAULT 0,
  "latency_saving" VARCHAR(10) NOT NULL,
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AML Enhancement Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "amlRiskScores" (
  "id" SERIAL PRIMARY KEY,
  "customer_id" VARCHAR(50) NOT NULL,
  "customer_name" VARCHAR(200) NOT NULL,
  "risk_score" INTEGER DEFAULT 0,
  "risk_level" VARCHAR(20) NOT NULL,
  "sanctions_hits" INTEGER DEFAULT 0,
  "pep_match" BOOLEAN DEFAULT FALSE,
  "adverse_media" INTEGER DEFAULT 0,
  "cdd_level" VARCHAR(20) NOT NULL,
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "sarReports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "customer_id" UUID NOT NULL,
  "report_reference" VARCHAR(128),
  "reason" TEXT NOT NULL,
  "amount" BIGINT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
  "submitted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ctrReports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "customer_id" UUID NOT NULL,
  "transaction_id" UUID,
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "report_reference" VARCHAR(128),
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "submitted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "amlCases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "customer_id" UUID NOT NULL,
  "case_type" VARCHAR(32) NOT NULL,
  "risk_score" INTEGER DEFAULT 0,
  "status" VARCHAR(32) NOT NULL DEFAULT 'open',
  "assigned_to" VARCHAR(128),
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "watchlistSources" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(128) NOT NULL UNIQUE,
  "source_type" VARCHAR(32) NOT NULL,
  "url" TEXT,
  "last_updated" TIMESTAMPTZ,
  "record_count" INTEGER DEFAULT 0,
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "beneficialOwners" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id" VARCHAR(128) NOT NULL,
  "entity_type" VARCHAR(32) NOT NULL,
  "owner_name" VARCHAR(256) NOT NULL,
  "ownership_pct" REAL NOT NULL,
  "nationality" VARCHAR(3),
  "is_pep" BOOLEAN DEFAULT FALSE,
  "status" VARCHAR(32) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "amlComplianceMetrics" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "metric_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "total_alerts" INTEGER DEFAULT 0,
  "resolved_alerts" INTEGER DEFAULT 0,
  "sar_filed" INTEGER DEFAULT 0,
  "ctr_filed" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("tenant_id", "metric_date")
);

-- ─── Digital Banking Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "smartSavingsGoals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "goal_name" VARCHAR(128) NOT NULL,
  "target_amount" BIGINT NOT NULL,
  "current_amount" BIGINT DEFAULT 0,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "target_date" DATE,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "virtualCards" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "card_number_masked" VARCHAR(20) NOT NULL,
  "expiry_date" VARCHAR(7) NOT NULL,
  "cvv_hash" VARCHAR(256),
  "balance" BIGINT DEFAULT 0,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "qrPaymentTransactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "qr_code_id" VARCHAR(128) NOT NULL,
  "payer_id" UUID,
  "merchant_id" VARCHAR(128),
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "bnplOrders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "merchant_id" VARCHAR(128),
  "order_amount" BIGINT NOT NULL,
  "installments" INTEGER NOT NULL DEFAULT 4,
  "installment_amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "investmentOrders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "product_id" VARCHAR(128) NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "expected_return_pct" REAL,
  "maturity_date" DATE,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "remittanceTransactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL,
  "sender_id" UUID,
  "recipient_name" VARCHAR(256) NOT NULL,
  "recipient_account" VARCHAR(64),
  "recipient_bank" VARCHAR(128),
  "recipient_country" VARCHAR(3),
  "send_amount" BIGINT NOT NULL,
  "receive_amount" BIGINT NOT NULL,
  "send_currency" VARCHAR(3) NOT NULL,
  "receive_currency" VARCHAR(3) NOT NULL,
  "exchange_rate" REAL,
  "corridor" VARCHAR(16),
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "rewardsAccounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL UNIQUE,
  "tenant_id" VARCHAR(64) NOT NULL,
  "points_balance" BIGINT DEFAULT 0,
  "tier" VARCHAR(32) DEFAULT 'bronze',
  "lifetime_points" BIGINT DEFAULT 0,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Biometric / Liveness Tables ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "livenessChecks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "session_id" VARCHAR(128),
  "result" VARCHAR(32) NOT NULL,
  "confidence_score" REAL DEFAULT 0,
  "provider" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "faceMatches" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "match_score" REAL NOT NULL,
  "reference_image_id" VARCHAR(128),
  "probe_image_id" VARCHAR(128),
  "result" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "kycEnforcementVerifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "verification_type" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "verified_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "kybEnforcementVerifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id" VARCHAR(128) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "verification_type" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "verified_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "kycEnforcementLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "reason" TEXT,
  "actor_id" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "kycEventTriggers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "trigger_type" VARCHAR(64) NOT NULL,
  "entity_id" VARCHAR(128) NOT NULL,
  "entity_type" VARCHAR(32) NOT NULL,
  "payload" JSONB DEFAULT '{}',
  "processed" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Voice Banking Tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "voiceBankingGateway" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" VARCHAR(128) NOT NULL UNIQUE,
  "customer_id" UUID,
  "channel" VARCHAR(32) NOT NULL DEFAULT 'ivr',
  "language" VARCHAR(8) DEFAULT 'en',
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ended_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "voiceIvrMenu" (
  "id" SERIAL PRIMARY KEY,
  "menu_id" VARCHAR(64) NOT NULL UNIQUE,
  "parent_menu_id" VARCHAR(64),
  "option_key" VARCHAR(4) NOT NULL,
  "label" VARCHAR(256) NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "language" VARCHAR(8) DEFAULT 'en',
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "voiceCallAnalytics" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" VARCHAR(128) NOT NULL,
  "duration_seconds" INTEGER DEFAULT 0,
  "intent_detected" VARCHAR(128),
  "sentiment" VARCHAR(16),
  "resolution" VARCHAR(32),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Messaging Tables ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "telegramBotGateway" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "chat_id" VARCHAR(64) NOT NULL,
  "customer_id" UUID,
  "bot_username" VARCHAR(64),
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "telegramBankingCommands" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "chat_id" VARCHAR(64) NOT NULL,
  "command" VARCHAR(64) NOT NULL,
  "params" JSONB DEFAULT '{}',
  "response" TEXT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'processed',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "whatsappBusinessGateway" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone_number" VARCHAR(20) NOT NULL,
  "customer_id" UUID,
  "waba_id" VARCHAR(64),
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "whatsappBankingFlows" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "flow_id" VARCHAR(128) NOT NULL UNIQUE,
  "flow_name" VARCHAR(128) NOT NULL,
  "trigger" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ussdBankingGateway" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" VARCHAR(128) NOT NULL UNIQUE,
  "msisdn" VARCHAR(20) NOT NULL,
  "customer_id" UUID,
  "shortcode" VARCHAR(16),
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ended_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "ussdTransactionEngine" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" VARCHAR(128) NOT NULL,
  "step" INTEGER NOT NULL DEFAULT 1,
  "input" TEXT,
  "response" TEXT,
  "transaction_type" VARCHAR(64),
  "amount" BIGINT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "smsBankingGateway" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "msisdn" VARCHAR(20) NOT NULL,
  "customer_id" UUID,
  "message" TEXT NOT NULL,
  "direction" VARCHAR(8) NOT NULL DEFAULT 'inbound',
  "status" VARCHAR(32) NOT NULL DEFAULT 'processed',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── KPI Tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpiRoles" (
  "id" SERIAL PRIMARY KEY,
  "role_name" VARCHAR(64) NOT NULL UNIQUE,
  "department" VARCHAR(64),
  "level" VARCHAR(32),
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "kpiMetrics" (
  "id" SERIAL PRIMARY KEY,
  "metric_name" VARCHAR(128) NOT NULL,
  "category" VARCHAR(64),
  "unit" VARCHAR(32),
  "target_value" REAL,
  "weight" REAL DEFAULT 1.0,
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "kpiScores" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "role_id" INTEGER,
  "metric_id" INTEGER,
  "period" VARCHAR(16) NOT NULL,
  "actual_value" REAL,
  "score" REAL,
  "tenant_id" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "kpiBranches" (
  "id" SERIAL PRIMARY KEY,
  "branch_code" VARCHAR(16) NOT NULL UNIQUE,
  "branch_name" VARCHAR(128) NOT NULL,
  "region" VARCHAR(64),
  "state" VARCHAR(64),
  "status" VARCHAR(30) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Middleware Integration Tables (NEW) ─────────────────────────────────────

-- Dapr pub/sub events
CREATE TABLE IF NOT EXISTS "dapr_published_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" VARCHAR(64) NOT NULL UNIQUE,
  "topic" VARCHAR(128) NOT NULL,
  "pubsub_name" VARCHAR(128) NOT NULL DEFAULT '54bank-pubsub',
  "event_type" VARCHAR(128) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "entity_id" VARCHAR(128) NOT NULL,
  "entity_type" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" VARCHAR(32) NOT NULL DEFAULT 'published',
  "dapr_available" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dapr state store operations
CREATE TABLE IF NOT EXISTS "dapr_state_operations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_name" VARCHAR(128) NOT NULL,
  "operation" VARCHAR(16) NOT NULL,
  "state_key" VARCHAR(256) NOT NULL,
  "value" JSONB,
  "etag" VARCHAR(64),
  "tenant_id" VARCHAR(64),
  "status" VARCHAR(32) NOT NULL DEFAULT 'success',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dapr service invocations
CREATE TABLE IF NOT EXISTS "dapr_service_invocations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_app" VARCHAR(128) NOT NULL DEFAULT '54bank-platform',
  "target_app" VARCHAR(128) NOT NULL,
  "method" VARCHAR(256) NOT NULL,
  "http_verb" VARCHAR(10) NOT NULL DEFAULT 'POST',
  "request_payload" JSONB,
  "response_payload" JSONB,
  "status_code" INTEGER,
  "latency_ms" INTEGER,
  "tenant_id" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dapr subscriptions registry
CREATE TABLE IF NOT EXISTS "dapr_subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pubsub_name" VARCHAR(128) NOT NULL,
  "topic" VARCHAR(128) NOT NULL,
  "route" VARCHAR(256) NOT NULL,
  "handler_name" VARCHAR(128) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "events_processed" BIGINT NOT NULL DEFAULT 0,
  "events_failed" BIGINT NOT NULL DEFAULT 0,
  "last_event_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("pubsub_name", "topic", "route")
);

-- Temporal workflow executions
CREATE TABLE IF NOT EXISTS "temporal_workflow_executions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" VARCHAR(128) NOT NULL,
  "workflow_run_id" VARCHAR(128),
  "workflow_type" VARCHAR(128) NOT NULL,
  "task_queue" VARCHAR(128) NOT NULL,
  "tenant_id" VARCHAR(64),
  "input_payload" JSONB,
  "result_payload" JSONB,
  "status" VARCHAR(32) NOT NULL DEFAULT 'running',
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ,
  "error_message" TEXT,
  UNIQUE("workflow_id", "workflow_run_id")
);

-- Temporal activity log
CREATE TABLE IF NOT EXISTS "temporal_activity_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" VARCHAR(128) NOT NULL,
  "activity_name" VARCHAR(128) NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(32) NOT NULL DEFAULT 'completed',
  "payload" JSONB,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Temporal saga compensations
CREATE TABLE IF NOT EXISTS "temporal_saga_compensations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" VARCHAR(128) NOT NULL,
  "saga_type" VARCHAR(64) NOT NULL,
  "step_name" VARCHAR(128) NOT NULL,
  "compensation_activity" VARCHAR(128) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "executed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fluvio topics registry
CREATE TABLE IF NOT EXISTS "fluvio_topics" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(128) NOT NULL UNIQUE,
  "partitions" INTEGER NOT NULL DEFAULT 12,
  "replication_factor" INTEGER NOT NULL DEFAULT 3,
  "retention_ms" BIGINT DEFAULT 604800000,
  "compression" VARCHAR(16) DEFAULT 'lz4',
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "tenant_id" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fluvio event log
CREATE TABLE IF NOT EXISTS "fluvio_event_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" VARCHAR(64) NOT NULL UNIQUE,
  "topic" VARCHAR(128) NOT NULL,
  "event_type" VARCHAR(128) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "entity_id" VARCHAR(128) NOT NULL,
  "entity_type" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "partition_key" VARCHAR(128),
  "fluvio_offset" BIGINT,
  "backend" VARCHAR(32) NOT NULL DEFAULT 'fluvio',
  "produced_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fluvio outbox (fallback when Fluvio is unavailable)
CREATE TABLE IF NOT EXISTS "fluvio_event_outbox" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" VARCHAR(64) NOT NULL UNIQUE,
  "topic" VARCHAR(128) NOT NULL,
  "event_type" VARCHAR(128) NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "entity_id" VARCHAR(128) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processed_at" TIMESTAMPTZ
);

-- Fluvio consumer groups
CREATE TABLE IF NOT EXISTS "fluvio_consumer_groups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" VARCHAR(128) NOT NULL,
  "topic" VARCHAR(128) NOT NULL,
  "partition_id" INTEGER NOT NULL DEFAULT 0,
  "committed_offset" BIGINT NOT NULL DEFAULT 0,
  "lag" BIGINT NOT NULL DEFAULT 0,
  "consumer_id" VARCHAR(128),
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "last_heartbeat" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("group_id", "topic", "partition_id")
);

-- Redis cache entries (service-level)
CREATE TABLE IF NOT EXISTS "redis_cache_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cache_key" VARCHAR(512) NOT NULL,
  "namespace" VARCHAR(64) NOT NULL DEFAULT '54bank',
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'global',
  "value" JSONB NOT NULL,
  "ttl_seconds" INTEGER,
  "expires_at" TIMESTAMPTZ,
  "hit_count" BIGINT NOT NULL DEFAULT 0,
  "source" VARCHAR(16) NOT NULL DEFAULT 'redis',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("cache_key", "namespace", "tenant_id")
);

-- Redis rate limit log
CREATE TABLE IF NOT EXISTS "redis_rate_limit_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "rate_key" VARCHAR(512) NOT NULL,
  "tenant_id" VARCHAR(64),
  "window_start" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "window_seconds" INTEGER NOT NULL,
  "request_count" BIGINT NOT NULL DEFAULT 1,
  "limit_value" BIGINT NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OpenAppSec WAF events
CREATE TABLE IF NOT EXISTS "openappsec_waf_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_type" VARCHAR(64) NOT NULL,
  "severity" VARCHAR(16) NOT NULL DEFAULT 'medium',
  "source_ip" VARCHAR(64),
  "request_uri" TEXT,
  "method" VARCHAR(10),
  "user_agent" TEXT,
  "attack_type" VARCHAR(64),
  "confidence" VARCHAR(16),
  "action" VARCHAR(16) NOT NULL DEFAULT 'detect',
  "tenant_id" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OpenAppSec learning mode data
CREATE TABLE IF NOT EXISTS "openappsec_learning_data" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "endpoint" VARCHAR(256) NOT NULL,
  "method" VARCHAR(10) NOT NULL,
  "param_name" VARCHAR(128),
  "param_type" VARCHAR(32),
  "sample_count" INTEGER DEFAULT 0,
  "last_seen" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_tenant ON "users"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON "customers"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_customers_bvn ON "customers"("bvn");
CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant ON "billingInvoices"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS idx_aml_risk_scores_customer ON "amlRiskScores"("customer_id");
CREATE INDEX IF NOT EXISTS idx_sar_reports_tenant ON "sarReports"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS idx_kyc_enforcement_customer ON "kycEnforcementVerifications"("customer_id", "tenant_id");
CREATE INDEX IF NOT EXISTS idx_dapr_events_topic ON "dapr_published_events"("topic", "created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_dapr_events_tenant ON "dapr_published_events"("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_workflows_type ON "temporal_workflow_executions"("workflow_type", "started_at" DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_workflows_status ON "temporal_workflow_executions"("status", "started_at" DESC);
CREATE INDEX IF NOT EXISTS idx_fluvio_event_log_topic ON "fluvio_event_log"("topic", "produced_at" DESC);
CREATE INDEX IF NOT EXISTS idx_fluvio_event_log_tenant ON "fluvio_event_log"("tenant_id", "produced_at" DESC);
CREATE INDEX IF NOT EXISTS idx_fluvio_outbox_status ON "fluvio_event_outbox"("status", "created_at");
CREATE INDEX IF NOT EXISTS idx_redis_cache_key ON "redis_cache_entries"("cache_key", "namespace");
CREATE INDEX IF NOT EXISTS idx_redis_cache_expires ON "redis_cache_entries"("expires_at") WHERE "expires_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_openappsec_events_type ON "openappsec_waf_events"("event_type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_openappsec_events_ip ON "openappsec_waf_events"("source_ip", "created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON "securityEvents"("event_type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_session_records_user ON "sessionRecords"("user_id", "expires_at");
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON "apiKeys"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_tenant ON "escrowAccounts"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_farmers_tenant ON "farmers"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_agri_loans_farmer ON "agriLoans"("farmer_id");
CREATE INDEX IF NOT EXISTS idx_ussd_sessions_msisdn ON "ussdBankingGateway"("msisdn", "started_at" DESC);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_customer ON "voiceBankingGateway"("customer_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS idx_remittance_tenant ON "remittanceTransactions"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS idx_bnpl_customer ON "bnplOrders"("customer_id", "status");
CREATE INDEX IF NOT EXISTS idx_smart_savings_customer ON "smartSavingsGoals"("customer_id", "status");

-- ─── Seed default data ────────────────────────────────────────────────────────

-- Default KYC tiers
INSERT INTO "kycTiers" ("tier_name", "max_daily_limit", "max_single_txn", "required_docs") VALUES
  ('tier1', 50000000, 20000000, '["bvn"]'),
  ('tier2', 200000000, 100000000, '["bvn","nin","utility_bill"]'),
  ('tier3', 500000000, 200000000, '["bvn","nin","passport","utility_bill","cac"]')
ON CONFLICT ("tier_name") DO NOTHING;

-- Default watchlist sources
INSERT INTO "watchlistSources" ("name", "source_type", "url", "status") VALUES
  ('OFAC SDN', 'sanctions', 'https://www.treasury.gov/ofac/downloads/sdn.xml', 'active'),
  ('UN Security Council', 'sanctions', 'https://scsanctions.un.org/resources/xml/en/consolidated.xml', 'active'),
  ('EU Consolidated List', 'sanctions', 'https://webgate.ec.europa.eu/fsd/fsf', 'active'),
  ('CBN Watchlist', 'domestic', NULL, 'active'),
  ('NFIU PEP List', 'pep', NULL, 'active')
ON CONFLICT ("name") DO NOTHING;

-- Default WAF rules
INSERT INTO "wafRules" ("rule_id", "name", "category", "severity", "paranoia", "status") VALUES
  ('942100', 'SQL Injection via libinjection', 'sqli', 'critical', 1, 'enforced'),
  ('942200', 'Detects MySQL comment/space-obfuscated injections', 'sqli', 'high', 1, 'enforced'),
  ('941100', 'XSS Attack Detected via libinjection', 'xss', 'critical', 1, 'enforced'),
  ('932100', 'Remote Command Execution: Unix Command Injection', 'rce', 'critical', 1, 'enforced'),
  ('930100', 'Path Traversal Attack', 'lfi', 'high', 1, 'enforced'),
  ('921110', 'HTTP Request Smuggling Attack', 'protocol', 'high', 1, 'enforced')
ON CONFLICT ("rule_id") DO NOTHING;

-- Default Fluvio topics
INSERT INTO "fluvio_topics" ("name", "partitions", "replication_factor", "status") VALUES
  ('banking.transactions', 24, 3, 'active'),
  ('banking.accounts', 12, 3, 'active'),
  ('banking.payments.raw', 24, 3, 'active'),
  ('banking.payments.enriched', 24, 3, 'active'),
  ('banking.kyc.events', 6, 3, 'active'),
  ('banking.aml.alerts', 6, 3, 'active'),
  ('banking.audit.trail', 12, 3, 'active'),
  ('banking.notifications', 12, 3, 'active'),
  ('banking.loans', 12, 3, 'active'),
  ('banking.fx.rates', 3, 3, 'active'),
  ('banking.gl.entries', 12, 3, 'active'),
  ('banking.regulatory.reports', 6, 3, 'active')
ON CONFLICT ("name") DO NOTHING;

-- Default Dapr subscriptions
INSERT INTO "dapr_subscriptions" ("pubsub_name", "topic", "route", "handler_name") VALUES
  ('54bank-pubsub', 'banking.transactions', '/dapr/subscribe/transactions', 'transaction-handler'),
  ('54bank-pubsub', 'banking.payments.raw', '/dapr/subscribe/payments', 'payment-handler'),
  ('54bank-pubsub', 'banking.kyc.events', '/dapr/subscribe/kyc', 'kyc-handler'),
  ('54bank-pubsub', 'banking.aml.alerts', '/dapr/subscribe/aml', 'aml-handler'),
  ('54bank-pubsub', 'banking.notifications', '/dapr/subscribe/notifications', 'notification-handler')
ON CONFLICT ("pubsub_name", "topic", "route") DO NOTHING;

-- Default Fluvio SmartModules
INSERT INTO "fluvioSmartModules" ("name", "module_type", "input_topic", "output_topic", "avg_latency_us", "throughput_eps", "status") VALUES
  ('payment-enricher', 'map', 'banking.payments.raw', 'banking.payments.enriched', 45, 50000, 'active'),
  ('aml-filter', 'filter', 'banking.transactions', 'banking.aml.alerts', 12, 100000, 'active'),
  ('audit-aggregator', 'aggregate', 'banking.audit.trail', NULL, 8, 200000, 'active'),
  ('kyc-validator', 'map', 'banking.kyc.events', 'banking.notifications', 23, 30000, 'active')
ON CONFLICT ("name") DO NOTHING;

-- Default Temporal memoized activities
INSERT INTO "temporalMemoizedActivities" ("workflow", "activity", "replay_speedup", "cache_ttl", "cache_hit_rate") VALUES
  ('FundTransferWorkflow', 'ValidateAccountsActivity', '100x', '5m', '94%'),
  ('LoanDisbursementWorkflow', 'ApproveLoanActivity', '50x', '10m', '87%'),
  ('KYCVerificationWorkflow', 'VerifyBVNActivity', '200x', '1h', '96%'),
  ('FXSettlementWorkflow', 'ValidateFXRateActivity', '75x', '30s', '91%')
ON CONFLICT DO NOTHING;

