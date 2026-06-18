ALTER TABLE `customerSessionPreferences` ADD CONSTRAINT `session_actor_lookup_idx` UNIQUE(`actorId`,`actorRole`,`tenantId`);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customer_bvn_idx` UNIQUE(`bvn`);--> statement-breakpoint
ALTER TABLE `tenantFeatureFlags` ADD CONSTRAINT `tenant_feature_lookup_idx` UNIQUE(`tenantId`,`featureKey`);--> statement-breakpoint
CREATE INDEX `audit_route_timestamp_idx` ON `auditEntries` (`route`,`timestampAt`);--> statement-breakpoint
CREATE INDEX `audit_severity_timestamp_idx` ON `auditEntries` (`severity`,`timestampAt`);--> statement-breakpoint
CREATE INDEX `approval_customer_state_idx` ON `customerApprovals` (`customerId`,`state`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `approval_role_state_idx` ON `customerApprovals` (`approvalRole`,`state`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `notification_customer_read_idx` ON `customerNotifications` (`customerId`,`isRead`,`createdAt`);--> statement-breakpoint
CREATE INDEX `statement_customer_occurred_idx` ON `customerStatements` (`customerId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `statement_customer_type_idx` ON `customerStatements` (`customerId`,`statementType`,`status`);--> statement-breakpoint
CREATE INDEX `transfer_customer_status_idx` ON `customerTransfers` (`customerId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `transfer_approval_idx` ON `customerTransfers` (`customerId`,`approvalState`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `transfer_otp_idx` ON `customerTransfers` (`otpReference`,`status`);--> statement-breakpoint
CREATE INDEX `customer_tenant_status_idx` ON `customers` (`tenantId`,`status`,`segment`);--> statement-breakpoint
CREATE INDEX `customer_manager_touchpoint_idx` ON `customers` (`relationshipManager`,`lastTouchpointAt`);--> statement-breakpoint
CREATE INDEX `export_domain_approval_idx` ON `exportJobs` (`domainKey`,`approvalState`,`createdAt`);--> statement-breakpoint
CREATE INDEX `export_route_status_idx` ON `exportJobs` (`route`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `operator_domain_status_idx` ON `operatorActions` (`domainKey`,`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `operator_route_status_idx` ON `operatorActions` (`route`,`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `partner_approval_state_idx` ON `partnerApprovalRecords` (`partnerId`,`state`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `partner_approval_role_idx` ON `partnerApprovalRecords` (`requiredRole`,`state`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `partner_tenant_stage_idx` ON `partnerOnboardingRecords` (`tenantId`,`stage`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `partner_readiness_idx` ON `partnerOnboardingRecords` (`stage`,`readinessScore`);--> statement-breakpoint
CREATE INDEX `tenant_feature_category_idx` ON `tenantFeatureFlags` (`tenantId`,`category`,`enabled`);--> statement-breakpoint
CREATE INDEX `workflow_stage_status_idx` ON `workflowCases` (`stage`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `workflow_product_status_idx` ON `workflowCases` (`product`,`status`,`createdAt`);