CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"accountId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"accountName" varchar(191) NOT NULL,
	"accountType" text NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"availableBalance" double precision DEFAULT 0 NOT NULL,
	"ledgerBalance" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"branchCode" varchar(16) NOT NULL,
	"openedAt" timestamp DEFAULT now() NOT NULL,
	"lastTransactionAt" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"tigerbeetleAccountId" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_accountId_unique" UNIQUE("accountId")
);
--> statement-breakpoint
CREATE TABLE "acgsf_guarantee" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "adverse_media_hits" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_name" text NOT NULL,
	"source" varchar(128) NOT NULL,
	"headline" text,
	"risk_impact" varchar(16) DEFAULT 'medium' NOT NULL,
	"sentiment" double precision,
	"url" text,
	"detected_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp,
	"status" varchar(32) DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adverse_media_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"customerId" varchar(50) NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"relevantArticles" integer DEFAULT 0,
	"sentiment" varchar(20) NOT NULL,
	"riskImpact" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agentBankingAgents" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"agentCode" varchar(20) NOT NULL,
	"businessName" varchar(255) NOT NULL,
	"ownerName" varchar(255) NOT NULL,
	"phoneNumber" varchar(20) NOT NULL,
	"email" varchar(255),
	"bvn" varchar(11),
	"lga" varchar(128),
	"state" varchar(64),
	"agentType" varchar(20) NOT NULL,
	"superAgentId" varchar(64),
	"floatBalance" double precision DEFAULT 0,
	"commissionEarned" double precision DEFAULT 0,
	"transactionCount" integer DEFAULT 0,
	"kycStatus" varchar(16) DEFAULT 'pending',
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agentBankingAgents_agentId_unique" UNIQUE("agentId"),
	CONSTRAINT "agentBankingAgents_agentCode_unique" UNIQUE("agentCode")
);
--> statement-breakpoint
CREATE TABLE "agent_farmer_onboarding" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_kyc_captures" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"agent_name" text,
	"customer_id" varchar(64),
	"customer_name" text,
	"lga" varchar(128),
	"state" varchar(64),
	"offline_capture" integer DEFAULT 0 NOT NULL,
	"quality_score" double precision,
	"gps_lat" double precision,
	"gps_lng" double precision,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aggregation_center" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agri_esg_impact" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agri_evoucher" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agri_input_marketplace" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agri_iot_sensor" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agriLoans" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"farmerId" varchar(32) NOT NULL,
	"loanType" varchar(50) NOT NULL,
	"productCode" varchar(50) NOT NULL,
	"principalAmount" double precision NOT NULL,
	"interestRateBps" integer NOT NULL,
	"tenorMonths" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"purpose" text NOT NULL,
	"collateralType" varchar(100) NOT NULL,
	"collateralValue" double precision NOT NULL,
	"cropCycle" varchar(50) NOT NULL,
	"expectedHarvestDate" varchar(20) NOT NULL,
	"disbursementDate" varchar(30),
	"maturityDate" varchar(30),
	"outstandingBalance" double precision NOT NULL,
	"totalRepaid" double precision DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'pending_approval' NOT NULL,
	"approvalStatus" varchar(30) DEFAULT 'pending' NOT NULL,
	"riskGrade" varchar(5) NOT NULL,
	"repaymentSchedule" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agriLoans_loanId_unique" UNIQUE("loanId")
);
--> statement-breakpoint
CREATE TABLE "agri_logistics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agri_reinsurance" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agri_savings_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "amlAlerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"alertId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"entityType" text NOT NULL,
	"entityId" varchar(64) NOT NULL,
	"ruleId" varchar(64) NOT NULL,
	"ruleName" varchar(191) NOT NULL,
	"riskScore" double precision NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assignedTo" varchar(128),
	"notes" text,
	"detectedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "amlAlerts_alertId_unique" UNIQUE("alertId")
);
--> statement-breakpoint
CREATE TABLE "aml_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"customerId" varchar(50) NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"caseType" varchar(30) NOT NULL,
	"riskLevel" varchar(20) NOT NULL,
	"assignedTo" varchar(100) NOT NULL,
	"sarFiled" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aml_compliance_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" varchar(20) NOT NULL,
	"totalScreenings" integer DEFAULT 0,
	"sarsFiled" integer DEFAULT 0,
	"ctrsFiled" integer DEFAULT 0,
	"complianceScore" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regulatory_reports_aml" (
	"id" serial PRIMARY KEY NOT NULL,
	"reportType" varchar(50) NOT NULL,
	"period" varchar(20) NOT NULL,
	"submittedTo" varchar(30) NOT NULL,
	"filedDate" varchar(30) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aml_risk_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"customerId" varchar(50) NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"riskScore" integer DEFAULT 0,
	"riskLevel" varchar(20) NOT NULL,
	"sanctionsHits" integer DEFAULT 0,
	"pepMatch" boolean DEFAULT false,
	"adverseMedia" integer DEFAULT 0,
	"cddLevel" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aml_training_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"staffId" varchar(30) NOT NULL,
	"staffName" varchar(200) NOT NULL,
	"role" varchar(50) NOT NULL,
	"trainingModule" varchar(200) NOT NULL,
	"score" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "animal_id_traceability" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "anomaly_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"model_type" varchar(50),
	"features" jsonb,
	"accuracy" real,
	"precision" real,
	"recall" real,
	"f1_score" real,
	"training_size" bigint,
	"anomalies_24h" integer DEFAULT 0,
	"true_positives" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'production',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "anti_spoofing_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" text NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"customer_id" text NOT NULL,
	"liveness_check_id" text NOT NULL,
	"is_spoof" boolean NOT NULL,
	"spoof_type" text DEFAULT 'none' NOT NULL,
	"overall_confidence" real NOT NULL,
	"texture_lbp_score" real,
	"monocular_depth_score" real,
	"frequency_fft_score" real,
	"edge_boundary_score" real,
	"moire_detected" boolean DEFAULT false,
	"reflection_anomaly" boolean DEFAULT false,
	"deepfake_probability" real DEFAULT 0,
	"model_version" text DEFAULT 'v1.0',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "anti_spoofing_results_result_id_unique" UNIQUE("result_id")
);
--> statement-breakpoint
CREATE TABLE "api_key_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"prefix" varchar(20),
	"required_scopes" jsonb,
	"ip_whitelist" jsonb,
	"rate_limit" integer,
	"rotation_warning_days" integer,
	"active_keys" integer DEFAULT 0,
	"violations_24h" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'enforced',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key_id" text NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text,
	"tenant_id" text,
	"scopes" text,
	"rate_limit" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"ip_whitelist" text,
	"usage_count" bigint DEFAULT 0,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "apisix_plugin_chains" (
	"id" serial PRIMARY KEY NOT NULL,
	"route" varchar(200) NOT NULL,
	"avgLatencyMs" real DEFAULT 0,
	"latencySaving" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "area_yield_index_insurance" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auditEntries" (
	"id" serial PRIMARY KEY NOT NULL,
	"auditId" varchar(64) NOT NULL,
	"timestampAt" timestamp DEFAULT now() NOT NULL,
	"actorRole" varchar(64) NOT NULL,
	"actorId" varchar(96) NOT NULL,
	"entityType" varchar(96) NOT NULL,
	"entityId" varchar(96) NOT NULL,
	"action" varchar(96) NOT NULL,
	"outcome" text NOT NULL,
	"severity" text NOT NULL,
	"route" varchar(191) NOT NULL,
	"middleware" jsonb NOT NULL,
	"detail" text NOT NULL,
	CONSTRAINT "auditEntries_auditId_unique" UNIQUE("auditId")
);
--> statement-breakpoint
CREATE TABLE "auditTrail" (
	"id" serial PRIMARY KEY NOT NULL,
	"auditId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"entityType" text NOT NULL,
	"entityId" varchar(64) NOT NULL,
	"action" text NOT NULL,
	"actorId" varchar(128) NOT NULL,
	"actorRole" varchar(64) NOT NULL,
	"changes" jsonb,
	"ipAddress" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auditTrail_auditId_unique" UNIQUE("auditId")
);
--> statement-breakpoint
CREATE TABLE "avro_schemas" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" varchar(100) NOT NULL,
	"version" integer DEFAULT 0,
	"compatibilityMode" varchar(20) NOT NULL,
	"serializedSizeBytes" integer DEFAULT 0,
	"compressionRatio" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bankGuarantees" (
	"id" serial PRIMARY KEY NOT NULL,
	"guaranteeId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"guaranteeType" varchar(30) DEFAULT 'performance' NOT NULL,
	"applicantId" varchar(64) NOT NULL,
	"applicantName" varchar(200) NOT NULL,
	"beneficiaryName" varchar(200) NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"purpose" text NOT NULL,
	"effectiveDate" varchar(20) NOT NULL,
	"expiryDate" varchar(20) NOT NULL,
	"claimDeadline" varchar(20),
	"commissionRate" double precision NOT NULL,
	"commissionAmount" double precision NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bankGuarantees_guaranteeId_unique" UNIQUE("guaranteeId")
);
--> statement-breakpoint
CREATE TABLE "batch_aggregator_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"maxRequests" integer DEFAULT 0,
	"timeoutMs" integer DEFAULT 0,
	"avgBatchSize" real DEFAULT 0,
	"requestsSaved24h" bigint DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "beneficial_owners" (
	"id" serial PRIMARY KEY NOT NULL,
	"entityId" varchar(50) NOT NULL,
	"entityName" varchar(200) NOT NULL,
	"entityType" varchar(30) NOT NULL,
	"rcNumber" varchar(30) NOT NULL,
	"totalLayers" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "billingAccounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"billingAccountId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"accountName" varchar(191) NOT NULL,
	"billingModel" text NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" text NOT NULL,
	"contractStartAt" timestamp NOT NULL,
	"contractEndAt" timestamp,
	"defaultRateCardId" varchar(64) NOT NULL,
	"minimumCommitAmount" double precision DEFAULT 0 NOT NULL,
	"defaultBillingPeriodType" text DEFAULT 'monthly' NOT NULL,
	"invoiceDueDays" integer DEFAULT 14 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingAccounts_billingAccountId_unique" UNIQUE("billingAccountId")
);
--> statement-breakpoint
CREATE TABLE "billingAccrualSnapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"accrualSnapshotId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"billingAccountId" varchar(64) NOT NULL,
	"billingPeriodKey" varchar(32) NOT NULL,
	"meterKey" varchar(96) NOT NULL,
	"productKey" varchar(96) NOT NULL,
	"ratedEventCount" integer DEFAULT 0 NOT NULL,
	"usageQuantity" integer DEFAULT 0 NOT NULL,
	"accruedAmount" double precision DEFAULT 0 NOT NULL,
	"unratedEventCount" integer DEFAULT 0 NOT NULL,
	"lastUsageAt" timestamp,
	"lastRatedAt" timestamp,
	"snapshotStatus" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingAccrualSnapshots_accrualSnapshotId_unique" UNIQUE("accrualSnapshotId")
);
--> statement-breakpoint
CREATE TABLE "billingContractOverrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractOverrideId" varchar(64) NOT NULL,
	"billingAccountId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"overrideType" text NOT NULL,
	"meterKey" varchar(96),
	"productKey" varchar(96),
	"valueNumber" double precision,
	"valueText" varchar(96),
	"effectiveFrom" timestamp NOT NULL,
	"effectiveTo" timestamp,
	"status" text NOT NULL,
	"createdBy" varchar(96) NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingContractOverrides_contractOverrideId_unique" UNIQUE("contractOverrideId")
);
--> statement-breakpoint
CREATE TABLE "billingDiscountRules" (
	"id" serial PRIMARY KEY NOT NULL,
	"discountRuleId" varchar(64) NOT NULL,
	"billingAccountId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"name" varchar(191) NOT NULL,
	"discountType" text NOT NULL,
	"meterKey" varchar(96),
	"productKey" varchar(96),
	"percentage" double precision,
	"fixedAmount" double precision,
	"thresholdAmount" double precision,
	"effectiveFrom" timestamp NOT NULL,
	"effectiveTo" timestamp,
	"status" text NOT NULL,
	"createdBy" varchar(96) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingDiscountRules_discountRuleId_unique" UNIQUE("discountRuleId")
);
--> statement-breakpoint
CREATE TABLE "billingInvoiceApprovals" (
	"id" serial PRIMARY KEY NOT NULL,
	"billingInvoiceApprovalId" varchar(96) NOT NULL,
	"billingInvoiceId" varchar(64) NOT NULL,
	"stageKey" varchar(96) NOT NULL,
	"actorRole" text NOT NULL,
	"status" text NOT NULL,
	"actedAt" timestamp,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingInvoiceApprovals_billingInvoiceApprovalId_unique" UNIQUE("billingInvoiceApprovalId")
);
--> statement-breakpoint
CREATE TABLE "billingInvoiceLines" (
	"id" serial PRIMARY KEY NOT NULL,
	"billingInvoiceLineId" varchar(96) NOT NULL,
	"billingInvoiceId" varchar(64) NOT NULL,
	"lineType" text NOT NULL,
	"meterKey" varchar(96),
	"productKey" varchar(96),
	"description" varchar(191) NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"unitPrice" double precision DEFAULT 0 NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingInvoiceLines_billingInvoiceLineId_unique" UNIQUE("billingInvoiceLineId")
);
--> statement-breakpoint
CREATE TABLE "billingInvoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"billingInvoiceId" varchar(64) NOT NULL,
	"invoiceNumber" varchar(96) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"billingAccountId" varchar(64) NOT NULL,
	"billingPeriodKey" varchar(32) NOT NULL,
	"billingPeriodType" text NOT NULL,
	"periodStartAt" timestamp NOT NULL,
	"periodEndAt" timestamp NOT NULL,
	"currency" varchar(3) NOT NULL,
	"subtotalAmount" double precision DEFAULT 0 NOT NULL,
	"discountAmount" double precision DEFAULT 0 NOT NULL,
	"revenueShareAmount" double precision DEFAULT 0 NOT NULL,
	"minimumCommitAdjustment" double precision DEFAULT 0 NOT NULL,
	"taxAmount" double precision DEFAULT 0 NOT NULL,
	"totalAmount" double precision DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"approvalStatus" text NOT NULL,
	"generatedAt" timestamp DEFAULT now() NOT NULL,
	"dueAt" timestamp NOT NULL,
	"approvalStepCount" integer DEFAULT 0 NOT NULL,
	"issuedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingInvoices_billingInvoiceId_unique" UNIQUE("billingInvoiceId"),
	CONSTRAINT "billingInvoices_invoiceNumber_unique" UNIQUE("invoiceNumber")
);
--> statement-breakpoint
CREATE TABLE "billingRateCardLines" (
	"id" serial PRIMARY KEY NOT NULL,
	"rateCardLineId" varchar(64) NOT NULL,
	"rateCardId" varchar(64) NOT NULL,
	"meterKey" varchar(96) NOT NULL,
	"productKey" varchar(96) NOT NULL,
	"chargeType" text NOT NULL,
	"unitPrice" double precision DEFAULT 0 NOT NULL,
	"includedUnits" integer DEFAULT 0 NOT NULL,
	"tierStart" integer,
	"tierEnd" integer,
	"minimumCharge" double precision,
	"maximumCharge" double precision,
	"pricingFormula" jsonb,
	"settlementLedgerCode" varchar(96),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingRateCardLines_rateCardLineId_unique" UNIQUE("rateCardLineId")
);
--> statement-breakpoint
CREATE TABLE "billingRateCards" (
	"id" serial PRIMARY KEY NOT NULL,
	"rateCardId" varchar(64) NOT NULL,
	"billingAccountId" varchar(64),
	"name" varchar(191) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"effectiveFrom" timestamp NOT NULL,
	"effectiveTo" timestamp,
	"pricingCurrency" varchar(3) NOT NULL,
	"createdBy" varchar(96) NOT NULL,
	"approvalState" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingRateCards_rateCardId_unique" UNIQUE("rateCardId")
);
--> statement-breakpoint
CREATE TABLE "billingRatedEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"ratedEventId" varchar(64) NOT NULL,
	"usageEventId" varchar(64) NOT NULL,
	"rateCardId" varchar(64) NOT NULL,
	"rateCardLineId" varchar(64) NOT NULL,
	"billingPeriodKey" varchar(32) NOT NULL,
	"quantityRated" integer DEFAULT 0 NOT NULL,
	"billableUnits" double precision DEFAULT 0 NOT NULL,
	"amountAccrued" double precision DEFAULT 0 NOT NULL,
	"currency" varchar(3) NOT NULL,
	"ratingExplanation" jsonb NOT NULL,
	"ratedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingRatedEvents_ratedEventId_unique" UNIQUE("ratedEventId")
);
--> statement-breakpoint
CREATE TABLE "billingRevenueShareRules" (
	"id" serial PRIMARY KEY NOT NULL,
	"revenueShareRuleId" varchar(64) NOT NULL,
	"billingAccountId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"name" varchar(191) NOT NULL,
	"target" text NOT NULL,
	"percentage" double precision DEFAULT 0 NOT NULL,
	"beneficiaryName" varchar(191) NOT NULL,
	"settlementLedgerCode" varchar(96),
	"effectiveFrom" timestamp NOT NULL,
	"effectiveTo" timestamp,
	"status" text NOT NULL,
	"createdBy" varchar(96) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingRevenueShareRules_revenueShareRuleId_unique" UNIQUE("revenueShareRuleId")
);
--> statement-breakpoint
CREATE TABLE "billingUsageEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"usageEventId" varchar(64) NOT NULL,
	"idempotencyKey" varchar(128) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"billingAccountId" varchar(64) NOT NULL,
	"sourceService" varchar(96) NOT NULL,
	"sourceEventType" varchar(96) NOT NULL,
	"meterKey" varchar(96) NOT NULL,
	"productKey" varchar(96) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unitAmount" double precision,
	"currency" varchar(3) NOT NULL,
	"eventTimestamp" timestamp NOT NULL,
	"ingestedAt" timestamp DEFAULT now() NOT NULL,
	"correlationId" varchar(128),
	"actorId" varchar(96),
	"resourceId" varchar(96),
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billingUsageEvents_usageEventId_unique" UNIQUE("usageEventId")
);
--> statement-breakpoint
CREATE TABLE "bloom_filters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"capacity" bigint DEFAULT 0,
	"falsePositiveRate" varchar(20) NOT NULL,
	"hashFunctions" integer DEFAULT 0,
	"memoryMB" real DEFAULT 0,
	"lookups24h" bigint DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bnpl_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant-lagos-main' NOT NULL,
	"customer_id" text NOT NULL,
	"merchant_name" text NOT NULL,
	"order_amount" real NOT NULL,
	"product" text NOT NULL,
	"installments" integer NOT NULL,
	"installment_amount" real NOT NULL,
	"interest_rate" real DEFAULT 0,
	"paid_installments" integer DEFAULT 0,
	"next_due_date" timestamp,
	"credit_score" integer,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "body_limit_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"method" varchar(10),
	"max_body_bytes" bigint,
	"content_types" jsonb,
	"enforced" boolean DEFAULT true,
	"violations_24h" integer DEFAULT 0,
	"blocked_24h" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bundle_split_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"chunk" varchar(100) NOT NULL,
	"routes" integer DEFAULT 0,
	"sizeKB" integer DEFAULT 0,
	"loadTimeMs" integer DEFAULT 0,
	"preloadHint" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bureau_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"bureau" varchar(32) NOT NULL,
	"credit_score" integer,
	"risk_grade" varchar(8),
	"active_loans" integer DEFAULT 0 NOT NULL,
	"default_history" integer DEFAULT 0 NOT NULL,
	"checked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cache_invalidations" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" varchar(100) NOT NULL,
	"subscribers" integer DEFAULT 0,
	"invalidations24h" integer DEFAULT 0,
	"avgPropagationMs" real DEFAULT 0,
	"pattern" varchar(30) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "card_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"batch_size" integer NOT NULL,
	"card_type" text NOT NULL,
	"generated_by" text,
	"status" text DEFAULT 'generating' NOT NULL,
	"cards_issued" integer DEFAULT 0,
	"cards_used" integer DEFAULT 0,
	"cards_revoked" integer DEFAULT 0,
	"branch_code" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cardTransactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardTxnId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"cardId" varchar(64) NOT NULL,
	"accountId" varchar(64) NOT NULL,
	"merchantName" varchar(191),
	"merchantCategory" varchar(8),
	"amount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"authorizationCode" varchar(12),
	"stan" varchar(12),
	"rrn" varchar(24),
	"status" text DEFAULT 'approved' NOT NULL,
	"declineReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cardTransactions_cardTxnId_unique" UNIQUE("cardTxnId")
);
--> statement-breakpoint
CREATE TABLE "cbn_agri_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cbn_agsmeis" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cbn_anchor_borrowers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cbn_compliance_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"circular" varchar(100) NOT NULL,
	"title" text,
	"category" varchar(50),
	"total_controls" integer DEFAULT 0,
	"passing" integer DEFAULT 0,
	"failing" integer DEFAULT 0,
	"compliance_score" real,
	"last_assessed" timestamp,
	"next_assessment" timestamp,
	"status" varchar(30) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cdn_edge_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"origin" varchar(200) NOT NULL,
	"ttlStatic" integer DEFAULT 0,
	"ttlApi" integer DEFAULT 0,
	"brotliEnabled" boolean DEFAULT false,
	"bandwidthSaved24h" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"cert_id" text NOT NULL,
	"common_name" text NOT NULL,
	"cert_type" text NOT NULL,
	"algorithm" text,
	"issuer" text,
	"serial_number" text,
	"status" text DEFAULT 'active' NOT NULL,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"renewal_days" integer,
	"last_renewed" timestamp,
	"revoked_at" timestamp,
	"revocation_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chatbot_intents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant-lagos-main' NOT NULL,
	"intent" text NOT NULL,
	"category" text NOT NULL,
	"confidence_threshold" real DEFAULT 0.85,
	"responses" integer DEFAULT 0,
	"avg_confidence" real DEFAULT 0.92,
	"escalation_rate" real DEFAULT 0.05,
	"channel" text DEFAULT 'all',
	"language" text DEFAULT 'en',
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coalescing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"route" varchar(200) NOT NULL,
	"windowMs" integer DEFAULT 0,
	"coalescedRequests24h" bigint DEFAULT 0,
	"uniqueRequests24h" bigint DEFAULT 0,
	"savingsRatio" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commodity_exchange" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commodity_price_intelligence" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compression_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"algorithm" varchar(20) NOT NULL,
	"level" integer DEFAULT 0,
	"minBytes" integer DEFAULT 0,
	"compressionRatio" varchar(20) NOT NULL,
	"bandwidthSaved24h" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cooperative_credit_scoring" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cooperative_financials" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cooperative_management" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cooperative_meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "corporate_monitoring_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar(64) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"description" text,
	"risk_impact" varchar(16) DEFAULT 'medium' NOT NULL,
	"source_system" varchar(64),
	"detected_at" timestamp DEFAULT now(),
	"acknowledged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "correlation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"mitre_ids" jsonb,
	"kill_chain_phase" varchar(50),
	"trigger_events" jsonb,
	"correlation_window" varchar(20),
	"triggered_24h" integer DEFAULT 0,
	"true_positives" integer DEFAULT 0,
	"false_positives" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cropInsurancePolicies" (
	"id" serial PRIMARY KEY NOT NULL,
	"policyId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"farmerId" varchar(32) NOT NULL,
	"policyType" varchar(50) NOT NULL,
	"cropCovered" varchar(100) NOT NULL,
	"coverageAreaHectares" double precision NOT NULL,
	"sumInsured" double precision NOT NULL,
	"premiumAmount" double precision NOT NULL,
	"premiumFrequency" varchar(20) DEFAULT 'annual' NOT NULL,
	"policyStart" varchar(20) NOT NULL,
	"policyEnd" varchar(20) NOT NULL,
	"weatherTrigger" jsonb,
	"claims" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"underwriter" varchar(200) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cropInsurancePolicies_policyId_unique" UNIQUE("policyId")
);
--> statement-breakpoint
CREATE TABLE "crop_yield_prediction" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crossborder_agri_trade" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crypto_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key_id" text NOT NULL,
	"name" text NOT NULL,
	"key_type" text NOT NULL,
	"algorithm" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"key_size_bits" integer,
	"rotation_period_days" integer,
	"hsm_slot" text,
	"custodian_1" text,
	"custodian_2" text,
	"usage_count" bigint DEFAULT 0,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"rotated_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "csp_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(200) NOT NULL,
	"directives" jsonb,
	"report_uri" text,
	"violations_24h" integer DEFAULT 0,
	"unique_sources" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'enforce',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ctr_reports_aml" (
	"id" serial PRIMARY KEY NOT NULL,
	"customerId" varchar(50) NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"transactionId" varchar(50) NOT NULL,
	"amount" bigint DEFAULT 0,
	"currency" varchar(5) NOT NULL,
	"transactionType" varchar(30) NOT NULL,
	"nfiuReference" varchar(50) NOT NULL,
	"autoFiled" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customerApprovals" (
	"id" serial PRIMARY KEY NOT NULL,
	"approvalId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"entityType" text NOT NULL,
	"entityId" varchar(64) NOT NULL,
	"title" varchar(191) NOT NULL,
	"detail" text NOT NULL,
	"route" varchar(191) NOT NULL,
	"state" text NOT NULL,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"requestedByRole" varchar(64) NOT NULL,
	"requestedById" varchar(96) NOT NULL,
	"approvalRole" varchar(64) NOT NULL,
	"resolvedAt" timestamp,
	"resolutionNote" text,
	CONSTRAINT "customerApprovals_approvalId_unique" UNIQUE("approvalId")
);
--> statement-breakpoint
CREATE TABLE "customerBillPayments" (
	"id" serial PRIMARY KEY NOT NULL,
	"paymentId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"category" text NOT NULL,
	"provider" varchar(191) NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"paidAt" timestamp DEFAULT now() NOT NULL,
	"reference" varchar(128) NOT NULL,
	"billerId" varchar(96),
	"customerReference" varchar(128),
	"customerName" varchar(191),
	"scheduledFor" timestamp,
	"evidenceStatus" text,
	"channel" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customerBillPayments_paymentId_unique" UNIQUE("paymentId")
);
--> statement-breakpoint
CREATE TABLE "customerCardEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" varchar(64) NOT NULL,
	"cardId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"title" varchar(191) NOT NULL,
	"detail" text NOT NULL,
	"severity" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customerCardEvents_eventId_unique" UNIQUE("eventId")
);
--> statement-breakpoint
CREATE TABLE "customerCards" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"cardType" text NOT NULL,
	"brand" text NOT NULL,
	"lastFour" varchar(4) NOT NULL,
	"expiryDate" varchar(16) NOT NULL,
	"cardHolder" varchar(191) NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"isLocked" integer DEFAULT 0 NOT NULL,
	"controls" jsonb NOT NULL,
	"spendingLimits" jsonb NOT NULL,
	"colorTone" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customerCards_cardId_unique" UNIQUE("cardId")
);
--> statement-breakpoint
CREATE TABLE "customerNotifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"notificationId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"title" varchar(191) NOT NULL,
	"message" text NOT NULL,
	"notificationType" text NOT NULL,
	"isRead" integer DEFAULT 0 NOT NULL,
	"actionUrl" varchar(191),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customerNotifications_notificationId_unique" UNIQUE("notificationId")
);
--> statement-breakpoint
CREATE TABLE "customerSavedBillers" (
	"id" serial PRIMARY KEY NOT NULL,
	"billerRecordId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"category" text NOT NULL,
	"provider" varchar(191) NOT NULL,
	"billerId" varchar(96) NOT NULL,
	"customerReference" varchar(128) NOT NULL,
	"nickname" varchar(128) NOT NULL,
	"lastAmount" double precision DEFAULT 0 NOT NULL,
	"verifiedName" varchar(191),
	"lastPaidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customerSavedBillers_billerRecordId_unique" UNIQUE("billerRecordId")
);
--> statement-breakpoint
CREATE TABLE "customerSessionPreferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorId" varchar(96) NOT NULL,
	"actorRole" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"activeCustomerId" varchar(64) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customerStatementExports" (
	"id" serial PRIMARY KEY NOT NULL,
	"exportRequestId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"exportJobId" varchar(64) NOT NULL,
	"format" text NOT NULL,
	"rowCount" integer DEFAULT 0 NOT NULL,
	"title" varchar(191) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customerStatementExports_exportRequestId_unique" UNIQUE("exportRequestId")
);
--> statement-breakpoint
CREATE TABLE "customerStatements" (
	"id" serial PRIMARY KEY NOT NULL,
	"statementId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"title" varchar(191) NOT NULL,
	"detail" text NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"direction" text NOT NULL,
	"statementType" text NOT NULL,
	"status" text NOT NULL,
	"occurredAt" timestamp DEFAULT now() NOT NULL,
	"reference" varchar(128),
	"category" varchar(96),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customerStatements_statementId_unique" UNIQUE("statementId")
);
--> statement-breakpoint
CREATE TABLE "customerTransfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transferId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"beneficiaryId" varchar(64),
	"beneficiaryName" varchar(191) NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"narration" text,
	"transferType" text NOT NULL,
	"status" text NOT NULL,
	"bankCode" varchar(32),
	"bankName" varchar(96),
	"accountNumber" varchar(32),
	"accountName" varchar(191),
	"workflowId" varchar(64),
	"otpReference" varchar(64),
	"otpIssuedAt" timestamp,
	"confirmedAt" timestamp,
	"approvalState" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customerTransfers_transferId_unique" UNIQUE("transferId")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"name" varchar(191) NOT NULL,
	"segment" varchar(96) NOT NULL,
	"tier" varchar(64) NOT NULL,
	"location" varchar(128) NOT NULL,
	"relationshipManager" varchar(128) NOT NULL,
	"risk" varchar(64) NOT NULL,
	"status" text NOT NULL,
	"bvn" varchar(32) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"lastTouchpointLabel" varchar(128) NOT NULL,
	"lastTouchpointAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_customerId_unique" UNIQUE("customerId")
);
--> statement-breakpoint
CREATE TABLE "ddos_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"layer" varchar(5),
	"threshold" varchar(50),
	"action" varchar(20),
	"mitigated_24h" integer DEFAULT 0,
	"false_positives" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint_hash" varchar(64),
	"user_id" varchar(50),
	"device_type" varchar(20),
	"browser" varchar(50),
	"os" varchar(50),
	"screen_res" varchar(20),
	"timezone" varchar(50),
	"trust_score" integer DEFAULT 0,
	"sessions_count" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'trusted',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "disputeCases" (
	"id" serial PRIMARY KEY NOT NULL,
	"disputeId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"customerId" varchar(64),
	"customerName" varchar(255) NOT NULL,
	"category" varchar(64) NOT NULL,
	"description" text,
	"transactionId" varchar(64),
	"transactionAmount" double precision,
	"disputedAmount" double precision,
	"channel" varchar(16),
	"priority" varchar(16) DEFAULT 'medium',
	"status" varchar(32) DEFAULT 'filed' NOT NULL,
	"slaDeadline" timestamp,
	"assignedTo" varchar(64),
	"resolution" varchar(32),
	"resolutionAmount" double precision,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "disputeCases_disputeId_unique" UNIQUE("disputeId")
);
--> statement-breakpoint
CREATE TABLE "distroless_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(100) NOT NULL,
	"baseImage" varchar(200) NOT NULL,
	"imageSizeMB" real DEFAULT 0,
	"previousSizeMB" real DEFAULT 0,
	"reductionPct" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docker_hardening_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"check_name" varchar(100) NOT NULL,
	"category" varchar(50),
	"cis_benchmark" varchar(20),
	"passing_containers" integer DEFAULT 0,
	"failing_containers" integer DEFAULT 0,
	"total_containers" integer DEFAULT 0,
	"severity" varchar(20),
	"status" varchar(30) DEFAULT 'unknown',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "educationLoans" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"studentId" varchar(64),
	"studentName" varchar(255) NOT NULL,
	"institutionName" varchar(255) NOT NULL,
	"programName" varchar(255),
	"loanAmount" double precision NOT NULL,
	"interestRate" double precision NOT NULL,
	"tenorMonths" integer NOT NULL,
	"graceMonths" integer NOT NULL,
	"emi" double precision NOT NULL,
	"totalDisbursed" double precision DEFAULT 0,
	"totalRepaid" double precision DEFAULT 0,
	"outstandingBalance" double precision NOT NULL,
	"cosignerName" varchar(255),
	"cosignerType" varchar(32),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "educationLoans_loanId_unique" UNIQUE("loanId")
);
--> statement-breakpoint
CREATE TABLE "efassMapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"glCodeStart" varchar(32) NOT NULL,
	"glCodeEnd" varchar(32) NOT NULL,
	"mbrForm" varchar(16) NOT NULL,
	"mbrLine" integer NOT NULL,
	"lineName" varchar(191) NOT NULL,
	"reportCategory" text NOT NULL,
	"aggregationType" varchar(16) DEFAULT 'sum' NOT NULL,
	"signConvention" varchar(8) DEFAULT 'normal' NOT NULL,
	"cbnCode" varchar(32),
	"notes" text,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "efass_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" varchar(16) NOT NULL,
	"type" varchar(16) NOT NULL,
	"tier1_count" integer DEFAULT 0 NOT NULL,
	"tier2_count" integer DEFAULT 0 NOT NULL,
	"tier3_count" integer DEFAULT 0 NOT NULL,
	"total_customers" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "egress_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"domains" jsonb,
	"ports" jsonb,
	"protocol" varchar(20),
	"allowed" boolean DEFAULT false,
	"requests_24h" bigint DEFAULT 0,
	"blocked_24h" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_leasing" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erpnextSyncJobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"jobId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"syncType" varchar(32) NOT NULL,
	"direction" varchar(16) NOT NULL,
	"status" varchar(32) NOT NULL,
	"recordsProcessed" integer DEFAULT 0,
	"recordsFailed" integer DEFAULT 0,
	"recordsSkipped" integer DEFAULT 0,
	"retryCount" integer DEFAULT 0,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "erpnextSyncJobs_jobId_unique" UNIQUE("jobId")
);
--> statement-breakpoint
CREATE TABLE "escrow_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"escrowId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"escrowType" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"condition" text,
	"expiresAt" timestamp,
	"interestRate" double precision DEFAULT 0,
	"accruedInterest" double precision DEFAULT 0,
	"setupFee" double precision DEFAULT 0,
	"holdingFeeAnnual" double precision DEFAULT 0,
	"totalFeesCharged" double precision DEFAULT 0,
	"tigerBeetleTxId" varchar(64),
	"kafkaEventId" varchar(64),
	"temporalWorkflowId" varchar(128),
	"approvedBy" varchar(128),
	"releasedAt" timestamp,
	"cancelledAt" timestamp,
	"disputeReason" text,
	"notes" text,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_accounts_escrowId_unique" UNIQUE("escrowId")
);
--> statement-breakpoint
CREATE TABLE "escrow_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"auditId" varchar(32) NOT NULL,
	"escrowId" varchar(32) NOT NULL,
	"action" varchar(64) NOT NULL,
	"actor" varchar(256) NOT NULL,
	"details" text,
	"ipAddress" varchar(45),
	"kafkaTopic" varchar(128),
	"kafkaOffset" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_audit_log_auditId_unique" UNIQUE("auditId")
);
--> statement-breakpoint
CREATE TABLE "escrow_disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"disputeId" varchar(32) NOT NULL,
	"escrowId" varchar(32) NOT NULL,
	"raisedBy" varchar(256) NOT NULL,
	"raisedByPartyId" integer,
	"reason" text NOT NULL,
	"category" varchar(64),
	"status" varchar(32) DEFAULT 'under_review' NOT NULL,
	"resolution" text,
	"arbitratorName" varchar(256),
	"arbitratorDecision" text,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_disputes_disputeId_unique" UNIQUE("disputeId")
);
--> statement-breakpoint
CREATE TABLE "escrow_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"documentId" varchar(32) NOT NULL,
	"escrowId" varchar(32) NOT NULL,
	"documentType" varchar(64) NOT NULL,
	"fileName" varchar(512) NOT NULL,
	"fileSize" integer,
	"mimeType" varchar(128),
	"storageUrl" text,
	"uploadedBy" varchar(256),
	"verifiedBy" varchar(256),
	"verifiedAt" timestamp,
	"status" varchar(32) DEFAULT 'uploaded',
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_documents_documentId_unique" UNIQUE("documentId")
);
--> statement-breakpoint
CREATE TABLE "escrow_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"feeId" varchar(32) NOT NULL,
	"escrowId" varchar(32) NOT NULL,
	"feeType" varchar(32) NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"chargedAt" timestamp DEFAULT now() NOT NULL,
	"status" varchar(32) DEFAULT 'charged',
	"ledgerRef" varchar(64),
	"narration" text,
	CONSTRAINT "escrow_fees_feeId_unique" UNIQUE("feeId")
);
--> statement-breakpoint
CREATE TABLE "escrow_interest_accruals" (
	"id" serial PRIMARY KEY NOT NULL,
	"accrualId" varchar(32) NOT NULL,
	"escrowId" varchar(32) NOT NULL,
	"principalAmount" double precision NOT NULL,
	"rate" double precision NOT NULL,
	"accrualPeriodStart" timestamp NOT NULL,
	"accrualPeriodEnd" timestamp NOT NULL,
	"daysInPeriod" integer NOT NULL,
	"interestAmount" double precision NOT NULL,
	"cumulativeInterest" double precision NOT NULL,
	"status" varchar(32) DEFAULT 'accrued',
	"ledgerRef" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_interest_accruals_accrualId_unique" UNIQUE("accrualId")
);
--> statement-breakpoint
CREATE TABLE "escrow_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"milestoneId" varchar(32) NOT NULL,
	"escrowId" varchar(32) NOT NULL,
	"description" text NOT NULL,
	"releaseAmount" double precision,
	"releasePercent" double precision,
	"dueDate" timestamp,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"verifiedBy" varchar(128),
	"verifiedAt" timestamp,
	"evidenceDocId" varchar(64),
	"sequenceOrder" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_milestones_milestoneId_unique" UNIQUE("milestoneId")
);
--> statement-breakpoint
CREATE TABLE "escrow_parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"escrowId" varchar(32) NOT NULL,
	"role" varchar(32) NOT NULL,
	"name" varchar(256) NOT NULL,
	"accountId" varchar(64),
	"email" varchar(320),
	"phone" varchar(32),
	"kycStatus" varchar(32) DEFAULT 'pending',
	"kybStatus" varchar(32) DEFAULT 'pending',
	"sharePercent" double precision DEFAULT 0,
	"signedAt" timestamp,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrow_regulatory_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reportId" varchar(32) NOT NULL,
	"reportType" varchar(64) NOT NULL,
	"reportingPeriodStart" timestamp NOT NULL,
	"reportingPeriodEnd" timestamp NOT NULL,
	"totalEscrowAccounts" integer,
	"totalHeldValue" double precision,
	"totalReleasedValue" double precision,
	"totalDisputedValue" double precision,
	"totalInterestAccrued" double precision,
	"filedAt" timestamp,
	"filingReference" varchar(128),
	"status" varchar(32) DEFAULT 'draft',
	"reportData" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_regulatory_reports_reportId_unique" UNIQUE("reportId")
);
--> statement-breakpoint
CREATE TABLE "escrow_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"txId" varchar(32) NOT NULL,
	"escrowId" varchar(32) NOT NULL,
	"type" varchar(32) NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"fromAccount" varchar(64),
	"toAccount" varchar(64),
	"status" varchar(32) NOT NULL,
	"ledgerRef" varchar(64),
	"milestoneId" varchar(32),
	"narration" text,
	"fxRate" double precision,
	"fxSourceCurrency" varchar(8),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_transactions_txId_unique" UNIQUE("txId")
);
--> statement-breakpoint
CREATE TABLE "esusuGroups" (
	"id" serial PRIMARY KEY NOT NULL,
	"groupId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"name" varchar(255) NOT NULL,
	"organiserId" varchar(64) NOT NULL,
	"organiserName" varchar(255) NOT NULL,
	"contributionAmount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"frequency" varchar(16) NOT NULL,
	"maxMembers" integer NOT NULL,
	"currentCycle" integer DEFAULT 0,
	"totalCycles" integer DEFAULT 0,
	"status" varchar(32) DEFAULT 'forming' NOT NULL,
	"startDate" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "esusuGroups_groupId_unique" UNIQUE("groupId")
);
--> statement-breakpoint
CREATE TABLE "event_dedup_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic" varchar(100) NOT NULL,
	"windowMs" integer DEFAULT 0,
	"strategy" varchar(30) NOT NULL,
	"duplicatesBlocked24h" bigint DEFAULT 0,
	"totalEvents24h" bigint DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exportJobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"exportJobId" varchar(64) NOT NULL,
	"domainKey" varchar(96) NOT NULL,
	"title" varchar(191) NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"requestedByRole" varchar(64) NOT NULL,
	"route" varchar(191) NOT NULL,
	"rowCount" integer DEFAULT 0 NOT NULL,
	"approvalState" text NOT NULL,
	"approvalSignature" varchar(191) NOT NULL,
	"downloadUrl" varchar(255) NOT NULL,
	"retainedUntil" timestamp,
	"reportVersion" varchar(96),
	"approvalChain" jsonb NOT NULL,
	"signedBy" jsonb NOT NULL,
	CONSTRAINT "exportJobs_exportJobId_unique" UNIQUE("exportJobId")
);
--> statement-breakpoint
CREATE TABLE "face_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"embedding_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"embedding" jsonb NOT NULL,
	"embedding_norm" real DEFAULT 1,
	"model" text DEFAULT 'arcface_r100',
	"face_quality" real,
	"is_enrolled" boolean DEFAULT false,
	"purpose" text DEFAULT 'enrollment',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "face_embeddings_embedding_id_unique" UNIQUE("embedding_id")
);
--> statement-breakpoint
CREATE TABLE "face_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"customer_id" text NOT NULL,
	"matched" boolean NOT NULL,
	"similarity_score" real NOT NULL,
	"embedding_distance" real,
	"face1_quality" real,
	"face2_quality" real,
	"age_estimation" integer,
	"gender_estimation" text,
	"head_pose_diff" real,
	"glasses_detected" boolean DEFAULT false,
	"mask_detected" boolean DEFAULT false,
	"purpose" text DEFAULT 'kyc_onboarding',
	"processing_time_ms" real,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "face_matches_match_id_unique" UNIQUE("match_id")
);
--> statement-breakpoint
CREATE TABLE "facial_landmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"landmark_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"liveness_check_id" text,
	"landmark_count" integer DEFAULT 68,
	"landmarks" jsonb DEFAULT '[]',
	"face_quality" real,
	"inter_eye_distance" real,
	"face_area_ratio" real,
	"head_pose" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "facial_landmarks_landmark_id_unique" UNIQUE("landmark_id")
);
--> statement-breakpoint
CREATE TABLE "farm_boundary_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "farmers" (
	"id" serial PRIMARY KEY NOT NULL,
	"farmerId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"bvn" varchar(11) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"region" varchar(100) NOT NULL,
	"localGovernment" varchar(100) NOT NULL,
	"farmSizeHectares" double precision NOT NULL,
	"primaryCrop" varchar(100) NOT NULL,
	"secondaryCrops" jsonb NOT NULL,
	"cooperativeId" varchar(64),
	"cooperativeName" varchar(200),
	"bankAccountNumber" varchar(20),
	"riskScore" double precision NOT NULL,
	"riskTier" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"geoCoordinates" jsonb,
	"registrationChannel" varchar(50) DEFAULT 'platform' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "farmers_farmerId_unique" UNIQUE("farmerId")
);
--> statement-breakpoint
CREATE TABLE "fast_json_schemas" (
	"id" serial PRIMARY KEY NOT NULL,
	"schemaName" varchar(100) NOT NULL,
	"compiledSizeBytes" integer DEFAULT 0,
	"serializationsPerSec" integer DEFAULT 0,
	"avgSerializeNs" integer DEFAULT 0,
	"speedup" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fisheries_aquaculture" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fluvio_smart_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"moduleType" varchar(20) NOT NULL,
	"wasmSizeKB" integer DEFAULT 0,
	"avgLatencyUs" integer DEFAULT 0,
	"throughputEps" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "frame_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(200) NOT NULL,
	"frame_ancestors" varchar(100),
	"x_frame_options" varchar(20),
	"frame_detection" varchar(30),
	"violations_24h" integer DEFAULT 0,
	"unique_framers" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'enforced',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fxTrades" (
	"id" serial PRIMARY KEY NOT NULL,
	"tradeId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"buyCurrency" varchar(3) NOT NULL,
	"sellCurrency" varchar(3) NOT NULL,
	"buyAmount" double precision NOT NULL,
	"sellAmount" double precision NOT NULL,
	"exchangeRate" double precision NOT NULL,
	"tradeType" text NOT NULL,
	"counterparty" varchar(128),
	"valueDate" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"traderId" varchar(128),
	"approvedBy" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fxTrades_tradeId_unique" UNIQUE("tradeId")
);
--> statement-breakpoint
CREATE TABLE "glAccounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"glAccountCode" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"name" varchar(191) NOT NULL,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"parentCode" varchar(32),
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"isControlAccount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "glAccounts_glAccountCode_unique" UNIQUE("glAccountCode")
);
--> statement-breakpoint
CREATE TABLE "goaml_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reportType" varchar(10) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"amount" bigint DEFAULT 0,
	"nfiuAcknowledgement" varchar(50) NOT NULL,
	"xmlValidated" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "grid_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"grid_card_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"card_serial" text NOT NULL,
	"grid_size" text NOT NULL,
	"grid_values_encrypted" text,
	"status" text DEFAULT 'active' NOT NULL,
	"usage_count" integer DEFAULT 0,
	"branch_code" text,
	"issued_at" timestamp,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "grpc_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(100) NOT NULL,
	"proto" varchar(100) NOT NULL,
	"avgLatencyMs" real DEFAULT 0,
	"throughputRps" integer DEFAULT 0,
	"compressionRatio" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hot_data_caches" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(100) NOT NULL,
	"cacheType" varchar(20) NOT NULL,
	"maxEntries" integer DEFAULT 0,
	"currentEntries" integer DEFAULT 0,
	"hitRate" varchar(20) NOT NULL,
	"memoryMB" real DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hpa_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"deployment" varchar(100) NOT NULL,
	"minReplicas" integer DEFAULT 0,
	"maxReplicas" integer DEFAULT 0,
	"currentReplicas" integer DEFAULT 0,
	"cpuTargetPct" integer DEFAULT 0,
	"customMetric" varchar(200) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "http2_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientIp" varchar(45) NOT NULL,
	"streams" integer DEFAULT 0,
	"maxConcurrentStreams" integer DEFAULT 0,
	"windowSize" varchar(20) NOT NULL,
	"serverPushEnabled" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "identityProfiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"profileId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"customerName" varchar(255),
	"email" varchar(255),
	"phoneNumber" varchar(20) NOT NULL,
	"bvn" varchar(11),
	"nin" varchar(11),
	"mfaEnabled" integer DEFAULT 0,
	"mfaMethods" jsonb,
	"activeChannels" jsonb,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"lastLoginAt" timestamp,
	"failedAttempts" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "identityProfiles_profileId_unique" UNIQUE("profileId")
);
--> statement-breakpoint
CREATE TABLE "ijaraContracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"assetDescription" text NOT NULL,
	"assetCategory" varchar(50) NOT NULL,
	"assetValue" double precision NOT NULL,
	"rentalAmount" double precision NOT NULL,
	"rentalFrequency" varchar(20) DEFAULT 'monthly' NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"leaseStart" varchar(20) NOT NULL,
	"leaseEnd" varchar(20) NOT NULL,
	"tenorMonths" integer NOT NULL,
	"residualValue" double precision NOT NULL,
	"purchaseOption" integer DEFAULT 1 NOT NULL,
	"purchasePrice" double precision,
	"totalRentPaid" double precision DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'active' NOT NULL,
	"shariaCompliance" varchar(30) NOT NULL,
	"maintenanceResponsibility" varchar(20) DEFAULT 'lessor' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ijaraContracts_contractId_unique" UNIQUE("contractId")
);
--> statement-breakpoint
CREATE TABLE "image_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_name" text NOT NULL,
	"registry" varchar(100),
	"base_image" varchar(100),
	"total_vulns" integer DEFAULT 0,
	"critical" integer DEFAULT 0,
	"high" integer DEFAULT 0,
	"medium" integer DEFAULT 0,
	"low" integer DEFAULT 0,
	"sbom_artifacts" integer DEFAULT 0,
	"last_scanned" timestamp,
	"status" varchar(30) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "immutable_audit_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"block_number" bigint NOT NULL,
	"previous_hash" varchar(64),
	"merkle_root" varchar(64),
	"transactions" integer DEFAULT 0,
	"validator" varchar(50),
	"anchored_to_chain" varchar(50),
	"anchor_tx_hash" text,
	"verified" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"severity" varchar(20),
	"category" varchar(50),
	"affected_systems" jsonb,
	"containment_actions" jsonb,
	"escalation_level" integer DEFAULT 1,
	"assignee" varchar(100),
	"detected_at" timestamp,
	"contained_at" timestamp,
	"ttd_minutes" integer,
	"ttc_minutes" integer,
	"status" varchar(30) DEFAULT 'open',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insurance_portfolio_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interactive_ussd_agri" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investment_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant-lagos-main' NOT NULL,
	"customer_id" text NOT NULL,
	"product_type" text NOT NULL,
	"product_name" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'NGN',
	"expected_return" real,
	"tenor" integer,
	"maturity_date" timestamp,
	"current_value" real,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ip_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"cidr" varchar(50),
	"rule_type" varchar(20),
	"applies_to" varchar(50),
	"hits_24h" integer DEFAULT 0,
	"blocked_24h" integer DEFAULT 0,
	"geo_country" varchar(10),
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journalEntries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entryId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"accountId" varchar(64) NOT NULL,
	"glAccountCode" varchar(32) NOT NULL,
	"type" text NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"narration" text NOT NULL,
	"transactionRef" varchar(128) NOT NULL,
	"batchId" varchar(64),
	"reversalOf" varchar(64),
	"postingDate" timestamp DEFAULT now() NOT NULL,
	"valueDate" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "journalEntries_entryId_unique" UNIQUE("entryId")
);
--> statement-breakpoint
CREATE TABLE "jwt_validations" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_type" varchar(50) NOT NULL,
	"issuer" text NOT NULL,
	"audience" varchar(100),
	"algorithm" varchar(20),
	"validations_24h" bigint DEFAULT 0,
	"rejections_24h" integer DEFAULT 0,
	"avg_latency_ms" real,
	"cache_hit_rate" real,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kafka_batch_producers" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic" varchar(100) NOT NULL,
	"lingerMs" integer DEFAULT 0,
	"batchSizeKB" integer DEFAULT 0,
	"compressionType" varchar(20) NOT NULL,
	"throughputMps" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kafka_consumer_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"groupId" varchar(100) NOT NULL,
	"topic" varchar(100) NOT NULL,
	"partitions" integer DEFAULT 0,
	"consumers" integer DEFAULT 0,
	"lag" bigint DEFAULT 0,
	"throughputMps" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "keda_scale_triggers" (
	"id" serial PRIMARY KEY NOT NULL,
	"scaleObject" varchar(100) NOT NULL,
	"trigger" varchar(30) NOT NULL,
	"metric" varchar(50) NOT NULL,
	"threshold" integer DEFAULT 0,
	"currentReplicas" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "keepalive_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(100) NOT NULL,
	"keepAliveTimeout" integer DEFAULT 0,
	"maxIdlePerHost" integer DEFAULT 0,
	"activeConnections" integer DEFAULT 0,
	"reuseRate" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "key_rotation_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"key_id" varchar(100) NOT NULL,
	"algorithm" varchar(30),
	"rotation_interval" varchar(20),
	"grace_period" varchar(20),
	"active_version" integer DEFAULT 1,
	"previous_version" integer,
	"next_rotation" timestamp,
	"rotations_completed" integer DEFAULT 0,
	"failed_rotations" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'scheduled',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kms_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(20) NOT NULL,
	"key_id" text NOT NULL,
	"algorithm" varchar(30),
	"usage" varchar(30),
	"state" varchar(20),
	"rotation_enabled" boolean DEFAULT true,
	"encryption_ops_24h" bigint DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar(20) NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"lga" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"revenue_ngn" bigint DEFAULT 0,
	"transactions_daily" integer DEFAULT 0,
	"customers" integer DEFAULT 0,
	"npl_pct" double precision DEFAULT 0,
	"deposits_ngn" bigint DEFAULT 0,
	"status" varchar(10) DEFAULT 'green' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kpi_branches_branch_id_unique" UNIQUE("branch_id")
);
--> statement-breakpoint
CREATE TABLE "kpi_composite_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_key" varchar(50) NOT NULL,
	"personnel_id" varchar(50),
	"own_score" double precision NOT NULL,
	"rollup_score" double precision,
	"composite_score" double precision NOT NULL,
	"status" varchar(10) DEFAULT 'green' NOT NULL,
	"cadence" varchar(20) DEFAULT 'daily' NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"variable_pay_multiplier" double precision DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_hierarchy" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_role_key" varchar(50) NOT NULL,
	"child_role_key" varchar(50) NOT NULL,
	"rollup_weight" double precision DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_key" varchar(80) NOT NULL,
	"role_key" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"unit" text DEFAULT 'percent' NOT NULL,
	"direction" text DEFAULT 'higher_better' NOT NULL,
	"weight" double precision DEFAULT 0.1 NOT NULL,
	"green_threshold" double precision DEFAULT 85 NOT NULL,
	"amber_threshold" double precision DEFAULT 60 NOT NULL,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"data_source" text,
	"sql_query" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kpi_metrics_metric_key_unique" UNIQUE("metric_key")
);
--> statement-breakpoint
CREATE TABLE "kpi_notification_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_key" varchar(50) NOT NULL,
	"role_key" varchar(50) NOT NULL,
	"metric_key" varchar(80) NOT NULL,
	"current_value" double precision NOT NULL,
	"threshold_value" double precision NOT NULL,
	"severity" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'fired' NOT NULL,
	"message" text,
	"fired_at" timestamp DEFAULT now(),
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"acknowledged_by" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "kpi_notification_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_key" varchar(50) NOT NULL,
	"role_key" varchar(50) NOT NULL,
	"metric_key" varchar(80) NOT NULL,
	"condition" varchar(10) NOT NULL,
	"threshold_value" double precision NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"channels" jsonb NOT NULL,
	"escalation_chain" jsonb,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kpi_notification_rules_rule_key_unique" UNIQUE("rule_key")
);
--> statement-breakpoint
CREATE TABLE "kpi_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_key" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"department" text NOT NULL,
	"level" integer DEFAULT 2 NOT NULL,
	"reports_to" varchar(50),
	"fixed_ratio" integer DEFAULT 70,
	"variable_ratio" integer DEFAULT 30,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kpi_roles_role_key_unique" UNIQUE("role_key")
);
--> statement-breakpoint
CREATE TABLE "kpi_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_key" varchar(80) NOT NULL,
	"role_key" varchar(50) NOT NULL,
	"personnel_id" varchar(50),
	"value" double precision NOT NULL,
	"normalized_score" double precision NOT NULL,
	"status" varchar(10) DEFAULT 'green' NOT NULL,
	"cadence" varchar(20) DEFAULT 'daily' NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyb_enforcement_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"verification_id" text NOT NULL,
	"company_id" text NOT NULL,
	"rc_number" text,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"level" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"cac_verified" boolean DEFAULT false,
	"tin_verified" boolean DEFAULT false,
	"ubo_verified" boolean DEFAULT false,
	"director_screened" boolean DEFAULT false,
	"sanctions_cleared" boolean DEFAULT false,
	"verified_by" text,
	"verified_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kyb_enforcement_verifications_verification_id_unique" UNIQUE("verification_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_data_quality_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"total_customers" integer NOT NULL,
	"kyc_complete" integer NOT NULL,
	"kyc_complete_pct" double precision,
	"expired_documents" integer DEFAULT 0 NOT NULL,
	"duplicate_bvn" integer DEFAULT 0 NOT NULL,
	"missing_nin" integer DEFAULT 0 NOT NULL,
	"snapshot_date" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_enforcement_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"service_id" text NOT NULL,
	"path" text NOT NULL,
	"method" text NOT NULL,
	"customer_id" text,
	"company_id" text,
	"decision" text NOT NULL,
	"reason" text,
	"kyc_level" text,
	"required_level" text,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kyc_enforcement_log_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_enforcement_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"verification_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"level" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"bvn_verified" boolean DEFAULT false,
	"nin_verified" boolean DEFAULT false,
	"liveness_verified" boolean DEFAULT false,
	"documents_verified" boolean DEFAULT false,
	"sanctions_cleared" boolean DEFAULT false,
	"risk_score" integer,
	"assigned_tier" text,
	"verified_by" text,
	"verified_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kyc_enforcement_verifications_verification_id_unique" UNIQUE("verification_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_event_triggers" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger_id" text NOT NULL,
	"event_topic" text NOT NULL,
	"event_name" text NOT NULL,
	"customer_id" text,
	"company_id" text,
	"kyc_level" text NOT NULL,
	"kyb_required" boolean DEFAULT false,
	"status" text DEFAULT 'triggered' NOT NULL,
	"trigger_source" text,
	"integrated_services" jsonb,
	"event_data" jsonb,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"triggered_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "kyc_event_triggers_trigger_id_unique" UNIQUE("trigger_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_tier_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"previous_tier" integer NOT NULL,
	"new_tier" integer NOT NULL,
	"reason" text,
	"changed_by" varchar(64),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"customer_name" text NOT NULL,
	"current_tier" integer DEFAULT 1 NOT NULL,
	"daily_limit_ngn" double precision DEFAULT 300000 NOT NULL,
	"daily_used_ngn" double precision DEFAULT 0 NOT NULL,
	"evaluation_score" double precision,
	"risk_flags" jsonb,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"last_evaluated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kycVerifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"verificationId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"verificationType" text NOT NULL,
	"documentReference" varchar(128),
	"provider" varchar(64) NOT NULL,
	"providerResponse" jsonb,
	"matchScore" double precision,
	"status" text DEFAULT 'pending' NOT NULL,
	"verifiedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kycVerifications_verificationId_unique" UNIQUE("verificationId")
);
--> statement-breakpoint
CREATE TABLE "lendingGroups" (
	"id" serial PRIMARY KEY NOT NULL,
	"groupId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"name" varchar(255) NOT NULL,
	"purpose" text,
	"groupLeaderId" varchar(64) NOT NULL,
	"groupLeaderName" varchar(255),
	"maxMembers" integer NOT NULL,
	"liabilityType" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'forming' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lendingGroups_groupId_unique" UNIQUE("groupId")
);
--> statement-breakpoint
CREATE TABLE "lettersOfCredit" (
	"id" serial PRIMARY KEY NOT NULL,
	"lcId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"lcType" varchar(30) DEFAULT 'irrevocable' NOT NULL,
	"applicantId" varchar(64) NOT NULL,
	"applicantName" varchar(200) NOT NULL,
	"beneficiaryName" varchar(200) NOT NULL,
	"beneficiaryBank" varchar(200),
	"beneficiaryCountry" varchar(100),
	"issuingBank" varchar(200) DEFAULT '54Bank' NOT NULL,
	"advisingBank" varchar(200),
	"amount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"commodity" varchar(200),
	"incoterm" varchar(10),
	"portOfLoading" varchar(200),
	"portOfDischarge" varchar(200),
	"latestShipDate" varchar(20),
	"expiryDate" varchar(20) NOT NULL,
	"documentsRequired" jsonb NOT NULL,
	"amendments" jsonb NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lettersOfCredit_lcId_unique" UNIQUE("lcId")
);
--> statement-breakpoint
CREATE TABLE "liveness_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"customer_id" text NOT NULL,
	"session_id" text NOT NULL,
	"mode" text DEFAULT 'hybrid' NOT NULL,
	"is_live" boolean NOT NULL,
	"overall_score" real NOT NULL,
	"confidence_score" real NOT NULL,
	"verdict" text NOT NULL,
	"method_scores" jsonb DEFAULT '{}',
	"deepfake_probability" real DEFAULT 0,
	"face_detected" boolean DEFAULT true,
	"face_quality" real DEFAULT 0,
	"head_pose_yaw" real DEFAULT 0,
	"head_pose_pitch" real DEFAULT 0,
	"head_pose_roll" real DEFAULT 0,
	"device_platform" text,
	"device_model" text,
	"ip_address" text,
	"challenge_type" text,
	"challenges_passed" integer DEFAULT 0,
	"challenges_total" integer DEFAULT 0,
	"processing_time_ms" real,
	"kafka_event_id" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "liveness_checks_check_id_unique" UNIQUE("check_id")
);
--> statement-breakpoint
CREATE TABLE "liveness_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"session_id" text,
	"customer_id" text NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"payload" jsonb DEFAULT '{}',
	"kafka_topic" text,
	"kafka_partition" integer DEFAULT 0,
	"kafka_offset" bigint,
	"published_at" timestamp DEFAULT now(),
	CONSTRAINT "liveness_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "livestock_finance" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "livestock_insurance" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "livestock_management" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loanRepayments" (
	"id" serial PRIMARY KEY NOT NULL,
	"repaymentId" varchar(64) NOT NULL,
	"loanId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"principalPortion" double precision NOT NULL,
	"interestPortion" double precision NOT NULL,
	"penaltyPortion" double precision DEFAULT 0 NOT NULL,
	"totalAmount" double precision NOT NULL,
	"dueDate" timestamp NOT NULL,
	"paidDate" timestamp,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"transactionRef" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loanRepayments_repaymentId_unique" UNIQUE("repaymentId")
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"loanType" text NOT NULL,
	"principalAmount" double precision NOT NULL,
	"outstandingBalance" double precision NOT NULL,
	"interestRate" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"tenor" integer NOT NULL,
	"tenorUnit" text DEFAULT 'months' NOT NULL,
	"disbursementDate" timestamp,
	"maturityDate" timestamp,
	"nextPaymentDate" timestamp,
	"nextPaymentAmount" double precision,
	"status" text DEFAULT 'pending' NOT NULL,
	"classificationIFRS9" text DEFAULT 'stage1',
	"collateralValue" double precision,
	"approvedBy" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loans_loanId_unique" UNIQUE("loanId")
);
--> statement-breakpoint
CREATE TABLE "materialized_views_perf" (
	"id" serial PRIMARY KEY NOT NULL,
	"viewName" varchar(100) NOT NULL,
	"refreshIntervalSec" integer DEFAULT 0,
	"lastRefreshMs" integer DEFAULT 0,
	"rowCount" integer DEFAULT 0,
	"autoRefresh" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memoization_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"component" varchar(100) NOT NULL,
	"rerendersPer60s" integer DEFAULT 0,
	"estimatedSavingPct" varchar(10) NOT NULL,
	"recommendation" varchar(200) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mfa_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"methods" text NOT NULL,
	"primary_method" text,
	"backup_method" text,
	"status" text DEFAULT 'enrolled' NOT NULL,
	"risk_level" text,
	"channel" text,
	"enrolled_at" timestamp DEFAULT now(),
	"last_verified" timestamp
);
--> statement-breakpoint
CREATE TABLE "mfa_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_id" text NOT NULL,
	"name" text NOT NULL,
	"transaction_type" text,
	"amount_threshold_ngn" real DEFAULT 0,
	"required_factors" integer DEFAULT 1,
	"allowed_methods" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mortgageApplications" (
	"id" serial PRIMARY KEY NOT NULL,
	"mortgageId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"applicantId" varchar(64) NOT NULL,
	"applicantName" varchar(255) NOT NULL,
	"propertyValue" double precision NOT NULL,
	"loanAmount" double precision NOT NULL,
	"downPayment" double precision NOT NULL,
	"interestRatePct" double precision NOT NULL,
	"tenorMonths" integer NOT NULL,
	"mortgageType" varchar(32) NOT NULL,
	"emi" double precision NOT NULL,
	"ltvPct" double precision NOT NULL,
	"ltvGrade" varchar(2) NOT NULL,
	"dtiRatio" double precision NOT NULL,
	"propertyAddress" text,
	"propertyType" varchar(32),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"disbursedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mortgageApplications_mortgageId_unique" UNIQUE("mortgageId")
);
--> statement-breakpoint
CREATE TABLE "mtls_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_name" varchar(100) NOT NULL,
	"spiffe_id" text,
	"cert_serial" varchar(50),
	"cert_expiry" timestamp,
	"issuer" varchar(100),
	"peer_connections" integer DEFAULT 0,
	"handshakes_24h" bigint DEFAULT 0,
	"failed_handshakes" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mudarabahContracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"investorId" varchar(64) NOT NULL,
	"investorName" varchar(200) NOT NULL,
	"fundManagerId" varchar(64) NOT NULL,
	"investmentPurpose" text NOT NULL,
	"capitalAmount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"profitSharingRatioInvestor" double precision NOT NULL,
	"profitSharingRatioManager" double precision NOT NULL,
	"investmentPeriodMonths" integer NOT NULL,
	"startDate" varchar(20) NOT NULL,
	"maturityDate" varchar(20) NOT NULL,
	"realizedProfit" double precision DEFAULT 0 NOT NULL,
	"realizedLoss" double precision DEFAULT 0 NOT NULL,
	"distributions" jsonb NOT NULL,
	"status" varchar(30) DEFAULT 'active' NOT NULL,
	"shariaCompliance" varchar(30) NOT NULL,
	"riskCategory" varchar(30) DEFAULT 'moderate' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mudarabahContracts_contractId_unique" UNIQUE("contractId")
);
--> statement-breakpoint
CREATE TABLE "multi_peril_crop_insurance" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "murabahaContracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"assetDescription" text NOT NULL,
	"assetCategory" varchar(50) NOT NULL,
	"costPrice" double precision NOT NULL,
	"profitMarginPct" double precision NOT NULL,
	"sellingPrice" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"tenorMonths" integer NOT NULL,
	"instalmentAmount" double precision NOT NULL,
	"totalPaid" double precision DEFAULT 0 NOT NULL,
	"outstandingBalance" double precision NOT NULL,
	"disbursementDate" varchar(30),
	"maturityDate" varchar(30),
	"status" varchar(30) DEFAULT 'pending_sharia_review' NOT NULL,
	"shariaCompliance" varchar(30) NOT NULL,
	"shariaBoardReference" text,
	"instalmentSchedule" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "murabahaContracts_contractId_unique" UNIQUE("contractId")
);
--> statement-breakpoint
CREATE TABLE "ndpr_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_type" varchar(50) NOT NULL,
	"subject" varchar(100),
	"request_type" varchar(50),
	"response_time_days" integer,
	"sla_deadline_days" integer,
	"data_categories" jsonb,
	"dpo" varchar(100),
	"status" varchar(30) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "network_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"namespace" varchar(100),
	"pod_selector" text,
	"ingress_rules" jsonb,
	"egress_rules" jsonb,
	"applied_pods" integer DEFAULT 0,
	"denied_connections_24h" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'enforced',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nfiu_filings" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_type" varchar(8) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"customer_name" text,
	"amount_ngn" double precision NOT NULL,
	"transaction_type" varchar(64),
	"status" varchar(32) DEFAULT 'pending_review' NOT NULL,
	"cbn_reference" varchar(64),
	"sla_deadline" timestamp,
	"filed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nipTransactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"nipId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"sessionId" varchar(64) NOT NULL,
	"direction" text NOT NULL,
	"sourceBank" varchar(8) NOT NULL,
	"destinationBank" varchar(8) NOT NULL,
	"sourceAccount" varchar(20) NOT NULL,
	"destinationAccount" varchar(20) NOT NULL,
	"amount" double precision NOT NULL,
	"narration" text NOT NULL,
	"responseCode" varchar(4),
	"status" text DEFAULT 'pending' NOT NULL,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nipTransactions_nipId_unique" UNIQUE("nipId"),
	CONSTRAINT "nipTransactions_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "nirsal_agro_geocoop" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nirsal_credit_guarantee" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nostroAccounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"nostroId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"correspondentBank" varchar(191) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"accountNumber" varchar(64) NOT NULL,
	"swiftCode" varchar(11) NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"lastReconciledAt" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nostroAccounts_nostroId_unique" UNIQUE("nostroId")
);
--> statement-breakpoint
CREATE TABLE "opensearch_index_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"indexName" varchar(100) NOT NULL,
	"shards" integer DEFAULT 0,
	"replicas" integer DEFAULT 0,
	"avgQueryMs" real DEFAULT 0,
	"resultCacheEnabled" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "operatorActions" (
	"id" serial PRIMARY KEY NOT NULL,
	"actionId" varchar(64) NOT NULL,
	"domainKey" varchar(96) NOT NULL,
	"title" varchar(191) NOT NULL,
	"detail" text NOT NULL,
	"owner" varchar(128) NOT NULL,
	"dueAt" timestamp NOT NULL,
	"route" varchar(191) NOT NULL,
	"status" text NOT NULL,
	"roles" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "operatorActions_actionId_unique" UNIQUE("actionId")
);
--> statement-breakpoint
CREATE TABLE "optimistic_ui_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(50) NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"rollbackOnError" boolean DEFAULT false,
	"successRate" varchar(10) NOT NULL,
	"perceivedLatencyMs" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "otp_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"otp_id" text NOT NULL,
	"policy_id" text,
	"customer_id" text NOT NULL,
	"channel" text,
	"purpose" text,
	"otp_hash" text,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0,
	"delivered_via" text,
	"expires_at" timestamp,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "output_encoding_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"context" varchar(50) NOT NULL,
	"encoder" varchar(100),
	"chars_encoded" jsonb,
	"applied_24h" bigint DEFAULT 0,
	"xss_blocked" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "parametric_insurance_iot" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partnerApprovalRecords" (
	"id" serial PRIMARY KEY NOT NULL,
	"approvalId" varchar(64) NOT NULL,
	"partnerId" varchar(64) NOT NULL,
	"stage" text NOT NULL,
	"title" varchar(191) NOT NULL,
	"detail" text NOT NULL,
	"state" text NOT NULL,
	"requiredRole" text NOT NULL,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"requestedById" varchar(96) NOT NULL,
	"resolvedAt" timestamp,
	"resolutionNote" text,
	CONSTRAINT "partnerApprovalRecords_approvalId_unique" UNIQUE("approvalId")
);
--> statement-breakpoint
CREATE TABLE "partnerOnboardingRecords" (
	"id" serial PRIMARY KEY NOT NULL,
	"partnerId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"partnerName" varchar(191) NOT NULL,
	"legalEntity" varchar(191) NOT NULL,
	"partnerType" text NOT NULL,
	"region" varchar(96) NOT NULL,
	"stage" text NOT NULL,
	"requestedModules" jsonb NOT NULL,
	"primaryContact" jsonb NOT NULL,
	"operationsContact" jsonb NOT NULL,
	"commercial" jsonb NOT NULL,
	"compliance" jsonb NOT NULL,
	"branding" jsonb NOT NULL,
	"checklist" jsonb NOT NULL,
	"blockers" jsonb NOT NULL,
	"readinessScore" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"submittedAt" timestamp,
	"launchedAt" timestamp,
	"lastSubmittedBy" varchar(96),
	CONSTRAINT "partnerOnboardingRecords_partnerId_unique" UNIQUE("partnerId")
);
--> statement-breakpoint
CREATE TABLE "path_validation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern" varchar(100) NOT NULL,
	"regex" text,
	"blocked_24h" integer DEFAULT 0,
	"passed_24h" bigint DEFAULT 0,
	"common_violations" jsonb,
	"status" varchar(30) DEFAULT 'enforced',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pci_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement" text NOT NULL,
	"total_controls" integer DEFAULT 0,
	"passing" integer DEFAULT 0,
	"failing" integer DEFAULT 0,
	"findings" jsonb,
	"last_scan" timestamp,
	"scan_duration" varchar(20),
	"status" varchar(30) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pentest_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"scope" varchar(50),
	"scan_type" varchar(30),
	"target" text,
	"total_findings" integer DEFAULT 0,
	"critical" integer DEFAULT 0,
	"high" integer DEFAULT 0,
	"medium" integer DEFAULT 0,
	"low" integer DEFAULT 0,
	"remediated" integer DEFAULT 0,
	"vendor" varchar(100),
	"status" varchar(30) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pgbouncer_pools" (
	"id" serial PRIMARY KEY NOT NULL,
	"database" varchar(100) NOT NULL,
	"poolMode" varchar(30) NOT NULL,
	"activeConnections" integer DEFAULT 0,
	"idleConnections" integer DEFAULT 0,
	"maxClientConn" integer DEFAULT 0,
	"avgQueryMs" real DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pin_hashes" (
	"id" serial PRIMARY KEY NOT NULL,
	"algorithm" varchar(30) NOT NULL,
	"memory_cost" integer,
	"time_cost" integer,
	"parallelism" integer,
	"salt_length" integer,
	"hash_length" integer,
	"active_hashes" bigint DEFAULT 0,
	"migrated_from_bcrypt" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pin_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"verification_id" text NOT NULL,
	"card_id" text NOT NULL,
	"serial_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"transaction_id" text,
	"channel" text,
	"result" text NOT NULL,
	"ip_address" text,
	"device_id" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pkce_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" varchar(100) NOT NULL,
	"grant_type" varchar(50),
	"code_challenge_method" varchar(10),
	"redirect_uri" text,
	"scopes" jsonb,
	"token_lifetime" integer,
	"refresh_lifetime" integer,
	"active_flows" bigint DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_harvest_loss_tracker" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prepared_statements" (
	"id" serial PRIMARY KEY NOT NULL,
	"queryPattern" text NOT NULL,
	"executions24h" bigint DEFAULT 0,
	"avgExecMs" real DEFAULT 0,
	"planCacheHits" varchar(20) NOT NULL,
	"paramTypes" varchar(200) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prometheus_dashboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"dashboard" varchar(100) NOT NULL,
	"panels" integer DEFAULT 0,
	"refreshInterval" varchar(10) NOT NULL,
	"alertRules" integer DEFAULT 0,
	"dataSourceRetention" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qr_payment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant-lagos-main' NOT NULL,
	"merchant_name" text NOT NULL,
	"merchant_id" text NOT NULL,
	"amount" real NOT NULL,
	"qr_type" text NOT NULL,
	"channel" text DEFAULT 'NQR',
	"customer_account" text,
	"settlement_time" text DEFAULT 'T+0',
	"fee" real DEFAULT 0,
	"status" text DEFAULT 'completed',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quality_certification" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "query_cache_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"queryHash" varchar(64) NOT NULL,
	"tableName" varchar(100) NOT NULL,
	"resultCount" integer DEFAULT 0,
	"ttlSeconds" integer DEFAULT 0,
	"hitCount" bigint DEFAULT 0,
	"hitRate" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "read_replica_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"replicaHost" varchar(100) NOT NULL,
	"lagMs" integer DEFAULT 0,
	"queriesRouted24h" bigint DEFAULT 0,
	"loadPct" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reconciliationRuns" (
	"id" serial PRIMARY KEY NOT NULL,
	"runId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"runType" varchar(16) NOT NULL,
	"scope" varchar(32) NOT NULL,
	"status" varchar(48) NOT NULL,
	"totalEntriesChecked" integer DEFAULT 0,
	"matches" integer DEFAULT 0,
	"discrepancies" integer DEFAULT 0,
	"autoRepaired" integer DEFAULT 0,
	"manualTriage" integer DEFAULT 0,
	"durationMs" integer,
	"startTime" timestamp,
	"endTime" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliationRuns_runId_unique" UNIQUE("runId")
);
--> statement-breakpoint
CREATE TABLE "redis_cache_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"route" varchar(100) NOT NULL,
	"ttlSeconds" integer DEFAULT 0,
	"hitCount" bigint DEFAULT 0,
	"missCount" integer DEFAULT 0,
	"hitRate" varchar(20) NOT NULL,
	"avgLatencyMs" real DEFAULT 0,
	"memoryMB" real DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "redis_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(100) NOT NULL,
	"userId" varchar(50) NOT NULL,
	"deviceType" varchar(30) NOT NULL,
	"ipAddress" varchar(45) NOT NULL,
	"expiresIn" varchar(20) NOT NULL,
	"slidingTTL" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regulatoryReports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reportId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"reportType" varchar(48) NOT NULL,
	"period" varchar(10) NOT NULL,
	"status" varchar(16) DEFAULT 'generated' NOT NULL,
	"submittedTo" varchar(16),
	"submittedAt" timestamp,
	"data" jsonb,
	"summary" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "regulatoryReports_reportId_unique" UNIQUE("reportId")
);
--> statement-breakpoint
CREATE TABLE "remittance_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant-lagos-main' NOT NULL,
	"corridor" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_country" text NOT NULL,
	"receiver_name" text NOT NULL,
	"receiver_country" text DEFAULT 'NG',
	"send_amount" real NOT NULL,
	"send_currency" text NOT NULL,
	"receive_amount" real NOT NULL,
	"receive_currency" text DEFAULT 'NGN',
	"fx_rate" real NOT NULL,
	"fee" real DEFAULT 0,
	"partner" text NOT NULL,
	"status" text DEFAULT 'completed',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rewards_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant-lagos-main' NOT NULL,
	"customer_id" text NOT NULL,
	"tier" text DEFAULT 'Bronze',
	"total_points" integer DEFAULT 0,
	"available_points" integer DEFAULT 0,
	"lifetime_points" integer DEFAULT 0,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"badges" text DEFAULT '[]',
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"static_score" double precision DEFAULT 0 NOT NULL,
	"dynamic_score" double precision DEFAULT 0 NOT NULL,
	"total_score" double precision DEFAULT 0 NOT NULL,
	"risk_tier" varchar(16) DEFAULT 'low' NOT NULL,
	"factors" jsonb,
	"last_calculated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_schemas" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"method" varchar(10) NOT NULL,
	"schema_name" varchar(100),
	"validation_count" integer DEFAULT 0,
	"pass_rate" real,
	"failed_requests" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_trie_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"routePrefix" varchar(200) NOT NULL,
	"totalRoutes" integer DEFAULT 0,
	"trieDepth" integer DEFAULT 0,
	"avgLookupNs" integer DEFAULT 0,
	"cacheHitRate" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sanctions_batch_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"triggerType" varchar(30) NOT NULL,
	"customersScreened" integer DEFAULT 0,
	"newMatches" integer DEFAULT 0,
	"processingTimeMin" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sanctions_screenings" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_name" text NOT NULL,
	"entity_type" varchar(32) DEFAULT 'individual' NOT NULL,
	"lists_checked" jsonb,
	"match_found" integer DEFAULT 0 NOT NULL,
	"highest_score" double precision,
	"match_details" jsonb,
	"status" varchar(32) DEFAULT 'clear' NOT NULL,
	"screened_by" varchar(64),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sar_reports_aml" (
	"id" serial PRIMARY KEY NOT NULL,
	"customerId" varchar(50) NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"reportType" varchar(10) NOT NULL,
	"reason" text NOT NULL,
	"amount" bigint DEFAULT 0,
	"currency" varchar(5) NOT NULL,
	"nfiuReference" varchar(50) NOT NULL,
	"priority" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "satellite_crop_monitor" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scratch_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"serial_number" text NOT NULL,
	"card_type" text NOT NULL,
	"pin_hash" text,
	"pin_length" integer,
	"status" text DEFAULT 'generated' NOT NULL,
	"max_attempts" integer DEFAULT 3,
	"used_attempts" integer DEFAULT 0,
	"value" real,
	"currency" text,
	"issued_to" text,
	"customer_id" text,
	"branch_code" text,
	"expires_at" timestamp,
	"activated_at" timestamp,
	"used_at" timestamp,
	"revoked_at" timestamp,
	"revoke_reason" text,
	"tamper_detected" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"sub_type" text,
	"actor" text,
	"channel" text,
	"ip_address" text,
	"geo_location" text,
	"details" text,
	"risk_score" real,
	"severity" text,
	"hash_chain" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"channel" text,
	"device_fingerprint" text,
	"ip_address" text,
	"geo_location" text,
	"status" text NOT NULL,
	"mfa_level" text,
	"risk_score" real,
	"last_activity" timestamp,
	"expires_at" timestamp,
	"terminated_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlementId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"windowId" varchar(64) NOT NULL,
	"model" text NOT NULL,
	"corridor" varchar(64),
	"totalDebits" double precision NOT NULL,
	"totalCredits" double precision NOT NULL,
	"netPosition" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"participantCount" integer NOT NULL,
	"transferCount" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"openedAt" timestamp DEFAULT now() NOT NULL,
	"closedAt" timestamp,
	"settledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_settlementId_unique" UNIQUE("settlementId")
);
--> statement-breakpoint
CREATE TABLE "siem_pipelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"format" varchar(30),
	"destination" text,
	"events_exported_24h" bigint DEFAULT 0,
	"avg_latency_ms" real,
	"error_rate" real,
	"batch_size" integer,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "smart_savings_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant-lagos-main' NOT NULL,
	"customer_id" text NOT NULL,
	"goal_name" text NOT NULL,
	"goal_type" text NOT NULL,
	"target_amount" real NOT NULL,
	"current_amount" real DEFAULT 0,
	"currency" text DEFAULT 'NGN',
	"auto_debit_amount" real,
	"frequency" text DEFAULT 'monthly',
	"start_date" timestamp DEFAULT now(),
	"target_date" timestamp,
	"interest_rate" real DEFAULT 12,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_alert_notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_banking_gateway" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_otp_service" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "soc2_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"control_id" varchar(20) NOT NULL,
	"category" varchar(50),
	"title" text,
	"evidence_type" varchar(50),
	"result" varchar(20),
	"period" varchar(20),
	"artifacts" jsonb,
	"auditor" varchar(100),
	"status" varchar(30) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "soil_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sorted_set_rankings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"members" integer DEFAULT 0,
	"topScore" real DEFAULT 0,
	"updateFrequency" varchar(30) NOT NULL,
	"queryLatencyMs" real DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sql_queries" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_query" text NOT NULL,
	"parameterized" boolean DEFAULT false,
	"parameter_count" integer DEFAULT 0,
	"execution_count" bigint DEFAULT 0,
	"avg_latency_ms" real,
	"injection_attempts" integer DEFAULT 0,
	"blocked" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'safe',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sri_hashes" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"algorithm" varchar(10),
	"hash" text,
	"last_verified" timestamp,
	"violations" integer DEFAULT 0,
	"cdn_provider" varchar(50),
	"status" varchar(30) DEFAULT 'valid',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stream_response_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"thresholdBytes" integer DEFAULT 0,
	"chunksizeKB" integer DEFAULT 0,
	"bytesStreamed24h" varchar(20) NOT NULL,
	"memoryReductionPct" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sw_cache_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern" varchar(200) NOT NULL,
	"strategy" varchar(50) NOT NULL,
	"maxAge" integer DEFAULT 0,
	"cacheHitRate" varchar(20) NOT NULL,
	"offlineCapable" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "swiftMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"messageType" varchar(8) NOT NULL,
	"direction" text NOT NULL,
	"senderBic" varchar(11) NOT NULL,
	"receiverBic" varchar(11) NOT NULL,
	"amount" double precision,
	"currency" varchar(3),
	"valueDate" timestamp,
	"rawMessage" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"relatedTransferId" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "swiftMessages_messageId_unique" UNIQUE("messageId")
);
--> statement-breakpoint
CREATE TABLE "table_partitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tableName" varchar(100) NOT NULL,
	"partitionKey" varchar(50) NOT NULL,
	"partitionType" varchar(30) NOT NULL,
	"activePartitions" integer DEFAULT 0,
	"rowsPerPartition" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tb_batch_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"batchSize" integer DEFAULT 0,
	"avgBatchLatencyMs" real DEFAULT 0,
	"throughputTps" integer DEFAULT 0,
	"transfersProcessed24h" bigint DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "telegram_banking_commands" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "telegram_bot_gateway" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "telegram_kyc_bot" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "telegram_mini_app" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "telegram_notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tellerSessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"tellerId" varchar(64) NOT NULL,
	"tellerName" varchar(200) NOT NULL,
	"branchCode" varchar(20) NOT NULL,
	"branchName" varchar(200) NOT NULL,
	"windowNumber" integer NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"openedAt" varchar(30) NOT NULL,
	"closedAt" varchar(30),
	"openingBalance" double precision NOT NULL,
	"currentBalance" double precision NOT NULL,
	"transactionCount" integer DEFAULT 0 NOT NULL,
	"cashDrawer" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tellerSessions_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "tellerTransactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"txnId" varchar(32) NOT NULL,
	"sessionId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"txnType" varchar(30) NOT NULL,
	"customerId" varchar(64) NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"reference" varchar(100),
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"processedAt" varchar(30) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tellerTransactions_txnId_unique" UNIQUE("txnId")
);
--> statement-breakpoint
CREATE TABLE "temporal_memoized_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow" varchar(100) NOT NULL,
	"activity" varchar(100) NOT NULL,
	"replaySpeedup" varchar(10) NOT NULL,
	"cacheTTL" varchar(20) NOT NULL,
	"cacheHitRate" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenantFeatureFlags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"featureKey" varchar(96) NOT NULL,
	"label" varchar(191) NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"rolloutStage" text NOT NULL,
	"adminManaged" integer DEFAULT 1 NOT NULL,
	"dependsOn" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"name" varchar(191) NOT NULL,
	"onboardingStatus" text NOT NULL,
	"segment" text NOT NULL,
	"region" varchar(96) NOT NULL,
	"enabledModules" jsonb NOT NULL,
	"whiteLabel" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_tenantId_unique" UNIQUE("tenantId")
);
--> statement-breakpoint
CREATE TABLE "tls_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(200) NOT NULL,
	"protocol" varchar(20),
	"cipher_suites" jsonb,
	"cert_expiry" timestamp,
	"ocsp_stapling" boolean DEFAULT true,
	"hsts_preload" boolean DEFAULT true,
	"handshakes_24h" bigint DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "token_families" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" varchar(50) NOT NULL,
	"user_id" varchar(50),
	"client_id" varchar(100),
	"generation" integer DEFAULT 0,
	"max_generations" integer DEFAULT 100,
	"replay_detected" boolean DEFAULT false,
	"revoked_descendants" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer,
	"customer_id" varchar(64) NOT NULL,
	"alert_type" varchar(64) NOT NULL,
	"severity" varchar(16) DEFAULT 'medium' NOT NULL,
	"amount_ngn" double precision,
	"description" text,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"assigned_to" varchar(64),
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_monitoring_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" varchar(64) NOT NULL,
	"scenario_code" varchar(32),
	"description" text,
	"risk_score_impact" integer DEFAULT 10 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"cbn_prescribed" integer DEFAULT 0 NOT NULL,
	"threshold_config" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transactionId" varchar(64) NOT NULL,
	"accountId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"type" text NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"narration" text NOT NULL,
	"reference" varchar(128) NOT NULL,
	"channel" text NOT NULL,
	"counterpartyAccountId" varchar(64),
	"counterpartyName" varchar(191),
	"balanceAfter" double precision NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"valueDate" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transactionId_unique" UNIQUE("transactionId"),
	CONSTRAINT "transactions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transferId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"sourceAccountId" varchar(64) NOT NULL,
	"destinationAccountId" varchar(64),
	"destinationBank" varchar(64),
	"destinationAccountNumber" varchar(32),
	"beneficiaryName" varchar(191),
	"amount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"channel" text NOT NULL,
	"narration" text NOT NULL,
	"nipSessionId" varchar(64),
	"mojaloopTransferId" varchar(64),
	"status" text DEFAULT 'pending' NOT NULL,
	"failureReason" text,
	"idempotencyKey" varchar(128),
	"transferDate" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_transferId_unique" UNIQUE("transferId"),
	CONSTRAINT "transfers_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "trialBalances" (
	"id" serial PRIMARY KEY NOT NULL,
	"trialBalanceId" varchar(64) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"glAccountCode" varchar(32) NOT NULL,
	"periodStart" timestamp NOT NULL,
	"periodEnd" timestamp NOT NULL,
	"openingBalance" double precision NOT NULL,
	"totalDebits" double precision NOT NULL,
	"totalCredits" double precision NOT NULL,
	"closingBalance" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trialBalances_trialBalanceId_unique" UNIQUE("trialBalanceId")
);
--> statement-breakpoint
CREATE TABLE "txn_pattern_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customerId" varchar(50) NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"anomalyScore" real DEFAULT 0,
	"baselineDeviation" varchar(20) NOT NULL,
	"recommendation" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "typology_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"typologyCode" varchar(30) NOT NULL,
	"typologyName" varchar(200) NOT NULL,
	"riskLevel" varchar(20) NOT NULL,
	"customersTriggered" integer DEFAULT 0,
	"autoSARGeneration" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ubo_graph_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"relationship" varchar(64) NOT NULL,
	"ownership_pct" double precision,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ubo_graph_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_name" text NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"nationality" varchar(64),
	"risk_level" varchar(16),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "ussd_banking_gateway" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ussd_multilingual" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ussd_sim_toolkit" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ussd_transaction_engine" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "valueChainContracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"contractType" varchar(50) NOT NULL,
	"buyerName" varchar(200) NOT NULL,
	"buyerId" varchar(64) NOT NULL,
	"sellerFarmerId" varchar(32) NOT NULL,
	"commodity" varchar(100) NOT NULL,
	"quantityTonnes" double precision NOT NULL,
	"pricePerTonne" double precision NOT NULL,
	"totalValue" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"deliveryLocation" varchar(200) NOT NULL,
	"deliveryDeadline" varchar(20) NOT NULL,
	"warehouseReceiptId" varchar(32),
	"qualityGrade" varchar(20) DEFAULT 'Grade A' NOT NULL,
	"milestones" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "valueChainContracts_contractId_unique" UNIQUE("contractId")
);
--> statement-breakpoint
CREATE TABLE "vault_engines" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"engine_type" varchar(30),
	"description" text,
	"leases" integer DEFAULT 0,
	"max_ttl" varchar(20),
	"default_ttl" varchar(20),
	"rotations_completed" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vaultOperations" (
	"id" serial PRIMARY KEY NOT NULL,
	"operationId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"operationType" varchar(30) NOT NULL,
	"fromLocation" varchar(100) NOT NULL,
	"toLocation" varchar(100) NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"authorizedBy" varchar(100) NOT NULL,
	"dualControlBy" varchar(100),
	"status" varchar(30) DEFAULT 'completed' NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vaultOperations_operationId_unique" UNIQUE("operationId")
);
--> statement-breakpoint
CREATE TABLE "vault_secrets" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"engine" varchar(30) NOT NULL,
	"version" integer DEFAULT 1,
	"rotation_days" integer,
	"last_rotated" timestamp,
	"next_rotation" timestamp,
	"access_count" bigint DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "virtualAccounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"accountId" varchar(64) NOT NULL,
	"tenantId" varchar(128) NOT NULL,
	"van" varchar(20) NOT NULL,
	"parentAccountId" varchar(64),
	"ownerId" varchar(64) NOT NULL,
	"ownerName" varchar(255) NOT NULL,
	"ownerType" varchar(32) NOT NULL,
	"purpose" text,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"balance" double precision DEFAULT 0,
	"availableBalance" double precision DEFAULT 0,
	"holdAmount" double precision DEFAULT 0,
	"dailyLimit" double precision,
	"monthlyLimit" double precision,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"expiryDate" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "virtualAccounts_accountId_unique" UNIQUE("accountId"),
	CONSTRAINT "virtualAccounts_van_unique" UNIQUE("van")
);
--> statement-breakpoint
CREATE TABLE "virtual_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant-lagos-main' NOT NULL,
	"customer_id" text NOT NULL,
	"card_type" text NOT NULL,
	"card_scheme" text NOT NULL,
	"masked_pan" text NOT NULL,
	"expiry_date" text NOT NULL,
	"spend_limit" real NOT NULL,
	"current_spend" real DEFAULT 0,
	"currency" text DEFAULT 'NGN',
	"is_frozen" boolean DEFAULT false,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "virtual_scroll_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tableName" varchar(100) NOT NULL,
	"totalRows" bigint DEFAULT 0,
	"viewportRows" integer DEFAULT 0,
	"renderTimeMs" real DEFAULT 0,
	"scrollFps" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_agent_escalation" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_asr_nigerian" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_banking_gateway" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_biometric_auth" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_call_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_ivr_menu" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_nlu_banking" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_tts_nigerian" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "waf_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" varchar(20) NOT NULL,
	"name" varchar(200),
	"category" varchar(50),
	"severity" varchar(20),
	"paranoia" integer DEFAULT 1,
	"matched_24h" integer DEFAULT 0,
	"blocked_24h" integer DEFAULT 0,
	"false_positives" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'enforced',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warehouse_management" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"region" text,
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warehouseReceipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"receiptId" varchar(32) NOT NULL,
	"tenantId" varchar(64) NOT NULL,
	"depositorId" varchar(64) NOT NULL,
	"depositorName" varchar(200) NOT NULL,
	"warehouseId" varchar(64) NOT NULL,
	"warehouseName" varchar(200),
	"location" varchar(200) NOT NULL,
	"commodity" varchar(100) NOT NULL,
	"quantity" double precision NOT NULL,
	"quantityUnit" varchar(20) DEFAULT 'tonnes' NOT NULL,
	"qualityGrade" varchar(20) DEFAULT 'Grade A' NOT NULL,
	"storageStartDate" varchar(20) NOT NULL,
	"expiryDate" varchar(20),
	"marketValue" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"pledgedAsCollateral" integer DEFAULT 0 NOT NULL,
	"collateralLoanId" varchar(32),
	"insurancePolicyId" varchar(32),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "warehouseReceipts_receiptId_unique" UNIQUE("receiptId")
);
--> statement-breakpoint
CREATE TABLE "watchlist_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"source" varchar(100) NOT NULL,
	"url" varchar(500) NOT NULL,
	"format" varchar(20) NOT NULL,
	"entries" integer DEFAULT 0,
	"syncFrequency" varchar(20) NOT NULL,
	"autoSync" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_banking_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_business_gateway" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_document_service" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_payment_integration" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"amount" double precision DEFAULT 0,
	"channel" text,
	"msisdn" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wire_transfer_monitor" (
	"id" serial PRIMARY KEY NOT NULL,
	"originatorName" varchar(200) NOT NULL,
	"beneficiaryName" varchar(200) NOT NULL,
	"amount" bigint DEFAULT 0,
	"currency" varchar(5) NOT NULL,
	"travelRuleCompliant" boolean DEFAULT false,
	"status" varchar(30) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflowCases" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflowId" varchar(64) NOT NULL,
	"customer" varchar(191) NOT NULL,
	"product" varchar(128) NOT NULL,
	"stage" varchar(128) NOT NULL,
	"status" varchar(64) NOT NULL,
	"channel" varchar(96) NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"nextAction" text NOT NULL,
	"slaHours" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflowCases_workflowId_unique" UNIQUE("workflowId")
);
--> statement-breakpoint
CREATE INDEX "account_customer_idx" ON "accounts" USING btree ("customerId","status");--> statement-breakpoint
CREATE INDEX "account_tenant_idx" ON "accounts" USING btree ("tenantId","accountType","status");--> statement-breakpoint
CREATE INDEX "account_branch_idx" ON "accounts" USING btree ("branchCode","status");--> statement-breakpoint
CREATE INDEX "acgsf_guarantee_tenant_idx" ON "acgsf_guarantee" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "adverse_media_entity_idx" ON "adverse_media_hits" USING btree ("entity_name");--> statement-breakpoint
CREATE INDEX "adverse_media_status_idx" ON "adverse_media_hits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "adverse_media_scans_status_idx" ON "adverse_media_scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_tenant" ON "agentBankingAgents" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_agent_code" ON "agentBankingAgents" USING btree ("agentCode");--> statement-breakpoint
CREATE INDEX "agent_farmer_onboarding_tenant_idx" ON "agent_farmer_onboarding" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agent_captures_agent_idx" ON "agent_kyc_captures" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_captures_lga_idx" ON "agent_kyc_captures" USING btree ("lga");--> statement-breakpoint
CREATE INDEX "aggregation_center_tenant_idx" ON "aggregation_center" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agri_esg_impact_tenant_idx" ON "agri_esg_impact" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agri_evoucher_tenant_idx" ON "agri_evoucher" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agri_input_marketplace_tenant_idx" ON "agri_input_marketplace" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agri_iot_sensor_tenant_idx" ON "agri_iot_sensor" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agriLoans_tenant_idx" ON "agriLoans" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "agriLoans_farmer_idx" ON "agriLoans" USING btree ("farmerId");--> statement-breakpoint
CREATE INDEX "agri_logistics_tenant_idx" ON "agri_logistics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agri_reinsurance_tenant_idx" ON "agri_reinsurance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agri_savings_cycles_tenant_idx" ON "agri_savings_cycles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "aml_pending_risk_idx" ON "amlAlerts" USING btree ("status","riskScore");--> statement-breakpoint
CREATE INDEX "aml_customer_idx" ON "amlAlerts" USING btree ("customerId","detectedAt");--> statement-breakpoint
CREATE INDEX "aml_cases_status_idx" ON "aml_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "aml_compliance_metrics_status_idx" ON "aml_compliance_metrics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "regulatory_reports_aml_status_idx" ON "regulatory_reports_aml" USING btree ("status");--> statement-breakpoint
CREATE INDEX "aml_risk_scores_status_idx" ON "aml_risk_scores" USING btree ("status");--> statement-breakpoint
CREATE INDEX "aml_training_records_status_idx" ON "aml_training_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "animal_id_traceability_tenant_idx" ON "animal_id_traceability" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "anomaly_models_status_idx" ON "anomaly_models" USING btree ("status");--> statement-breakpoint
CREATE INDEX "anti_spoofing_customer_idx" ON "anti_spoofing_results" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "anti_spoofing_tenant_idx" ON "anti_spoofing_results" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "anti_spoofing_check_idx" ON "anti_spoofing_results" USING btree ("liveness_check_id");--> statement-breakpoint
CREATE INDEX "anti_spoofing_spoof_type_idx" ON "anti_spoofing_results" USING btree ("spoof_type");--> statement-breakpoint
CREATE INDEX "api_key_policies_status_idx" ON "api_key_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "apisix_plugin_chains_status_idx" ON "apisix_plugin_chains" USING btree ("status");--> statement-breakpoint
CREATE INDEX "area_yield_index_insurance_tenant_idx" ON "area_yield_index_insurance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_route_timestamp_idx" ON "auditEntries" USING btree ("route","timestampAt");--> statement-breakpoint
CREATE INDEX "audit_severity_timestamp_idx" ON "auditEntries" USING btree ("severity","timestampAt");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "auditTrail" USING btree ("entityType","entityId","createdAt");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "auditTrail" USING btree ("actorId","createdAt");--> statement-breakpoint
CREATE INDEX "audit_tenant_idx" ON "auditTrail" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "avro_schemas_status_idx" ON "avro_schemas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bg_tenant_idx" ON "bankGuarantees" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "bg_applicant_idx" ON "bankGuarantees" USING btree ("applicantId");--> statement-breakpoint
CREATE INDEX "batch_aggregator_configs_status_idx" ON "batch_aggregator_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "beneficial_owners_status_idx" ON "beneficial_owners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_account_tenant_idx" ON "billingAccounts" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "billing_accrual_tenant_idx" ON "billingAccrualSnapshots" USING btree ("tenantId","billingPeriodKey","accruedAmount");--> statement-breakpoint
CREATE INDEX "billing_accrual_meter_idx" ON "billingAccrualSnapshots" USING btree ("meterKey","productKey","billingPeriodKey");--> statement-breakpoint
CREATE INDEX "billing_contract_override_lookup_idx" ON "billingContractOverrides" USING btree ("billingAccountId","overrideType","status","effectiveFrom");--> statement-breakpoint
CREATE INDEX "billing_discount_rule_lookup_idx" ON "billingDiscountRules" USING btree ("billingAccountId","status","effectiveFrom");--> statement-breakpoint
CREATE INDEX "billing_invoice_approval_lookup_idx" ON "billingInvoiceApprovals" USING btree ("billingInvoiceId","status","actorRole");--> statement-breakpoint
CREATE INDEX "billing_invoice_line_lookup_idx" ON "billingInvoiceLines" USING btree ("billingInvoiceId","lineType");--> statement-breakpoint
CREATE INDEX "billing_invoice_lookup_idx" ON "billingInvoices" USING btree ("billingAccountId","billingPeriodKey","status");--> statement-breakpoint
CREATE INDEX "billing_rate_card_line_lookup_idx" ON "billingRateCardLines" USING btree ("rateCardId","meterKey","productKey");--> statement-breakpoint
CREATE INDEX "billing_rate_card_lookup_idx" ON "billingRateCards" USING btree ("billingAccountId","status","effectiveFrom");--> statement-breakpoint
CREATE INDEX "billing_rated_event_lookup_idx" ON "billingRatedEvents" USING btree ("billingPeriodKey","rateCardId","ratedAt");--> statement-breakpoint
CREATE INDEX "billing_revenue_share_lookup_idx" ON "billingRevenueShareRules" USING btree ("billingAccountId","status","effectiveFrom");--> statement-breakpoint
CREATE INDEX "billing_usage_tenant_idx" ON "billingUsageEvents" USING btree ("tenantId","eventTimestamp");--> statement-breakpoint
CREATE INDEX "billing_usage_meter_idx" ON "billingUsageEvents" USING btree ("meterKey","productKey","eventTimestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_usage_idempotency_idx" ON "billingUsageEvents" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "bloom_filters_status_idx" ON "bloom_filters" USING btree ("status");--> statement-breakpoint
CREATE INDEX "body_limit_rules_status_idx" ON "body_limit_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bundle_split_configs_status_idx" ON "bundle_split_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bureau_checks_customer_idx" ON "bureau_checks" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "cache_invalidations_status_idx" ON "cache_invalidations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "card_txn_card_idx" ON "cardTransactions" USING btree ("cardId","createdAt");--> statement-breakpoint
CREATE INDEX "card_txn_account_idx" ON "cardTransactions" USING btree ("accountId","createdAt");--> statement-breakpoint
CREATE INDEX "cbn_agri_returns_tenant_idx" ON "cbn_agri_returns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cbn_agsmeis_tenant_idx" ON "cbn_agsmeis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cbn_anchor_borrowers_tenant_idx" ON "cbn_anchor_borrowers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cbn_compliance_checks_status_idx" ON "cbn_compliance_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cdn_edge_configs_status_idx" ON "cdn_edge_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "coalescing_rules_status_idx" ON "coalescing_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commodity_exchange_tenant_idx" ON "commodity_exchange" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commodity_price_intelligence_tenant_idx" ON "commodity_price_intelligence" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "compression_configs_status_idx" ON "compression_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cooperative_credit_scoring_tenant_idx" ON "cooperative_credit_scoring" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cooperative_financials_tenant_idx" ON "cooperative_financials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cooperative_management_tenant_idx" ON "cooperative_management" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cooperative_meetings_tenant_idx" ON "cooperative_meetings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "corp_monitoring_company_idx" ON "corporate_monitoring_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "correlation_rules_status_idx" ON "correlation_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cropIns_tenant_idx" ON "cropInsurancePolicies" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "cropIns_farmer_idx" ON "cropInsurancePolicies" USING btree ("farmerId");--> statement-breakpoint
CREATE INDEX "crop_yield_prediction_tenant_idx" ON "crop_yield_prediction" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "crossborder_agri_trade_tenant_idx" ON "crossborder_agri_trade" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "csp_policies_status_idx" ON "csp_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ctr_reports_aml_status_idx" ON "ctr_reports_aml" USING btree ("status");--> statement-breakpoint
CREATE INDEX "approval_customer_state_idx" ON "customerApprovals" USING btree ("customerId","state","requestedAt");--> statement-breakpoint
CREATE INDEX "approval_role_state_idx" ON "customerApprovals" USING btree ("approvalRole","state","requestedAt");--> statement-breakpoint
CREATE INDEX "notification_customer_read_idx" ON "customerNotifications" USING btree ("customerId","isRead","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "session_actor_lookup_idx" ON "customerSessionPreferences" USING btree ("actorId","actorRole","tenantId");--> statement-breakpoint
CREATE INDEX "statement_customer_occurred_idx" ON "customerStatements" USING btree ("customerId","occurredAt");--> statement-breakpoint
CREATE INDEX "statement_customer_type_idx" ON "customerStatements" USING btree ("customerId","statementType","status");--> statement-breakpoint
CREATE INDEX "transfer_customer_status_idx" ON "customerTransfers" USING btree ("customerId","status","createdAt");--> statement-breakpoint
CREATE INDEX "transfer_approval_idx" ON "customerTransfers" USING btree ("customerId","approvalState","updatedAt");--> statement-breakpoint
CREATE INDEX "transfer_otp_idx" ON "customerTransfers" USING btree ("otpReference","status");--> statement-breakpoint
CREATE INDEX "customer_tenant_status_idx" ON "customers" USING btree ("tenantId","status","segment");--> statement-breakpoint
CREATE INDEX "customer_manager_touchpoint_idx" ON "customers" USING btree ("relationshipManager","lastTouchpointAt");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_bvn_idx" ON "customers" USING btree ("bvn");--> statement-breakpoint
CREATE INDEX "ddos_rules_status_idx" ON "ddos_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "device_profiles_status_idx" ON "device_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dispute_tenant" ON "disputeCases" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_dispute_customer" ON "disputeCases" USING btree ("customerId");--> statement-breakpoint
CREATE INDEX "idx_dispute_status" ON "disputeCases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "distroless_images_status_idx" ON "distroless_images" USING btree ("status");--> statement-breakpoint
CREATE INDEX "docker_hardening_status_idx" ON "docker_hardening_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_edloan_tenant" ON "educationLoans" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_edloan_student" ON "educationLoans" USING btree ("studentId");--> statement-breakpoint
CREATE INDEX "efass_mbr_idx" ON "efassMapping" USING btree ("mbrForm","mbrLine");--> statement-breakpoint
CREATE INDEX "efass_gl_range_idx" ON "efassMapping" USING btree ("glCodeStart","glCodeEnd");--> statement-breakpoint
CREATE INDEX "egress_policies_status_idx" ON "egress_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "equipment_leasing_tenant_idx" ON "equipment_leasing" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_erpnext_tenant" ON "erpnextSyncJobs" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_erpnext_status" ON "erpnextSyncJobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escrow_accounts_tenant_idx" ON "escrow_accounts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "escrow_accounts_status_idx" ON "escrow_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escrow_accounts_type_idx" ON "escrow_accounts" USING btree ("escrowType");--> statement-breakpoint
CREATE INDEX "escrow_audit_escrow_idx" ON "escrow_audit_log" USING btree ("escrowId");--> statement-breakpoint
CREATE INDEX "escrow_audit_action_idx" ON "escrow_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "escrow_disputes_escrow_idx" ON "escrow_disputes" USING btree ("escrowId");--> statement-breakpoint
CREATE INDEX "escrow_disputes_status_idx" ON "escrow_disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escrow_documents_escrow_idx" ON "escrow_documents" USING btree ("escrowId");--> statement-breakpoint
CREATE INDEX "escrow_fees_escrow_idx" ON "escrow_fees" USING btree ("escrowId");--> statement-breakpoint
CREATE INDEX "escrow_interest_escrow_idx" ON "escrow_interest_accruals" USING btree ("escrowId");--> statement-breakpoint
CREATE INDEX "escrow_milestones_escrow_idx" ON "escrow_milestones" USING btree ("escrowId");--> statement-breakpoint
CREATE INDEX "escrow_parties_escrow_idx" ON "escrow_parties" USING btree ("escrowId");--> statement-breakpoint
CREATE INDEX "escrow_parties_role_idx" ON "escrow_parties" USING btree ("role");--> statement-breakpoint
CREATE INDEX "escrow_regulatory_status_idx" ON "escrow_regulatory_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escrow_txn_escrow_idx" ON "escrow_transactions" USING btree ("escrowId");--> statement-breakpoint
CREATE INDEX "escrow_txn_type_idx" ON "escrow_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_esusu_tenant" ON "esusuGroups" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_esusu_organiser" ON "esusuGroups" USING btree ("organiserId");--> statement-breakpoint
CREATE INDEX "event_dedup_configs_status_idx" ON "event_dedup_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "export_domain_approval_idx" ON "exportJobs" USING btree ("domainKey","approvalState","createdAt");--> statement-breakpoint
CREATE INDEX "export_route_status_idx" ON "exportJobs" USING btree ("route","status","createdAt");--> statement-breakpoint
CREATE INDEX "face_embeddings_customer_idx" ON "face_embeddings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "face_embeddings_tenant_idx" ON "face_embeddings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "face_embeddings_enrolled_idx" ON "face_embeddings" USING btree ("is_enrolled");--> statement-breakpoint
CREATE INDEX "face_matches_customer_idx" ON "face_matches" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "face_matches_tenant_idx" ON "face_matches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "face_matches_matched_idx" ON "face_matches" USING btree ("matched");--> statement-breakpoint
CREATE INDEX "facial_landmarks_customer_idx" ON "facial_landmarks" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "facial_landmarks_check_idx" ON "facial_landmarks" USING btree ("liveness_check_id");--> statement-breakpoint
CREATE INDEX "farm_boundary_mapping_tenant_idx" ON "farm_boundary_mapping" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "farmers_tenant_idx" ON "farmers" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "farmers_region_idx" ON "farmers" USING btree ("region");--> statement-breakpoint
CREATE INDEX "fast_json_schemas_status_idx" ON "fast_json_schemas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fisheries_aquaculture_tenant_idx" ON "fisheries_aquaculture" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "fluvio_smart_modules_status_idx" ON "fluvio_smart_modules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "frame_policies_status_idx" ON "frame_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fx_value_date_idx" ON "fxTrades" USING btree ("valueDate","status");--> statement-breakpoint
CREATE INDEX "gl_category_idx" ON "glAccounts" USING btree ("tenantId","category");--> statement-breakpoint
CREATE INDEX "goaml_reports_status_idx" ON "goaml_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "grpc_services_status_idx" ON "grpc_services" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hot_data_caches_status_idx" ON "hot_data_caches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hpa_configs_status_idx" ON "hpa_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "http2_connections_status_idx" ON "http2_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_identity_tenant" ON "identityProfiles" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_identity_customer" ON "identityProfiles" USING btree ("customerId");--> statement-breakpoint
CREATE INDEX "ijara_tenant_idx" ON "ijaraContracts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ijara_customer_idx" ON "ijaraContracts" USING btree ("customerId");--> statement-breakpoint
CREATE INDEX "image_scans_status_idx" ON "image_scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "immutable_audit_blocks_status_idx" ON "immutable_audit_blocks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "insurance_portfolio_analytics_tenant_idx" ON "insurance_portfolio_analytics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "interactive_ussd_agri_tenant_idx" ON "interactive_ussd_agri" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ip_rules_status_idx" ON "ip_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "je_account_idx" ON "journalEntries" USING btree ("accountId","createdAt");--> statement-breakpoint
CREATE INDEX "je_gl_code_idx" ON "journalEntries" USING btree ("glAccountCode","postingDate");--> statement-breakpoint
CREATE INDEX "je_batch_idx" ON "journalEntries" USING btree ("batchId");--> statement-breakpoint
CREATE INDEX "jwt_validations_status_idx" ON "jwt_validations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kafka_batch_producers_status_idx" ON "kafka_batch_producers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kafka_consumer_groups_status_idx" ON "kafka_consumer_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "keda_scale_triggers_status_idx" ON "keda_scale_triggers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "keepalive_configs_status_idx" ON "keepalive_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "key_rotation_schedules_status_idx" ON "key_rotation_schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kms_keys_status_idx" ON "kms_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kpi_branches_state_idx" ON "kpi_branches" USING btree ("state");--> statement-breakpoint
CREATE INDEX "kpi_branches_status_idx" ON "kpi_branches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kpi_composite_role_idx" ON "kpi_composite_scores" USING btree ("role_key");--> statement-breakpoint
CREATE INDEX "kpi_composite_period_idx" ON "kpi_composite_scores" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "kpi_hierarchy_parent_idx" ON "kpi_hierarchy" USING btree ("parent_role_key");--> statement-breakpoint
CREATE INDEX "kpi_hierarchy_child_idx" ON "kpi_hierarchy" USING btree ("child_role_key");--> statement-breakpoint
CREATE INDEX "kpi_metrics_role_idx" ON "kpi_metrics" USING btree ("role_key");--> statement-breakpoint
CREATE INDEX "kpi_metrics_category_idx" ON "kpi_metrics" USING btree ("category");--> statement-breakpoint
CREATE INDEX "kpi_events_rule_idx" ON "kpi_notification_events" USING btree ("rule_key");--> statement-breakpoint
CREATE INDEX "kpi_events_role_idx" ON "kpi_notification_events" USING btree ("role_key");--> statement-breakpoint
CREATE INDEX "kpi_events_status_idx" ON "kpi_notification_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kpi_events_fired_idx" ON "kpi_notification_events" USING btree ("fired_at");--> statement-breakpoint
CREATE INDEX "kpi_notification_rules_role_idx" ON "kpi_notification_rules" USING btree ("role_key");--> statement-breakpoint
CREATE INDEX "kpi_scores_metric_idx" ON "kpi_scores" USING btree ("metric_key");--> statement-breakpoint
CREATE INDEX "kpi_scores_role_idx" ON "kpi_scores" USING btree ("role_key");--> statement-breakpoint
CREATE INDEX "kpi_scores_period_idx" ON "kpi_scores" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "kpi_scores_cadence_idx" ON "kpi_scores" USING btree ("cadence");--> statement-breakpoint
CREATE INDEX "kyb_verifications_company_idx" ON "kyb_enforcement_verifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "kyb_verifications_status_idx" ON "kyb_enforcement_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyb_verifications_tenant_idx" ON "kyb_enforcement_verifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "kyc_enforcement_log_service_idx" ON "kyc_enforcement_log" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "kyc_enforcement_log_decision_idx" ON "kyc_enforcement_log" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "kyc_enforcement_log_customer_idx" ON "kyc_enforcement_log" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "kyc_verifications_customer_idx" ON "kyc_enforcement_verifications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "kyc_verifications_status_idx" ON "kyc_enforcement_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_verifications_level_idx" ON "kyc_enforcement_verifications" USING btree ("level");--> statement-breakpoint
CREATE INDEX "kyc_verifications_tenant_idx" ON "kyc_enforcement_verifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "kyc_event_triggers_topic_idx" ON "kyc_event_triggers" USING btree ("event_topic");--> statement-breakpoint
CREATE INDEX "kyc_event_triggers_customer_idx" ON "kyc_event_triggers" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "kyc_event_triggers_status_idx" ON "kyc_event_triggers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_tier_history_customer_idx" ON "kyc_tier_history" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "kyc_tiers_customer_idx" ON "kyc_tiers" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "kyc_tiers_status_idx" ON "kyc_tiers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_customer_idx" ON "kycVerifications" USING btree ("customerId","verifiedAt");--> statement-breakpoint
CREATE INDEX "idx_lgroup_tenant" ON "lendingGroups" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_lgroup_leader" ON "lendingGroups" USING btree ("groupLeaderId");--> statement-breakpoint
CREATE INDEX "lc_tenant_idx" ON "lettersOfCredit" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "lc_applicant_idx" ON "lettersOfCredit" USING btree ("applicantId");--> statement-breakpoint
CREATE INDEX "liveness_checks_customer_idx" ON "liveness_checks" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "liveness_checks_tenant_idx" ON "liveness_checks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "liveness_checks_session_idx" ON "liveness_checks" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "liveness_checks_verdict_idx" ON "liveness_checks" USING btree ("verdict");--> statement-breakpoint
CREATE INDEX "liveness_events_session_idx" ON "liveness_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "liveness_events_customer_idx" ON "liveness_events" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "liveness_events_type_idx" ON "liveness_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "livestock_finance_tenant_idx" ON "livestock_finance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "livestock_insurance_tenant_idx" ON "livestock_insurance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "livestock_management_tenant_idx" ON "livestock_management" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "repayment_loan_idx" ON "loanRepayments" USING btree ("loanId","dueDate");--> statement-breakpoint
CREATE INDEX "loan_customer_idx" ON "loans" USING btree ("customerId","status");--> statement-breakpoint
CREATE INDEX "loan_payment_idx" ON "loans" USING btree ("nextPaymentDate","status");--> statement-breakpoint
CREATE INDEX "loan_tenant_idx" ON "loans" USING btree ("tenantId","loanType","status");--> statement-breakpoint
CREATE INDEX "materialized_views_perf_status_idx" ON "materialized_views_perf" USING btree ("status");--> statement-breakpoint
CREATE INDEX "memoization_targets_status_idx" ON "memoization_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mortgage_tenant" ON "mortgageApplications" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_mortgage_applicant" ON "mortgageApplications" USING btree ("applicantId");--> statement-breakpoint
CREATE INDEX "idx_mortgage_status" ON "mortgageApplications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mtls_nodes_status_idx" ON "mtls_nodes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mudarabah_tenant_idx" ON "mudarabahContracts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "mudarabah_investor_idx" ON "mudarabahContracts" USING btree ("investorId");--> statement-breakpoint
CREATE INDEX "multi_peril_crop_insurance_tenant_idx" ON "multi_peril_crop_insurance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "murabaha_tenant_idx" ON "murabahaContracts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "murabaha_customer_idx" ON "murabahaContracts" USING btree ("customerId");--> statement-breakpoint
CREATE INDEX "ndpr_records_status_idx" ON "ndpr_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "network_policies_status_idx" ON "network_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "nfiu_filings_customer_idx" ON "nfiu_filings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "nfiu_filings_status_idx" ON "nfiu_filings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "nip_session_idx" ON "nipTransactions" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "nip_date_idx" ON "nipTransactions" USING btree ("createdAt","status");--> statement-breakpoint
CREATE INDEX "nirsal_agro_geocoop_tenant_idx" ON "nirsal_agro_geocoop" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "nirsal_credit_guarantee_tenant_idx" ON "nirsal_credit_guarantee" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "opensearch_index_configs_status_idx" ON "opensearch_index_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "operator_domain_status_idx" ON "operatorActions" USING btree ("domainKey","status","dueAt");--> statement-breakpoint
CREATE INDEX "operator_route_status_idx" ON "operatorActions" USING btree ("route","status","dueAt");--> statement-breakpoint
CREATE INDEX "optimistic_ui_configs_status_idx" ON "optimistic_ui_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "output_encoding_rules_status_idx" ON "output_encoding_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "parametric_insurance_iot_tenant_idx" ON "parametric_insurance_iot" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "partner_approval_state_idx" ON "partnerApprovalRecords" USING btree ("partnerId","state","requestedAt");--> statement-breakpoint
CREATE INDEX "partner_approval_role_idx" ON "partnerApprovalRecords" USING btree ("requiredRole","state","requestedAt");--> statement-breakpoint
CREATE INDEX "partner_tenant_stage_idx" ON "partnerOnboardingRecords" USING btree ("tenantId","stage","updatedAt");--> statement-breakpoint
CREATE INDEX "partner_readiness_idx" ON "partnerOnboardingRecords" USING btree ("stage","readinessScore");--> statement-breakpoint
CREATE INDEX "path_validation_rules_status_idx" ON "path_validation_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pci_scans_status_idx" ON "pci_scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pentest_scans_status_idx" ON "pentest_scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pgbouncer_pools_status_idx" ON "pgbouncer_pools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pin_hashes_status_idx" ON "pin_hashes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pin_verifications_customer_idx" ON "pin_verifications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "pin_verifications_result_idx" ON "pin_verifications" USING btree ("result");--> statement-breakpoint
CREATE INDEX "pkce_flows_status_idx" ON "pkce_flows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "post_harvest_loss_tracker_tenant_idx" ON "post_harvest_loss_tracker" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prepared_statements_status_idx" ON "prepared_statements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prometheus_dashboards_status_idx" ON "prometheus_dashboards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quality_certification_tenant_idx" ON "quality_certification" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "query_cache_entries_status_idx" ON "query_cache_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "read_replica_configs_status_idx" ON "read_replica_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recon_tenant" ON "reconciliationRuns" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_recon_status" ON "reconciliationRuns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "redis_cache_entries_status_idx" ON "redis_cache_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "redis_sessions_status_idx" ON "redis_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_regrep_tenant" ON "regulatoryReports" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_regrep_type" ON "regulatoryReports" USING btree ("reportType");--> statement-breakpoint
CREATE INDEX "risk_scores_customer_idx" ON "risk_scores" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "risk_scores_tier_idx" ON "risk_scores" USING btree ("risk_tier");--> statement-breakpoint
CREATE INDEX "route_schemas_status_idx" ON "route_schemas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "route_trie_stats_status_idx" ON "route_trie_stats" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sanctions_batch_runs_status_idx" ON "sanctions_batch_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sanctions_entity_idx" ON "sanctions_screenings" USING btree ("entity_name");--> statement-breakpoint
CREATE INDEX "sanctions_status_idx" ON "sanctions_screenings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sar_reports_aml_status_idx" ON "sar_reports_aml" USING btree ("status");--> statement-breakpoint
CREATE INDEX "satellite_crop_monitor_tenant_idx" ON "satellite_crop_monitor" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "scratch_cards_serial_idx" ON "scratch_cards" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "scratch_cards_batch_idx" ON "scratch_cards" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "scratch_cards_status_idx" ON "scratch_cards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "security_events_event_type_idx" ON "security_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "security_events_severity_idx" ON "security_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "settlement_date_idx" ON "settlements" USING btree ("openedAt","status");--> statement-breakpoint
CREATE INDEX "siem_pipelines_status_idx" ON "siem_pipelines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sms_alert_notification_tenant_idx" ON "sms_alert_notification" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sms_alert_notification_channel_idx" ON "sms_alert_notification" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "sms_banking_gateway_tenant_idx" ON "sms_banking_gateway" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sms_banking_gateway_channel_idx" ON "sms_banking_gateway" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "sms_otp_service_tenant_idx" ON "sms_otp_service" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sms_otp_service_channel_idx" ON "sms_otp_service" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "soc2_evidence_status_idx" ON "soc2_evidence" USING btree ("status");--> statement-breakpoint
CREATE INDEX "soil_analysis_tenant_idx" ON "soil_analysis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sorted_set_rankings_status_idx" ON "sorted_set_rankings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sql_queries_status_idx" ON "sql_queries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sri_hashes_status_idx" ON "sri_hashes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stream_response_configs_status_idx" ON "stream_response_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sw_cache_strategies_status_idx" ON "sw_cache_strategies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "swift_type_idx" ON "swiftMessages" USING btree ("messageType","createdAt");--> statement-breakpoint
CREATE INDEX "table_partitions_status_idx" ON "table_partitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tb_batch_configs_status_idx" ON "tb_batch_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "telegram_banking_commands_tenant_idx" ON "telegram_banking_commands" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "telegram_banking_commands_channel_idx" ON "telegram_banking_commands" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "telegram_bot_gateway_tenant_idx" ON "telegram_bot_gateway" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "telegram_bot_gateway_channel_idx" ON "telegram_bot_gateway" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "telegram_kyc_bot_tenant_idx" ON "telegram_kyc_bot" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "telegram_kyc_bot_channel_idx" ON "telegram_kyc_bot" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "telegram_mini_app_tenant_idx" ON "telegram_mini_app" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "telegram_mini_app_channel_idx" ON "telegram_mini_app" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "telegram_notification_tenant_idx" ON "telegram_notification" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "telegram_notification_channel_idx" ON "telegram_notification" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "teller_tenant_idx" ON "tellerSessions" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "teller_branch_idx" ON "tellerSessions" USING btree ("branchCode");--> statement-breakpoint
CREATE INDEX "ttxn_session_idx" ON "tellerTransactions" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "ttxn_tenant_idx" ON "tellerTransactions" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "temporal_memoized_activities_status_idx" ON "temporal_memoized_activities" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_feature_lookup_idx" ON "tenantFeatureFlags" USING btree ("tenantId","featureKey");--> statement-breakpoint
CREATE INDEX "tenant_feature_category_idx" ON "tenantFeatureFlags" USING btree ("tenantId","category","enabled");--> statement-breakpoint
CREATE INDEX "tls_configs_status_idx" ON "tls_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "token_families_status_idx" ON "token_families" USING btree ("status");--> statement-breakpoint
CREATE INDEX "txn_alerts_customer_idx" ON "transaction_alerts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "txn_alerts_status_idx" ON "transaction_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "txn_alerts_severity_idx" ON "transaction_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "txn_account_date_idx" ON "transactions" USING btree ("accountId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "txn_reference_idx" ON "transactions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "txn_tenant_date_idx" ON "transactions" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "transfer_date_idx" ON "transfers" USING btree ("transferDate","status");--> statement-breakpoint
CREATE INDEX "transfer_source_idx" ON "transfers" USING btree ("sourceAccountId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_idempotency_idx" ON "transfers" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "tb_period_idx" ON "trialBalances" USING btree ("tenantId","periodEnd","glAccountCode");--> statement-breakpoint
CREATE INDEX "txn_pattern_analyses_status_idx" ON "txn_pattern_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "typology_matches_status_idx" ON "typology_matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ussd_banking_gateway_tenant_idx" ON "ussd_banking_gateway" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ussd_banking_gateway_channel_idx" ON "ussd_banking_gateway" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "ussd_multilingual_tenant_idx" ON "ussd_multilingual" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ussd_multilingual_channel_idx" ON "ussd_multilingual" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "ussd_sim_toolkit_tenant_idx" ON "ussd_sim_toolkit" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ussd_sim_toolkit_channel_idx" ON "ussd_sim_toolkit" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "ussd_transaction_engine_tenant_idx" ON "ussd_transaction_engine" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ussd_transaction_engine_channel_idx" ON "ussd_transaction_engine" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "vcc_tenant_idx" ON "valueChainContracts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "vcc_seller_idx" ON "valueChainContracts" USING btree ("sellerFarmerId");--> statement-breakpoint
CREATE INDEX "vault_engines_status_idx" ON "vault_engines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vault_tenant_idx" ON "vaultOperations" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "vault_secrets_status_idx" ON "vault_secrets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_van_tenant" ON "virtualAccounts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_van_owner" ON "virtualAccounts" USING btree ("ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_van_number" ON "virtualAccounts" USING btree ("van");--> statement-breakpoint
CREATE INDEX "virtual_scroll_configs_status_idx" ON "virtual_scroll_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_agent_escalation_tenant_idx" ON "voice_agent_escalation" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voice_agent_escalation_channel_idx" ON "voice_agent_escalation" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "voice_asr_nigerian_tenant_idx" ON "voice_asr_nigerian" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voice_asr_nigerian_channel_idx" ON "voice_asr_nigerian" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "voice_banking_gateway_tenant_idx" ON "voice_banking_gateway" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voice_banking_gateway_channel_idx" ON "voice_banking_gateway" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "voice_biometric_auth_tenant_idx" ON "voice_biometric_auth" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voice_biometric_auth_channel_idx" ON "voice_biometric_auth" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "voice_call_analytics_tenant_idx" ON "voice_call_analytics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voice_call_analytics_channel_idx" ON "voice_call_analytics" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "voice_ivr_menu_tenant_idx" ON "voice_ivr_menu" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voice_ivr_menu_channel_idx" ON "voice_ivr_menu" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "voice_nlu_banking_tenant_idx" ON "voice_nlu_banking" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voice_nlu_banking_channel_idx" ON "voice_nlu_banking" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "voice_tts_nigerian_tenant_idx" ON "voice_tts_nigerian" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voice_tts_nigerian_channel_idx" ON "voice_tts_nigerian" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "waf_rules_status_idx" ON "waf_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "warehouse_management_tenant_idx" ON "warehouse_management" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "whr_tenant_idx" ON "warehouseReceipts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "whr_depositor_idx" ON "warehouseReceipts" USING btree ("depositorId");--> statement-breakpoint
CREATE INDEX "watchlist_sources_status_idx" ON "watchlist_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "whatsapp_banking_flows_tenant_idx" ON "whatsapp_banking_flows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "whatsapp_banking_flows_channel_idx" ON "whatsapp_banking_flows" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "whatsapp_business_gateway_tenant_idx" ON "whatsapp_business_gateway" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "whatsapp_business_gateway_channel_idx" ON "whatsapp_business_gateway" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "whatsapp_document_service_tenant_idx" ON "whatsapp_document_service" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "whatsapp_document_service_channel_idx" ON "whatsapp_document_service" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "whatsapp_notification_tenant_idx" ON "whatsapp_notification" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "whatsapp_notification_channel_idx" ON "whatsapp_notification" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "whatsapp_payment_integration_tenant_idx" ON "whatsapp_payment_integration" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "whatsapp_payment_integration_channel_idx" ON "whatsapp_payment_integration" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "wire_transfer_monitor_status_idx" ON "wire_transfer_monitor" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_stage_status_idx" ON "workflowCases" USING btree ("stage","status","updatedAt");--> statement-breakpoint
CREATE INDEX "workflow_product_status_idx" ON "workflowCases" USING btree ("product","status","createdAt");