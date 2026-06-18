-- Core Banking Tables Migration
-- accounts, transactions, journal entries, GL, loans, transfers, settlements, AML, KYC, FX, SWIFT, NIP, cards, audit trail

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "accountId" varchar(64) NOT NULL UNIQUE,
  "customerId" varchar(64) NOT NULL,
  "tenantId" varchar(64) NOT NULL,
  "accountName" varchar(191) NOT NULL,
  "accountType" text NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "balance" double precision NOT NULL DEFAULT 0,
  "availableBalance" double precision NOT NULL DEFAULT 0,
  "ledgerBalance" double precision NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active',
  "branchCode" varchar(16) NOT NULL,
  "openedAt" timestamp DEFAULT now() NOT NULL,
  "lastTransactionAt" timestamp,
  "version" integer NOT NULL DEFAULT 1,
  "tigerbeetleAccountId" varchar(64),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_customer_idx" ON "accounts" ("customerId", "status");
CREATE INDEX "account_tenant_idx" ON "accounts" ("tenantId", "accountType", "status");
CREATE INDEX "account_branch_idx" ON "accounts" ("branchCode", "status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "transactionId" varchar(64) NOT NULL UNIQUE,
  "accountId" varchar(64) NOT NULL,
  "tenantId" varchar(64) NOT NULL,
  "type" text NOT NULL,
  "amount" double precision NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "narration" text NOT NULL,
  "reference" varchar(128) NOT NULL UNIQUE,
  "channel" text NOT NULL,
  "counterpartyAccountId" varchar(64),
  "counterpartyName" varchar(191),
  "balanceAfter" double precision NOT NULL,
  "status" text NOT NULL DEFAULT 'completed',
  "valueDate" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "txn_account_date_idx" ON "transactions" ("accountId", "createdAt");
CREATE UNIQUE INDEX "txn_reference_idx" ON "transactions" ("reference");
CREATE INDEX "txn_tenant_date_idx" ON "transactions" ("tenantId", "createdAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "journalEntries" (
  "id" serial PRIMARY KEY NOT NULL,
  "entryId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "accountId" varchar(64) NOT NULL,
  "glAccountCode" varchar(32) NOT NULL,
  "type" text NOT NULL,
  "amount" double precision NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "narration" text NOT NULL,
  "transactionRef" varchar(128) NOT NULL,
  "batchId" varchar(64),
  "reversalOf" varchar(64),
  "postingDate" timestamp DEFAULT now() NOT NULL,
  "valueDate" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "je_account_idx" ON "journalEntries" ("accountId", "createdAt");
CREATE INDEX "je_gl_code_idx" ON "journalEntries" ("glAccountCode", "postingDate");
CREATE INDEX "je_batch_idx" ON "journalEntries" ("batchId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "glAccounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "glAccountCode" varchar(32) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "name" varchar(191) NOT NULL,
  "category" text NOT NULL,
  "subcategory" text NOT NULL,
  "parentCode" varchar(32),
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "balance" double precision NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active',
  "isControlAccount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gl_category_idx" ON "glAccounts" ("tenantId", "category");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "loans" (
  "id" serial PRIMARY KEY NOT NULL,
  "loanId" varchar(64) NOT NULL UNIQUE,
  "customerId" varchar(64) NOT NULL,
  "tenantId" varchar(64) NOT NULL,
  "loanType" text NOT NULL,
  "principalAmount" double precision NOT NULL,
  "outstandingBalance" double precision NOT NULL,
  "interestRate" double precision NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "tenor" integer NOT NULL,
  "tenorUnit" text NOT NULL DEFAULT 'months',
  "disbursementDate" timestamp,
  "maturityDate" timestamp,
  "nextPaymentDate" timestamp,
  "nextPaymentAmount" double precision,
  "status" text NOT NULL DEFAULT 'pending',
  "classificationIFRS9" text DEFAULT 'stage1',
  "collateralValue" double precision,
  "approvedBy" varchar(128),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "loan_customer_idx" ON "loans" ("customerId", "status");
CREATE INDEX "loan_payment_idx" ON "loans" ("nextPaymentDate", "status");
CREATE INDEX "loan_tenant_idx" ON "loans" ("tenantId", "loanType", "status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "loanRepayments" (
  "id" serial PRIMARY KEY NOT NULL,
  "repaymentId" varchar(64) NOT NULL UNIQUE,
  "loanId" varchar(64) NOT NULL,
  "tenantId" varchar(64) NOT NULL,
  "principalPortion" double precision NOT NULL,
  "interestPortion" double precision NOT NULL,
  "penaltyPortion" double precision NOT NULL DEFAULT 0,
  "totalAmount" double precision NOT NULL,
  "dueDate" timestamp NOT NULL,
  "paidDate" timestamp,
  "status" text NOT NULL DEFAULT 'scheduled',
  "transactionRef" varchar(128),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "repayment_loan_idx" ON "loanRepayments" ("loanId", "dueDate");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "transfers" (
  "id" serial PRIMARY KEY NOT NULL,
  "transferId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "sourceAccountId" varchar(64) NOT NULL,
  "destinationAccountId" varchar(64),
  "destinationBank" varchar(64),
  "destinationAccountNumber" varchar(32),
  "beneficiaryName" varchar(191),
  "amount" double precision NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "channel" text NOT NULL,
  "narration" text NOT NULL,
  "nipSessionId" varchar(64),
  "mojaloopTransferId" varchar(64),
  "status" text NOT NULL DEFAULT 'pending',
  "failureReason" text,
  "idempotencyKey" varchar(128) UNIQUE,
  "transferDate" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "transfer_date_idx" ON "transfers" ("transferDate", "status");
CREATE INDEX "transfer_source_idx" ON "transfers" ("sourceAccountId", "createdAt");
CREATE UNIQUE INDEX "transfer_idempotency_idx" ON "transfers" ("idempotencyKey");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "settlements" (
  "id" serial PRIMARY KEY NOT NULL,
  "settlementId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "windowId" varchar(64) NOT NULL,
  "model" text NOT NULL,
  "corridor" varchar(64),
  "totalDebits" double precision NOT NULL,
  "totalCredits" double precision NOT NULL,
  "netPosition" double precision NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "participantCount" integer NOT NULL,
  "transferCount" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "openedAt" timestamp DEFAULT now() NOT NULL,
  "closedAt" timestamp,
  "settledAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "settlement_date_idx" ON "settlements" ("openedAt", "status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "amlAlerts" (
  "id" serial PRIMARY KEY NOT NULL,
  "alertId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "customerId" varchar(64) NOT NULL,
  "entityType" text NOT NULL,
  "entityId" varchar(64) NOT NULL,
  "ruleId" varchar(64) NOT NULL,
  "ruleName" varchar(191) NOT NULL,
  "riskScore" double precision NOT NULL,
  "severity" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "assignedTo" varchar(128),
  "notes" text,
  "detectedAt" timestamp DEFAULT now() NOT NULL,
  "resolvedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "aml_pending_risk_idx" ON "amlAlerts" ("status", "riskScore");
CREATE INDEX "aml_customer_idx" ON "amlAlerts" ("customerId", "detectedAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "kycVerifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "verificationId" varchar(64) NOT NULL UNIQUE,
  "customerId" varchar(64) NOT NULL,
  "tenantId" varchar(64) NOT NULL,
  "verificationType" text NOT NULL,
  "documentReference" varchar(128),
  "provider" varchar(64) NOT NULL,
  "providerResponse" jsonb,
  "matchScore" double precision,
  "status" text NOT NULL DEFAULT 'pending',
  "verifiedAt" timestamp,
  "expiresAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "kyc_customer_idx" ON "kycVerifications" ("customerId", "verifiedAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fxTrades" (
  "id" serial PRIMARY KEY NOT NULL,
  "tradeId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "buyCurrency" varchar(3) NOT NULL,
  "sellCurrency" varchar(3) NOT NULL,
  "buyAmount" double precision NOT NULL,
  "sellAmount" double precision NOT NULL,
  "exchangeRate" double precision NOT NULL,
  "tradeType" text NOT NULL,
  "counterparty" varchar(128),
  "valueDate" timestamp NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "traderId" varchar(128),
  "approvedBy" varchar(128),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "fx_value_date_idx" ON "fxTrades" ("valueDate", "status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nostroAccounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "nostroId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "correspondentBank" varchar(191) NOT NULL,
  "currency" varchar(3) NOT NULL,
  "accountNumber" varchar(64) NOT NULL,
  "swiftCode" varchar(11) NOT NULL,
  "balance" double precision NOT NULL DEFAULT 0,
  "lastReconciledAt" timestamp,
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "auditTrail" (
  "id" serial PRIMARY KEY NOT NULL,
  "auditId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "entityType" text NOT NULL,
  "entityId" varchar(64) NOT NULL,
  "action" text NOT NULL,
  "actorId" varchar(128) NOT NULL,
  "actorRole" varchar(64) NOT NULL,
  "changes" jsonb,
  "ipAddress" varchar(45),
  "userAgent" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "auditTrail" ("entityType", "entityId", "createdAt");
CREATE INDEX "audit_actor_idx" ON "auditTrail" ("actorId", "createdAt");
CREATE INDEX "audit_tenant_idx" ON "auditTrail" ("tenantId", "createdAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "swiftMessages" (
  "id" serial PRIMARY KEY NOT NULL,
  "messageId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "messageType" varchar(8) NOT NULL,
  "direction" text NOT NULL,
  "senderBic" varchar(11) NOT NULL,
  "receiverBic" varchar(11) NOT NULL,
  "amount" double precision,
  "currency" varchar(3),
  "valueDate" timestamp,
  "rawMessage" text NOT NULL,
  "status" text NOT NULL DEFAULT 'received',
  "relatedTransferId" varchar(64),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "swift_type_idx" ON "swiftMessages" ("messageType", "createdAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nipTransactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "nipId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "sessionId" varchar(64) NOT NULL UNIQUE,
  "direction" text NOT NULL,
  "sourceBank" varchar(8) NOT NULL,
  "destinationBank" varchar(8) NOT NULL,
  "sourceAccount" varchar(20) NOT NULL,
  "destinationAccount" varchar(20) NOT NULL,
  "amount" double precision NOT NULL,
  "narration" text NOT NULL,
  "responseCode" varchar(4),
  "status" text NOT NULL DEFAULT 'pending',
  "completedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "nip_session_idx" ON "nipTransactions" ("sessionId");
CREATE INDEX "nip_date_idx" ON "nipTransactions" ("createdAt", "status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cardTransactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "cardTxnId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "cardId" varchar(64) NOT NULL,
  "accountId" varchar(64) NOT NULL,
  "merchantName" varchar(191),
  "merchantCategory" varchar(8),
  "amount" double precision NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "type" text NOT NULL,
  "channel" text NOT NULL,
  "authorizationCode" varchar(12),
  "stan" varchar(12),
  "rrn" varchar(24),
  "status" text NOT NULL DEFAULT 'approved',
  "declineReason" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "card_txn_card_idx" ON "cardTransactions" ("cardId", "createdAt");
CREATE INDEX "card_txn_account_idx" ON "cardTransactions" ("accountId", "createdAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "trialBalances" (
  "id" serial PRIMARY KEY NOT NULL,
  "trialBalanceId" varchar(64) NOT NULL UNIQUE,
  "tenantId" varchar(64) NOT NULL,
  "glAccountCode" varchar(32) NOT NULL,
  "periodStart" timestamp NOT NULL,
  "periodEnd" timestamp NOT NULL,
  "openingBalance" double precision NOT NULL,
  "totalDebits" double precision NOT NULL,
  "totalCredits" double precision NOT NULL,
  "closingBalance" double precision NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "status" text NOT NULL DEFAULT 'draft',
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tb_period_idx" ON "trialBalances" ("tenantId", "periodEnd", "glAccountCode");
