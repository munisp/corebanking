CREATE TABLE `auditEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` varchar(64) NOT NULL,
	`timestampAt` timestamp NOT NULL DEFAULT (now()),
	`actorRole` varchar(64) NOT NULL,
	`actorId` varchar(96) NOT NULL,
	`entityType` varchar(96) NOT NULL,
	`entityId` varchar(96) NOT NULL,
	`action` varchar(96) NOT NULL,
	`outcome` text NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL,
	`route` varchar(191) NOT NULL,
	`middleware` json NOT NULL,
	`detail` text NOT NULL,
	CONSTRAINT `auditEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `auditEntries_auditId_unique` UNIQUE(`auditId`)
);
--> statement-breakpoint
CREATE TABLE `customerApprovals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`approvalId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`entityType` enum('card_control','scheduled_bill','statement_export') NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`title` varchar(191) NOT NULL,
	`detail` text NOT NULL,
	`route` varchar(191) NOT NULL,
	`state` enum('pending','approved','rejected') NOT NULL,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`requestedByRole` varchar(64) NOT NULL,
	`requestedById` varchar(96) NOT NULL,
	`approvalRole` varchar(64) NOT NULL,
	`resolvedAt` timestamp,
	`resolutionNote` text,
	CONSTRAINT `customerApprovals_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerApprovals_approvalId_unique` UNIQUE(`approvalId`)
);
--> statement-breakpoint
CREATE TABLE `customerBillPayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`category` enum('electricity','water','internet','school','airtime') NOT NULL,
	`provider` varchar(191) NOT NULL,
	`amount` double NOT NULL DEFAULT 0,
	`status` enum('scheduled','paid','pending') NOT NULL,
	`paidAt` timestamp NOT NULL DEFAULT (now()),
	`reference` varchar(128) NOT NULL,
	`billerId` varchar(96),
	`customerReference` varchar(128),
	`customerName` varchar(191),
	`scheduledFor` timestamp,
	`evidenceStatus` enum('verified','ready','scheduled'),
	`channel` enum('self-service','saved-biller','operator-assisted'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerBillPayments_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerBillPayments_paymentId_unique` UNIQUE(`paymentId`)
);
--> statement-breakpoint
CREATE TABLE `customerCardEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`title` varchar(191) NOT NULL,
	`detail` text NOT NULL,
	`severity` enum('info','warning','success') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerCardEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerCardEvents_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `customerCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`cardType` enum('virtual','physical') NOT NULL,
	`brand` enum('visa','mastercard') NOT NULL,
	`lastFour` varchar(4) NOT NULL,
	`expiryDate` varchar(16) NOT NULL,
	`cardHolder` varchar(191) NOT NULL,
	`balance` double NOT NULL DEFAULT 0,
	`isLocked` int NOT NULL DEFAULT 0,
	`controls` json NOT NULL,
	`spendingLimits` json NOT NULL,
	`colorTone` enum('blue','graphite') NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerCards_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerCards_cardId_unique` UNIQUE(`cardId`)
);
--> statement-breakpoint
CREATE TABLE `customerNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`title` varchar(191) NOT NULL,
	`message` text NOT NULL,
	`notificationType` enum('info','success','warning','error') NOT NULL,
	`isRead` int NOT NULL DEFAULT 0,
	`actionUrl` varchar(191),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerNotifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerNotifications_notificationId_unique` UNIQUE(`notificationId`)
);
--> statement-breakpoint
CREATE TABLE `customerSavedBillers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billerRecordId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`category` enum('electricity','water','internet','school','airtime') NOT NULL,
	`provider` varchar(191) NOT NULL,
	`billerId` varchar(96) NOT NULL,
	`customerReference` varchar(128) NOT NULL,
	`nickname` varchar(128) NOT NULL,
	`lastAmount` double NOT NULL DEFAULT 0,
	`verifiedName` varchar(191),
	`lastPaidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerSavedBillers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerSavedBillers_billerRecordId_unique` UNIQUE(`billerRecordId`)
);
--> statement-breakpoint
CREATE TABLE `customerStatementExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exportRequestId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`exportJobId` varchar(64) NOT NULL,
	`format` enum('csv','xlsx') NOT NULL,
	`rowCount` int NOT NULL DEFAULT 0,
	`title` varchar(191) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerStatementExports_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerStatementExports_exportRequestId_unique` UNIQUE(`exportRequestId`)
);
--> statement-breakpoint
CREATE TABLE `customerStatements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`statementId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`title` varchar(191) NOT NULL,
	`detail` text NOT NULL,
	`amount` double NOT NULL DEFAULT 0,
	`direction` enum('credit','debit') NOT NULL,
	`statementType` enum('transfer','bill_payment','workflow','deposit') NOT NULL,
	`status` enum('completed','pending','prepared') NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`reference` varchar(128),
	`category` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerStatements_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerStatements_statementId_unique` UNIQUE(`statementId`)
);
--> statement-breakpoint
CREATE TABLE `customerTransfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`beneficiaryId` varchar(64),
	`beneficiaryName` varchar(191) NOT NULL,
	`amount` double NOT NULL DEFAULT 0,
	`narration` text,
	`transferType` enum('bank','wallet','workflow') NOT NULL,
	`status` enum('draft','otp_pending','submitted','completed','failed') NOT NULL,
	`bankCode` varchar(32),
	`bankName` varchar(96),
	`accountNumber` varchar(32),
	`accountName` varchar(191),
	`workflowId` varchar(64),
	`otpReference` varchar(64),
	`otpIssuedAt` timestamp,
	`confirmedAt` timestamp,
	`approvalState` enum('not_required','pending_review','approved'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerTransfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerTransfers_transferId_unique` UNIQUE(`transferId`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`name` varchar(191) NOT NULL,
	`segment` varchar(96) NOT NULL,
	`tier` varchar(64) NOT NULL,
	`location` varchar(128) NOT NULL,
	`relationshipManager` varchar(128) NOT NULL,
	`risk` varchar(64) NOT NULL,
	`status` enum('Active','Pending','Review','Dormant') NOT NULL,
	`bvn` varchar(32) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`balance` double NOT NULL DEFAULT 0,
	`lastTouchpointLabel` varchar(128) NOT NULL,
	`lastTouchpointAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_customerId_unique` UNIQUE(`customerId`)
);
--> statement-breakpoint
CREATE TABLE `exportJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exportJobId` varchar(64) NOT NULL,
	`domainKey` varchar(96) NOT NULL,
	`title` varchar(191) NOT NULL,
	`format` enum('csv','json','xlsx') NOT NULL,
	`status` enum('Ready','Queued','Failed') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`requestedByRole` varchar(64) NOT NULL,
	`route` varchar(191) NOT NULL,
	`rowCount` int NOT NULL DEFAULT 0,
	`approvalState` enum('Signed','Pending review') NOT NULL,
	`approvalSignature` varchar(191) NOT NULL,
	`downloadUrl` varchar(255) NOT NULL,
	`retainedUntil` timestamp,
	`reportVersion` varchar(96),
	`approvalChain` json NOT NULL,
	`signedBy` json NOT NULL,
	CONSTRAINT `exportJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `exportJobs_exportJobId_unique` UNIQUE(`exportJobId`)
);
--> statement-breakpoint
CREATE TABLE `operatorActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actionId` varchar(64) NOT NULL,
	`domainKey` varchar(96) NOT NULL,
	`title` varchar(191) NOT NULL,
	`detail` text NOT NULL,
	`owner` varchar(128) NOT NULL,
	`dueAt` timestamp NOT NULL,
	`route` varchar(191) NOT NULL,
	`status` enum('Pending','In progress','Done') NOT NULL,
	`roles` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operatorActions_id` PRIMARY KEY(`id`),
	CONSTRAINT `operatorActions_actionId_unique` UNIQUE(`actionId`)
);
--> statement-breakpoint
CREATE TABLE `tenantFeatureFlags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`featureKey` varchar(96) NOT NULL,
	`label` varchar(191) NOT NULL,
	`category` enum('onboarding','payments','cards','operations','compliance','platform') NOT NULL,
	`description` text NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`rolloutStage` enum('pilot','controlled','general') NOT NULL,
	`adminManaged` int NOT NULL DEFAULT 1,
	`dependsOn` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenantFeatureFlags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`name` varchar(191) NOT NULL,
	`onboardingStatus` enum('draft','active','restricted') NOT NULL,
	`segment` enum('retail','operations','growth') NOT NULL,
	`region` varchar(96) NOT NULL,
	`enabledModules` json NOT NULL,
	`whiteLabel` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_tenantId_unique` UNIQUE(`tenantId`)
);
--> statement-breakpoint
CREATE TABLE `workflowCases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` varchar(64) NOT NULL,
	`customer` varchar(191) NOT NULL,
	`product` varchar(128) NOT NULL,
	`stage` varchar(128) NOT NULL,
	`status` varchar(64) NOT NULL,
	`channel` varchar(96) NOT NULL,
	`amount` double NOT NULL DEFAULT 0,
	`nextAction` text NOT NULL,
	`slaHours` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflowCases_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflowCases_workflowId_unique` UNIQUE(`workflowId`)
);
