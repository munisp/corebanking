CREATE TABLE `billingContractOverrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractOverrideId` varchar(64) NOT NULL,
	`billingAccountId` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`overrideType` enum('unit_price','included_units','minimum_commit','billing_model','billing_period') NOT NULL,
	`meterKey` varchar(96),
	`productKey` varchar(96),
	`valueNumber` double,
	`valueText` varchar(96),
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`status` enum('draft','active','expired') NOT NULL,
	`createdBy` varchar(96) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingContractOverrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingContractOverrides_contractOverrideId_unique` UNIQUE(`contractOverrideId`)
);
--> statement-breakpoint
CREATE TABLE `billingDiscountRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discountRuleId` varchar(64) NOT NULL,
	`billingAccountId` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`name` varchar(191) NOT NULL,
	`discountType` enum('percentage','fixed','threshold_percentage') NOT NULL,
	`meterKey` varchar(96),
	`productKey` varchar(96),
	`percentage` double,
	`fixedAmount` double,
	`thresholdAmount` double,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`status` enum('draft','active','expired') NOT NULL,
	`createdBy` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingDiscountRules_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingDiscountRules_discountRuleId_unique` UNIQUE(`discountRuleId`)
);
--> statement-breakpoint
CREATE TABLE `billingInvoiceApprovals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingInvoiceApprovalId` varchar(96) NOT NULL,
	`billingInvoiceId` varchar(64) NOT NULL,
	`stageKey` varchar(96) NOT NULL,
	`actorRole` enum('operations','treasury','compliance','branch') NOT NULL,
	`status` enum('pending','approved','rejected','skipped') NOT NULL,
	`actedAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingInvoiceApprovals_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingInvoiceApprovals_billingInvoiceApprovalId_unique` UNIQUE(`billingInvoiceApprovalId`)
);
--> statement-breakpoint
CREATE TABLE `billingInvoiceLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingInvoiceLineId` varchar(96) NOT NULL,
	`billingInvoiceId` varchar(64) NOT NULL,
	`lineType` enum('usage','discount','revenue_share','minimum_commit','tax') NOT NULL,
	`meterKey` varchar(96),
	`productKey` varchar(96),
	`description` varchar(191) NOT NULL,
	`quantity` double NOT NULL DEFAULT 0,
	`unitPrice` double NOT NULL DEFAULT 0,
	`amount` double NOT NULL DEFAULT 0,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billingInvoiceLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingInvoiceLines_billingInvoiceLineId_unique` UNIQUE(`billingInvoiceLineId`)
);
--> statement-breakpoint
CREATE TABLE `billingInvoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingInvoiceId` varchar(64) NOT NULL,
	`invoiceNumber` varchar(96) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`billingAccountId` varchar(64) NOT NULL,
	`billingPeriodKey` varchar(32) NOT NULL,
	`billingPeriodType` enum('monthly','quarterly','semi_annual','annual','custom') NOT NULL,
	`periodStartAt` timestamp NOT NULL,
	`periodEndAt` timestamp NOT NULL,
	`currency` varchar(3) NOT NULL,
	`subtotalAmount` double NOT NULL DEFAULT 0,
	`discountAmount` double NOT NULL DEFAULT 0,
	`revenueShareAmount` double NOT NULL DEFAULT 0,
	`minimumCommitAdjustment` double NOT NULL DEFAULT 0,
	`taxAmount` double NOT NULL DEFAULT 0,
	`totalAmount` double NOT NULL DEFAULT 0,
	`status` enum('draft','pending_approval','approved','rejected','issued','paid','void') NOT NULL,
	`approvalStatus` enum('pending','approved','rejected','skipped') NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`dueAt` timestamp NOT NULL,
	`approvalStepCount` int NOT NULL DEFAULT 0,
	`issuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingInvoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingInvoices_billingInvoiceId_unique` UNIQUE(`billingInvoiceId`),
	CONSTRAINT `billingInvoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `billingRevenueShareRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`revenueShareRuleId` varchar(64) NOT NULL,
	`billingAccountId` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`name` varchar(191) NOT NULL,
	`target` enum('platform','partner_bank','aggregator','reseller') NOT NULL,
	`percentage` double NOT NULL DEFAULT 0,
	`beneficiaryName` varchar(191) NOT NULL,
	`settlementLedgerCode` varchar(96),
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`status` enum('draft','active','expired') NOT NULL,
	`createdBy` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingRevenueShareRules_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingRevenueShareRules_revenueShareRuleId_unique` UNIQUE(`revenueShareRuleId`)
);
--> statement-breakpoint
ALTER TABLE `billingAccounts` ADD `defaultBillingPeriodType` enum('monthly','quarterly','semi_annual','annual','custom') DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE `billingAccounts` ADD `invoiceDueDays` int DEFAULT 14 NOT NULL;--> statement-breakpoint
CREATE INDEX `billing_contract_override_lookup_idx` ON `billingContractOverrides` (`billingAccountId`,`overrideType`,`status`,`effectiveFrom`);--> statement-breakpoint
CREATE INDEX `billing_discount_rule_lookup_idx` ON `billingDiscountRules` (`billingAccountId`,`status`,`effectiveFrom`);--> statement-breakpoint
CREATE INDEX `billing_invoice_approval_lookup_idx` ON `billingInvoiceApprovals` (`billingInvoiceId`,`status`,`actorRole`);--> statement-breakpoint
CREATE INDEX `billing_invoice_line_lookup_idx` ON `billingInvoiceLines` (`billingInvoiceId`,`lineType`);--> statement-breakpoint
CREATE INDEX `billing_invoice_lookup_idx` ON `billingInvoices` (`billingAccountId`,`billingPeriodKey`,`status`);--> statement-breakpoint
CREATE INDEX `billing_revenue_share_lookup_idx` ON `billingRevenueShareRules` (`billingAccountId`,`status`,`effectiveFrom`);