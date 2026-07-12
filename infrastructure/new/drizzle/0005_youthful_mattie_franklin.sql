CREATE TABLE `billingAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingAccountId` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`accountName` varchar(191) NOT NULL,
	`billingModel` enum('subscription','usage','hybrid','revenue_share') NOT NULL,
	`currency` varchar(3) NOT NULL,
	`status` enum('draft','active','suspended','closed') NOT NULL,
	`contractStartAt` timestamp NOT NULL,
	`contractEndAt` timestamp,
	`defaultRateCardId` varchar(64) NOT NULL,
	`minimumCommitAmount` double NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingAccounts_billingAccountId_unique` UNIQUE(`billingAccountId`)
);
--> statement-breakpoint
CREATE TABLE `billingAccrualSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accrualSnapshotId` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`billingAccountId` varchar(64) NOT NULL,
	`billingPeriodKey` varchar(32) NOT NULL,
	`meterKey` varchar(96) NOT NULL,
	`productKey` varchar(96) NOT NULL,
	`ratedEventCount` int NOT NULL DEFAULT 0,
	`usageQuantity` int NOT NULL DEFAULT 0,
	`accruedAmount` double NOT NULL DEFAULT 0,
	`unratedEventCount` int NOT NULL DEFAULT 0,
	`lastUsageAt` timestamp,
	`lastRatedAt` timestamp,
	`snapshotStatus` enum('healthy','lagging','review') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingAccrualSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingAccrualSnapshots_accrualSnapshotId_unique` UNIQUE(`accrualSnapshotId`)
);
--> statement-breakpoint
CREATE TABLE `billingRateCardLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rateCardLineId` varchar(64) NOT NULL,
	`rateCardId` varchar(64) NOT NULL,
	`meterKey` varchar(96) NOT NULL,
	`productKey` varchar(96) NOT NULL,
	`chargeType` enum('flat','per_unit','tiered','minimum','percentage') NOT NULL,
	`unitPrice` double NOT NULL DEFAULT 0,
	`includedUnits` int NOT NULL DEFAULT 0,
	`tierStart` int,
	`tierEnd` int,
	`minimumCharge` double,
	`maximumCharge` double,
	`pricingFormula` json,
	`settlementLedgerCode` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingRateCardLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingRateCardLines_rateCardLineId_unique` UNIQUE(`rateCardLineId`)
);
--> statement-breakpoint
CREATE TABLE `billingRateCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rateCardId` varchar(64) NOT NULL,
	`billingAccountId` varchar(64),
	`name` varchar(191) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('draft','approved','active','retired') NOT NULL,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`pricingCurrency` varchar(3) NOT NULL,
	`createdBy` varchar(96) NOT NULL,
	`approvalState` enum('pending','approved','rejected') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingRateCards_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingRateCards_rateCardId_unique` UNIQUE(`rateCardId`)
);
--> statement-breakpoint
CREATE TABLE `billingRatedEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ratedEventId` varchar(64) NOT NULL,
	`usageEventId` varchar(64) NOT NULL,
	`rateCardId` varchar(64) NOT NULL,
	`rateCardLineId` varchar(64) NOT NULL,
	`billingPeriodKey` varchar(32) NOT NULL,
	`quantityRated` int NOT NULL DEFAULT 0,
	`billableUnits` double NOT NULL DEFAULT 0,
	`amountAccrued` double NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL,
	`ratingExplanation` json NOT NULL,
	`ratedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billingRatedEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingRatedEvents_ratedEventId_unique` UNIQUE(`ratedEventId`)
);
--> statement-breakpoint
CREATE TABLE `billingUsageEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usageEventId` varchar(64) NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`billingAccountId` varchar(64) NOT NULL,
	`sourceService` varchar(96) NOT NULL,
	`sourceEventType` varchar(96) NOT NULL,
	`meterKey` varchar(96) NOT NULL,
	`productKey` varchar(96) NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`unitAmount` double,
	`currency` varchar(3) NOT NULL,
	`eventTimestamp` timestamp NOT NULL,
	`ingestedAt` timestamp NOT NULL DEFAULT (now()),
	`correlationId` varchar(128),
	`actorId` varchar(96),
	`resourceId` varchar(96),
	`payload` json NOT NULL,
	`status` enum('pending','rated','ignored','failed') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billingUsageEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingUsageEvents_usageEventId_unique` UNIQUE(`usageEventId`),
	CONSTRAINT `billing_usage_idempotency_idx` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `billing_account_tenant_idx` ON `billingAccounts` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `billing_accrual_tenant_idx` ON `billingAccrualSnapshots` (`tenantId`,`billingPeriodKey`,`accruedAmount`);--> statement-breakpoint
CREATE INDEX `billing_accrual_meter_idx` ON `billingAccrualSnapshots` (`meterKey`,`productKey`,`billingPeriodKey`);--> statement-breakpoint
CREATE INDEX `billing_rate_card_line_lookup_idx` ON `billingRateCardLines` (`rateCardId`,`meterKey`,`productKey`);--> statement-breakpoint
CREATE INDEX `billing_rate_card_lookup_idx` ON `billingRateCards` (`billingAccountId`,`status`,`effectiveFrom`);--> statement-breakpoint
CREATE INDEX `billing_rated_event_lookup_idx` ON `billingRatedEvents` (`billingPeriodKey`,`rateCardId`,`ratedAt`);--> statement-breakpoint
CREATE INDEX `billing_usage_tenant_idx` ON `billingUsageEvents` (`tenantId`,`eventTimestamp`);--> statement-breakpoint
CREATE INDEX `billing_usage_meter_idx` ON `billingUsageEvents` (`meterKey`,`productKey`,`eventTimestamp`);