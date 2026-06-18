-- B1: Database Performance Indices for 54Bank Platform
-- Run after drizzle-kit migrate to add performance indices
-- These target the most frequently queried columns based on CrudWorkspace API patterns

-- Customers: queried by tenantId+status, customerId, bvn, phone
CREATE INDEX IF NOT EXISTS idx_customers_tenant_status ON customers("tenantId", "status");
CREATE INDEX IF NOT EXISTS idx_customers_bvn ON customers("bvn");
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers("phone");
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers("tenantId", "segment");

-- Transfers: queried by customerId+createdAt, status
CREATE INDEX IF NOT EXISTS idx_transfers_customer ON "customerTransfers"("customerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON "customerTransfers"("status");
CREATE INDEX IF NOT EXISTS idx_transfers_reference ON "customerTransfers"("reference");

-- Cards: queried by customerId, status
CREATE INDEX IF NOT EXISTS idx_cards_customer ON "customerCards"("customerId");
CREATE INDEX IF NOT EXISTS idx_cards_status ON "customerCards"("status") WHERE "status" = 'active';

-- Card Events: queried by customerId+createdAt
CREATE INDEX IF NOT EXISTS idx_card_events_customer ON "customerCardEvents"("customerId", "createdAt" DESC);

-- Teller Sessions: queried by status (active sessions), branchCode
CREATE INDEX IF NOT EXISTS idx_teller_sessions_status ON "tellerSessions"("status") WHERE "status" = 'active';
CREATE INDEX IF NOT EXISTS idx_teller_sessions_branch ON "tellerSessions"("branchCode");

-- Teller Transactions: queried by sessionId, tellerId+createdAt
CREATE INDEX IF NOT EXISTS idx_teller_txn_session ON "tellerTransactions"("sessionId");
CREATE INDEX IF NOT EXISTS idx_teller_txn_teller ON "tellerTransactions"("tellerId", "createdAt" DESC);

-- Dispute Cases: queried by customerId, status, category
CREATE INDEX IF NOT EXISTS idx_disputes_customer ON "disputeCases"("customerId");
CREATE INDEX IF NOT EXISTS idx_disputes_status ON "disputeCases"("status");
CREATE INDEX IF NOT EXISTS idx_disputes_category ON "disputeCases"("category");

-- Education Loans: queried by status, institution
CREATE INDEX IF NOT EXISTS idx_edu_loans_status ON "educationLoans"("status");

-- Mortgage Applications: queried by customerId, status
CREATE INDEX IF NOT EXISTS idx_mortgage_customer ON "mortgageApplications"("customerId");
CREATE INDEX IF NOT EXISTS idx_mortgage_status ON "mortgageApplications"("status");

-- Virtual Accounts: queried by customerId, status
CREATE INDEX IF NOT EXISTS idx_va_customer ON "virtualAccounts"("customerId");
CREATE INDEX IF NOT EXISTS idx_va_status ON "virtualAccounts"("status") WHERE "status" = 'active';

-- Esusu Groups: queried by status
CREATE INDEX IF NOT EXISTS idx_esusu_status ON "esusuGroups"("status");

-- Lending Groups: queried by status
CREATE INDEX IF NOT EXISTS idx_lending_status ON "lendingGroups"("status");

-- Audit Entries: queried by tenantId+createdAt, actor, domainKey
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON "auditEntries"("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON "auditEntries"("actor");
CREATE INDEX IF NOT EXISTS idx_audit_domain ON "auditEntries"("domainKey");

-- Regulatory Reports: queried by reportType, status, period
CREATE INDEX IF NOT EXISTS idx_reg_reports_type ON "regulatoryReports"("reportType");
CREATE INDEX IF NOT EXISTS idx_reg_reports_status ON "regulatoryReports"("status");

-- Billing: usage events by tenant+timestamp, invoices by status
CREATE INDEX IF NOT EXISTS idx_billing_usage_tenant ON "billingUsageEvents"("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON "billingInvoices"("status");
CREATE INDEX IF NOT EXISTS idx_billing_accounts_tenant ON "billingAccounts"("tenantId", "status");

-- Notifications: queried by customerId+isRead
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON "customerNotifications"("customerId", "isRead");

-- Workflow Cases: queried by tenantId+status+stage
CREATE INDEX IF NOT EXISTS idx_workflow_tenant_status ON "workflowCases"("tenantId", "status");
CREATE INDEX IF NOT EXISTS idx_workflow_stage ON "workflowCases"("stage");

-- Partner Onboarding: queried by status
CREATE INDEX IF NOT EXISTS idx_partner_status ON "partnerOnboardingRecords"("status");

-- Identity Profiles: queried by customerId, bvn
CREATE INDEX IF NOT EXISTS idx_identity_customer ON "identityProfiles"("customerId");

-- Operator Actions: queried by tenantId+createdAt, operatorId
CREATE INDEX IF NOT EXISTS idx_operator_actions_tenant ON "operatorActions"("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_operator_actions_operator ON "operatorActions"("operatorId");
