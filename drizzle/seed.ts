/**
 * 54Bank Platform — Drizzle ORM Seed Script
 * Seeds all 267 tables with 3 rows of realistic Nigerian banking data
 * Usage: npx tsx drizzle/seed.ts
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function seed() {
  await client.connect();
  const db = drizzle(client, { schema });
  console.log("Seeding 267 tables...");

  // users
  await db.insert(schema.users).values([
    { openId: "01b22493-1fff-16f9-22d1-0078c545e8a0", name: "Halima Abdullahi", email: "yetunde.olowe@54bank.ng", loginMethod: "ussd", role: "user" },
    { openId: "0244356d-10b5-077d-23a0-00e445d774ef", name: "Kano Textiles Ltd", email: "yetunde.olowe@54bank.ng", loginMethod: "bank_transfer", role: "branch_manager" },
    { openId: "04b8da34-16ac-1e74-1563-003bd3b7830d", name: "Ngozi Okafor", email: "ibrahim.musa@54bank.ng", loginMethod: "ussd", role: "user" },
  ]).onConflictDoNothing();
  console.log("  seeded: users");

  // tenants
  await db.insert(schema.tenants).values([
    { tenantId: "tenant-lagos-main", name: "Samuel Eze", onboardingStatus: "rejected", segment: "retail", region: "Nigeria", enabledModules: ["core_banking", "payments", "kyc", "aml"], whiteLabel: {"displayName": "54Bank", "primaryColor": "#1a5276"} },
    { tenantId: "tenant-kano-north", name: "Emeka & Sons Trading", onboardingStatus: "active", segment: "corporate", region: "Nigeria", enabledModules: ["core_banking", "payments", "kyc", "aml"], whiteLabel: {"displayName": "54Bank", "primaryColor": "#1a5276"} },
    { tenantId: "tenant-lagos-main", name: "Amina Yusuf", onboardingStatus: "rejected", segment: "corporate", region: "Nigeria", enabledModules: ["core_banking", "payments", "kyc", "aml"], whiteLabel: {"displayName": "54Bank", "primaryColor": "#1a5276"} },
  ]).onConflictDoNothing();
  console.log("  seeded: tenants");

  // tenantFeatureFlags
  await db.insert(schema.tenantFeatureFlags).values([
    { tenantId: "tenant-ph-south", featureKey: "tenantFe_featurekey_1", label: "tenantFeatureFlags_label_1", category: "standard", description: "54Bank tenantFeatureFlags record 1", enabled: 4, rolloutStage: "tenantFeatureFlags_rolloutstage_1", adminManaged: 90, dependsOn: {"key": "value"} },
    { tenantId: "tenant-abuja-hq", featureKey: "tenantFe_featurekey_2", label: "tenantFeatureFlags_label_2", category: "premium", description: "54Bank tenantFeatureFlags record 2", enabled: 49, rolloutStage: "tenantFeatureFlags_rolloutstage_2", adminManaged: 75, dependsOn: {"key": "value"} },
    { tenantId: "tenant-abuja-hq", featureKey: "tenantFe_featurekey_3", label: "tenantFeatureFlags_label_3", category: "premium", description: "54Bank tenantFeatureFlags record 3", enabled: 31, rolloutStage: "tenantFeatureFlags_rolloutstage_3", adminManaged: 32, dependsOn: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: tenantFeatureFlags");

  // customers
  await db.insert(schema.customers).values([
    { customerId: "customer_customerid_1", tenantId: "tenant-lagos-main", name: "Obinna Chukwu", segment: "corporate", tier: "tier_2", location: "Anambra", relationshipManager: "customers_relationshipmanager_1", risk: "customers_risk_1", status: "completed", bvn: "22558572819", phone: "+2347833857384", balance: 447172979.1, lastTouchpointLabel: "customers_lasttouchpointlabel_1" },
    { customerId: "customer_customerid_2", tenantId: "tenant-kano-north", name: "Kano Textiles Ltd", segment: "retail", tier: "tier_2", location: "Imo", relationshipManager: "customers_relationshipmanager_2", risk: "customers_risk_2", status: "pending", bvn: "22331844167", phone: "+2347761872592", balance: 241996276.9, lastTouchpointLabel: "customers_lasttouchpointlabel_2" },
    { customerId: "customer_customerid_3", tenantId: "tenant-kano-north", name: "Fatima Hassan", segment: "retail", tier: "tier_3", location: "Oyo", relationshipManager: "customers_relationshipmanager_3", risk: "customers_risk_3", status: "completed", bvn: "22346868384", phone: "+2348082986997", balance: 231530522.07, lastTouchpointLabel: "customers_lasttouchpointlabel_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: customers");

  // customerCards
  await db.insert(schema.customerCards).values([
    { cardId: "customer_cardid_1", customerId: "customer_customerid_1", cardType: "standard", brand: "customerCards_brand_1", lastFour: "customerCards_lastfour_1", expiryDate: "customerCards_expirydate_1", cardHolder: "customerCards_cardholder_1", balance: 464796658.46, isLocked: 100, controls: {"key": "value"}, spendingLimits: {"key": "value"}, colorTone: "customerCards_colortone_1" },
    { cardId: "customer_cardid_2", customerId: "customer_customerid_2", cardType: "premium", brand: "customerCards_brand_2", lastFour: "customerCards_lastfour_2", expiryDate: "customerCards_expirydate_2", cardHolder: "customerCards_cardholder_2", balance: 295653840.32, isLocked: 65, controls: {"key": "value"}, spendingLimits: {"key": "value"}, colorTone: "customerCards_colortone_2" },
    { cardId: "customer_cardid_3", customerId: "customer_customerid_3", cardType: "premium", brand: "customerCards_brand_3", lastFour: "customerCards_lastfour_3", expiryDate: "customerCards_expirydate_3", cardHolder: "customerCards_cardholder_3", balance: 159510445.97, isLocked: 99, controls: {"key": "value"}, spendingLimits: {"key": "value"}, colorTone: "customerCards_colortone_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: customerCards");

  // customerCardEvents
  await db.insert(schema.customerCardEvents).values([
    { eventId: "customer_eventid_1", cardId: "customer_cardid_1", customerId: "customer_customerid_1", title: "customerCardEvents_title_1", detail: "54Bank customerCardEvents record 1", severity: "customerCardEvents_severity_1" },
    { eventId: "customer_eventid_2", cardId: "customer_cardid_2", customerId: "customer_customerid_2", title: "customerCardEvents_title_2", detail: "54Bank customerCardEvents record 2", severity: "customerCardEvents_severity_2" },
    { eventId: "customer_eventid_3", cardId: "customer_cardid_3", customerId: "customer_customerid_3", title: "customerCardEvents_title_3", detail: "54Bank customerCardEvents record 3", severity: "customerCardEvents_severity_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: customerCardEvents");

  // customerSavedBillers
  await db.insert(schema.customerSavedBillers).values([
    { billerRecordId: "customer_billerrecordid_1", customerId: "customer_customerid_1", category: "standard", provider: "customer_provider_1", billerId: "customer_billerid_1", customerReference: "54B-CUST-201957", nickname: "customerSavedBillers_nickname_1", lastAmount: 302314011.97, verifiedName: "customerSavedBillers_verifiedname_1", lastPaidAt: new Date("2025-10-30 00:00:00") },
    { billerRecordId: "customer_billerrecordid_2", customerId: "customer_customerid_2", category: "premium", provider: "customer_provider_2", billerId: "customer_billerid_2", customerReference: "54B-CUST-541597", nickname: "customerSavedBillers_nickname_2", lastAmount: 199979673.65, verifiedName: "customerSavedBillers_verifiedname_2", lastPaidAt: new Date("2025-10-06 00:00:00") },
    { billerRecordId: "customer_billerrecordid_3", customerId: "customer_customerid_3", category: "premium", provider: "customer_provider_3", billerId: "customer_billerid_3", customerReference: "54B-CUST-432479", nickname: "customerSavedBillers_nickname_3", lastAmount: 242467977.4, verifiedName: "customerSavedBillers_verifiedname_3", lastPaidAt: new Date("2025-07-23 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: customerSavedBillers");

  // customerBillPayments
  await db.insert(schema.customerBillPayments).values([
    { paymentId: "customer_paymentid_1", customerId: "customer_customerid_1", category: "standard", provider: "customer_provider_1", amount: 70417269.64, status: "approved", reference: "54B-CUST-456031", billerId: "customer_billerid_1", customerReference: "54B-CUST-584040", customerName: "customerBillPayments_customername_1", scheduledFor: new Date("2026-01-06 00:00:00"), evidenceStatus: "approved", channel: "customerBillPayments_channel_1" },
    { paymentId: "customer_paymentid_2", customerId: "customer_customerid_2", category: "basic", provider: "customer_provider_2", amount: 66026279.13, status: "pending", reference: "54B-CUST-392420", billerId: "customer_billerid_2", customerReference: "54B-CUST-844945", customerName: "customerBillPayments_customername_2", scheduledFor: new Date("2026-03-11 00:00:00"), evidenceStatus: "approved", channel: "customerBillPayments_channel_2" },
    { paymentId: "customer_paymentid_3", customerId: "customer_customerid_3", category: "basic", provider: "customer_provider_3", amount: 351642949.25, status: "pending", reference: "54B-CUST-833084", billerId: "customer_billerid_3", customerReference: "54B-CUST-401565", customerName: "customerBillPayments_customername_3", scheduledFor: new Date("2026-03-21 00:00:00"), evidenceStatus: "completed", channel: "customerBillPayments_channel_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: customerBillPayments");

  // customerTransfers
  await db.insert(schema.customerTransfers).values([
    { transferId: "customer_transferid_1", customerId: "customer_customerid_1", beneficiaryId: "customer_beneficiaryid_1", beneficiaryName: "customerTransfers_beneficiaryname_1", amount: 480335087.96, narration: "customerTransfers_narration_1", transferType: "standard", status: "inactive", bankCode: "customer_bankcode_1", bankName: "customerTransfers_bankname_1", accountNumber: "5489511724", accountName: "customerTransfers_accountname_1", workflowId: "customer_workflowid_1", otpReference: "54B-CUST-228948", otpIssuedAt: new Date("2026-02-25 00:00:00"), confirmedAt: new Date("2026-02-12 00:00:00"), approvalState: "Rivers" },
    { transferId: "customer_transferid_2", customerId: "customer_customerid_2", beneficiaryId: "customer_beneficiaryid_2", beneficiaryName: "customerTransfers_beneficiaryname_2", amount: 279207612.08, narration: "customerTransfers_narration_2", transferType: "standard", status: "inactive", bankCode: "customer_bankcode_2", bankName: "customerTransfers_bankname_2", accountNumber: "5437035507", accountName: "customerTransfers_accountname_2", workflowId: "customer_workflowid_2", otpReference: "54B-CUST-759899", otpIssuedAt: new Date("2025-11-25 00:00:00"), confirmedAt: new Date("2025-12-03 00:00:00"), approvalState: "Ogun" },
    { transferId: "customer_transferid_3", customerId: "customer_customerid_3", beneficiaryId: "customer_beneficiaryid_3", beneficiaryName: "customerTransfers_beneficiaryname_3", amount: 108098034.67, narration: "customerTransfers_narration_3", transferType: "premium", status: "pending", bankCode: "customer_bankcode_3", bankName: "customerTransfers_bankname_3", accountNumber: "5488446874", accountName: "customerTransfers_accountname_3", workflowId: "customer_workflowid_3", otpReference: "54B-CUST-190323", otpIssuedAt: new Date("2025-08-21 00:00:00"), confirmedAt: new Date("2026-04-25 00:00:00"), approvalState: "Lagos" },
  ]).onConflictDoNothing();
  console.log("  seeded: customerTransfers");

  // customerApprovals
  await db.insert(schema.customerApprovals).values([
    { approvalId: "customer_approvalid_1", customerId: "customer_customerid_1", entityType: "standard", entityId: "customer_entityid_1", title: "customerApprovals_title_1", detail: "54Bank customerApprovals record 1", route: "customerApprovals_route_1", state: "Abuja", requestedByRole: "branch_manager", requestedById: "customer_requestedbyid_1", approvalRole: "user", resolvedAt: new Date("2025-09-16 00:00:00"), resolutionNote: "54Bank customerApprovals record 1" },
    { approvalId: "customer_approvalid_2", customerId: "customer_customerid_2", entityType: "premium", entityId: "customer_entityid_2", title: "customerApprovals_title_2", detail: "54Bank customerApprovals record 2", route: "customerApprovals_route_2", state: "Imo", requestedByRole: "branch_manager", requestedById: "customer_requestedbyid_2", approvalRole: "admin", resolvedAt: new Date("2026-01-18 00:00:00"), resolutionNote: "54Bank customerApprovals record 2" },
    { approvalId: "customer_approvalid_3", customerId: "customer_customerid_3", entityType: "standard", entityId: "customer_entityid_3", title: "customerApprovals_title_3", detail: "54Bank customerApprovals record 3", route: "customerApprovals_route_3", state: "Oyo", requestedByRole: "user", requestedById: "customer_requestedbyid_3", approvalRole: "user", resolvedAt: new Date("2026-02-22 00:00:00"), resolutionNote: "54Bank customerApprovals record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: customerApprovals");

  // customerStatementExports
  await db.insert(schema.customerStatementExports).values([
    { exportRequestId: "customer_exportrequestid_1", customerId: "customer_customerid_1", exportJobId: "customer_exportjobid_1", format: "customerStatementExports_format_1", rowCount: 110, title: "customerStatementExports_title_1" },
    { exportRequestId: "customer_exportrequestid_2", customerId: "customer_customerid_2", exportJobId: "customer_exportjobid_2", format: "customerStatementExports_format_2", rowCount: 59, title: "customerStatementExports_title_2" },
    { exportRequestId: "customer_exportrequestid_3", customerId: "customer_customerid_3", exportJobId: "customer_exportjobid_3", format: "customerStatementExports_format_3", rowCount: 210, title: "customerStatementExports_title_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: customerStatementExports");

  // customerStatements
  await db.insert(schema.customerStatements).values([
    { statementId: "Imo", customerId: "customer_customerid_1", title: "customerStatements_title_1", detail: "54Bank customerStatements record 1", amount: 381600721.12, direction: "customerStatements_direction_1", statementType: "Enugu", status: "active", reference: "54B-CUST-508677", category: "basic" },
    { statementId: "Enugu", customerId: "customer_customerid_2", title: "customerStatements_title_2", detail: "54Bank customerStatements record 2", amount: 466074293.03, direction: "customerStatements_direction_2", statementType: "Kaduna", status: "rejected", reference: "54B-CUST-488913", category: "standard" },
    { statementId: "Oyo", customerId: "customer_customerid_3", title: "customerStatements_title_3", detail: "54Bank customerStatements record 3", amount: 323723143.46, direction: "customerStatements_direction_3", statementType: "Anambra", status: "active", reference: "54B-CUST-526560", category: "standard" },
  ]).onConflictDoNothing();
  console.log("  seeded: customerStatements");

  // customerNotifications
  await db.insert(schema.customerNotifications).values([
    { notificationId: "customer_notificationid_1", customerId: "customer_customerid_1", title: "customerNotifications_title_1", message: "customerNotifications_message_1", notificationType: "premium", isRead: 68, actionUrl: "https://api.54bank.ng/v1/customerNotifications/1" },
    { notificationId: "customer_notificationid_2", customerId: "customer_customerid_2", title: "customerNotifications_title_2", message: "customerNotifications_message_2", notificationType: "premium", isRead: 3, actionUrl: "https://api.54bank.ng/v1/customerNotifications/2" },
    { notificationId: "customer_notificationid_3", customerId: "customer_customerid_3", title: "customerNotifications_title_3", message: "customerNotifications_message_3", notificationType: "standard", isRead: 22, actionUrl: "https://api.54bank.ng/v1/customerNotifications/3" },
  ]).onConflictDoNothing();
  console.log("  seeded: customerNotifications");

  // customerSessionPreferences
  await db.insert(schema.customerSessionPreferences).values([
    { actorId: "customer_actorid_1", actorRole: "teller", tenantId: "tenant-ph-south", activeCustomerId: "customer_activecustomerid_1" },
    { actorId: "customer_actorid_2", actorRole: "branch_manager", tenantId: "tenant-lagos-main", activeCustomerId: "customer_activecustomerid_2" },
    { actorId: "customer_actorid_3", actorRole: "admin", tenantId: "tenant-abuja-hq", activeCustomerId: "customer_activecustomerid_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: customerSessionPreferences");

  // workflowCases
  await db.insert(schema.workflowCases).values([
    { workflowId: "workflow_workflowid_1", customer: "workflowCases_customer_1", product: "workflowCases_product_1", stage: "workflowCases_stage_1", status: "pending", channel: "workflowCases_channel_1", amount: 56650183.17, nextAction: "workflowCases_nextaction_1", slaHours: 82 },
    { workflowId: "workflow_workflowid_2", customer: "workflowCases_customer_2", product: "workflowCases_product_2", stage: "workflowCases_stage_2", status: "rejected", channel: "workflowCases_channel_2", amount: 437664121.18, nextAction: "workflowCases_nextaction_2", slaHours: 71 },
    { workflowId: "workflow_workflowid_3", customer: "workflowCases_customer_3", product: "workflowCases_product_3", stage: "workflowCases_stage_3", status: "active", channel: "workflowCases_channel_3", amount: 163707676.23, nextAction: "workflowCases_nextaction_3", slaHours: 88 },
  ]).onConflictDoNothing();
  console.log("  seeded: workflowCases");

  // operatorActions
  await db.insert(schema.operatorActions).values([
    { actionId: "operator_actionid_1", domainKey: "operator_domainkey_1", title: "operatorActions_title_1", detail: "54Bank operatorActions record 1", owner: "operatorActions_owner_1", dueAt: new Date("2026-04-06 00:00:00"), route: "operatorActions_route_1", status: "approved", roles: {"key": "value"} },
    { actionId: "operator_actionid_2", domainKey: "operator_domainkey_2", title: "operatorActions_title_2", detail: "54Bank operatorActions record 2", owner: "operatorActions_owner_2", dueAt: new Date("2025-05-29 00:00:00"), route: "operatorActions_route_2", status: "inactive", roles: {"key": "value"} },
    { actionId: "operator_actionid_3", domainKey: "operator_domainkey_3", title: "operatorActions_title_3", detail: "54Bank operatorActions record 3", owner: "operatorActions_owner_3", dueAt: new Date("2025-09-23 00:00:00"), route: "operatorActions_route_3", status: "active", roles: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: operatorActions");

  // auditEntries
  await db.insert(schema.auditEntries).values([
    { auditId: "auditEnt_auditid_1", actorRole: "branch_manager", actorId: "auditEnt_actorid_1", entityType: "premium", entityId: "auditEnt_entityid_1", action: "auditEntries_action_1", outcome: "auditEntries_outcome_1", severity: "auditEntries_severity_1", route: "auditEntries_route_1", middleware: {"key": "value"}, detail: "54Bank auditEntries record 1" },
    { auditId: "auditEnt_auditid_2", actorRole: "user", actorId: "auditEnt_actorid_2", entityType: "standard", entityId: "auditEnt_entityid_2", action: "auditEntries_action_2", outcome: "auditEntries_outcome_2", severity: "auditEntries_severity_2", route: "auditEntries_route_2", middleware: {"key": "value"}, detail: "54Bank auditEntries record 2" },
    { auditId: "auditEnt_auditid_3", actorRole: "user", actorId: "auditEnt_actorid_3", entityType: "basic", entityId: "auditEnt_entityid_3", action: "auditEntries_action_3", outcome: "auditEntries_outcome_3", severity: "auditEntries_severity_3", route: "auditEntries_route_3", middleware: {"key": "value"}, detail: "54Bank auditEntries record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: auditEntries");

  // exportJobs
  await db.insert(schema.exportJobs).values([
    { exportJobId: "exportJo_exportjobid_1", domainKey: "exportJo_domainkey_1", title: "exportJobs_title_1", format: "exportJobs_format_1", status: "approved", requestedByRole: "teller", route: "exportJobs_route_1", rowCount: 496, approvalState: "Ogun", approvalSignature: "exportJobs_approvalsignature_1", downloadUrl: "https://api.54bank.ng/v1/exportJobs/1", retainedUntil: new Date("2025-09-25 00:00:00"), reportVersion: "exportJobs_reportversion_1", approvalChain: {"key": "value"}, signedBy: {"key": "value"} },
    { exportJobId: "exportJo_exportjobid_2", domainKey: "exportJo_domainkey_2", title: "exportJobs_title_2", format: "exportJobs_format_2", status: "pending", requestedByRole: "teller", route: "exportJobs_route_2", rowCount: 431, approvalState: "Enugu", approvalSignature: "exportJobs_approvalsignature_2", downloadUrl: "https://api.54bank.ng/v1/exportJobs/2", retainedUntil: new Date("2025-05-19 00:00:00"), reportVersion: "exportJobs_reportversion_2", approvalChain: {"key": "value"}, signedBy: {"key": "value"} },
    { exportJobId: "exportJo_exportjobid_3", domainKey: "exportJo_domainkey_3", title: "exportJobs_title_3", format: "exportJobs_format_3", status: "approved", requestedByRole: "user", route: "exportJobs_route_3", rowCount: 223, approvalState: "Rivers", approvalSignature: "exportJobs_approvalsignature_3", downloadUrl: "https://api.54bank.ng/v1/exportJobs/3", retainedUntil: new Date("2025-07-19 00:00:00"), reportVersion: "exportJobs_reportversion_3", approvalChain: {"key": "value"}, signedBy: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: exportJobs");

  // billingAccounts
  await db.insert(schema.billingAccounts).values([
    { billingAccountId: "billingA_billingaccountid_1", tenantId: "tenant-kano-north", accountName: "billingAccounts_accountname_1", billingModel: "billingAccounts_billingmodel_1", currency: "NGN", status: "completed", contractStartAt: new Date("2026-04-28 00:00:00"), contractEndAt: new Date("2025-09-11 00:00:00"), defaultRateCardId: "billingA_defaultratecardid_1", minimumCommitAmount: 211744097.99, defaultBillingPeriodType: "premium", invoiceDueDays: 19 },
    { billingAccountId: "billingA_billingaccountid_2", tenantId: "tenant-abuja-hq", accountName: "billingAccounts_accountname_2", billingModel: "billingAccounts_billingmodel_2", currency: "EUR", status: "approved", contractStartAt: new Date("2025-10-27 00:00:00"), contractEndAt: new Date("2026-04-21 00:00:00"), defaultRateCardId: "billingA_defaultratecardid_2", minimumCommitAmount: 215257061.44, defaultBillingPeriodType: "premium", invoiceDueDays: 46 },
    { billingAccountId: "billingA_billingaccountid_3", tenantId: "tenant-lagos-main", accountName: "billingAccounts_accountname_3", billingModel: "billingAccounts_billingmodel_3", currency: "EUR", status: "pending", contractStartAt: new Date("2025-07-11 00:00:00"), contractEndAt: new Date("2025-12-28 00:00:00"), defaultRateCardId: "billingA_defaultratecardid_3", minimumCommitAmount: 448186403.29, defaultBillingPeriodType: "premium", invoiceDueDays: 49 },
  ]).onConflictDoNothing();
  console.log("  seeded: billingAccounts");

  // billingRateCards
  await db.insert(schema.billingRateCards).values([
    { rateCardId: "billingR_ratecardid_1", billingAccountId: "billingR_billingaccountid_1", name: "Kemi Adeyemi", version: 41, status: "pending", effectiveFrom: new Date("2025-11-04 00:00:00"), effectiveTo: new Date("2025-08-17 00:00:00"), pricingCurrency: "USD", createdBy: "billingRateCards_createdby_1", approvalState: "Anambra" },
    { rateCardId: "billingR_ratecardid_2", billingAccountId: "billingR_billingaccountid_2", name: "Oando Energy", version: 36, status: "pending", effectiveFrom: new Date("2025-07-28 00:00:00"), effectiveTo: new Date("2026-03-06 00:00:00"), pricingCurrency: "NGN", createdBy: "billingRateCards_createdby_2", approvalState: "Anambra" },
    { rateCardId: "billingR_ratecardid_3", billingAccountId: "billingR_billingaccountid_3", name: "Ngozi Okafor", version: 39, status: "approved", effectiveFrom: new Date("2026-03-28 00:00:00"), effectiveTo: new Date("2025-09-07 00:00:00"), pricingCurrency: "NGN", createdBy: "billingRateCards_createdby_3", approvalState: "Oyo" },
  ]).onConflictDoNothing();
  console.log("  seeded: billingRateCards");

  // billingRateCardLines
  await db.insert(schema.billingRateCardLines).values([
    { rateCardLineId: "billingR_ratecardlineid_1", rateCardId: "billingR_ratecardid_1", meterKey: "billingR_meterkey_1", productKey: "billingR_productkey_1", chargeType: "basic", unitPrice: 15.6326, includedUnits: 1, tierStart: 5, tierEnd: 80, minimumCharge: 35.4598, maximumCharge: 3.5806, pricingFormula: {"key": "value"}, settlementLedgerCode: "billingR_settlementledgercode_1" },
    { rateCardLineId: "billingR_ratecardlineid_2", rateCardId: "billingR_ratecardid_2", meterKey: "billingR_meterkey_2", productKey: "billingR_productkey_2", chargeType: "standard", unitPrice: 74.2111, includedUnits: 74, tierStart: 23, tierEnd: 56, minimumCharge: 92.9739, maximumCharge: 55.8189, pricingFormula: {"key": "value"}, settlementLedgerCode: "billingR_settlementledgercode_2" },
    { rateCardLineId: "billingR_ratecardlineid_3", rateCardId: "billingR_ratecardid_3", meterKey: "billingR_meterkey_3", productKey: "billingR_productkey_3", chargeType: "basic", unitPrice: 6.8149, includedUnits: 40, tierStart: 76, tierEnd: 27, minimumCharge: 81.8076, maximumCharge: 30.532, pricingFormula: {"key": "value"}, settlementLedgerCode: "billingR_settlementledgercode_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: billingRateCardLines");

  // billingUsageEvents
  await db.insert(schema.billingUsageEvents).values([
    { usageEventId: "billingU_usageeventid_1", idempotencyKey: "billingU_idempotencykey_1", tenantId: "tenant-ph-south", billingAccountId: "billingU_billingaccountid_1", sourceService: "billingUsageEvents_sourceservice_1", sourceEventType: "standard", meterKey: "billingU_meterkey_1", productKey: "billingU_productkey_1", quantity: 412, unitAmount: 343210513.67, currency: "NGN", eventTimestamp: new Date("2026-01-23 00:00:00"), correlationId: "billingU_correlationid_1", actorId: "billingU_actorid_1", resourceId: "billingU_resourceid_1", payload: {"key": "value"}, status: "inactive" },
    { usageEventId: "billingU_usageeventid_2", idempotencyKey: "billingU_idempotencykey_2", tenantId: "tenant-ph-south", billingAccountId: "billingU_billingaccountid_2", sourceService: "billingUsageEvents_sourceservice_2", sourceEventType: "basic", meterKey: "billingU_meterkey_2", productKey: "billingU_productkey_2", quantity: 62, unitAmount: 243976632.01, currency: "GBP", eventTimestamp: new Date("2025-05-22 00:00:00"), correlationId: "billingU_correlationid_2", actorId: "billingU_actorid_2", resourceId: "billingU_resourceid_2", payload: {"key": "value"}, status: "inactive" },
    { usageEventId: "billingU_usageeventid_3", idempotencyKey: "billingU_idempotencykey_3", tenantId: "tenant-ph-south", billingAccountId: "billingU_billingaccountid_3", sourceService: "billingUsageEvents_sourceservice_3", sourceEventType: "premium", meterKey: "billingU_meterkey_3", productKey: "billingU_productkey_3", quantity: 295, unitAmount: 18708755.27, currency: "USD", eventTimestamp: new Date("2026-01-22 00:00:00"), correlationId: "billingU_correlationid_3", actorId: "billingU_actorid_3", resourceId: "billingU_resourceid_3", payload: {"key": "value"}, status: "completed" },
  ]).onConflictDoNothing();
  console.log("  seeded: billingUsageEvents");

  // billingRatedEvents
  await db.insert(schema.billingRatedEvents).values([
    { ratedEventId: "billingR_ratedeventid_1", usageEventId: "billingR_usageeventid_1", rateCardId: "billingR_ratecardid_1", rateCardLineId: "billingR_ratecardlineid_1", billingPeriodKey: "billingR_billingperiodkey_1", quantityRated: 376, billableUnits: 19.2787, amountAccrued: 119561145.39, currency: "USD", ratingExplanation: {"key": "value"} },
    { ratedEventId: "billingR_ratedeventid_2", usageEventId: "billingR_usageeventid_2", rateCardId: "billingR_ratecardid_2", rateCardLineId: "billingR_ratecardlineid_2", billingPeriodKey: "billingR_billingperiodkey_2", quantityRated: 462, billableUnits: 81.9008, amountAccrued: 481030520.75, currency: "EUR", ratingExplanation: {"key": "value"} },
    { ratedEventId: "billingR_ratedeventid_3", usageEventId: "billingR_usageeventid_3", rateCardId: "billingR_ratecardid_3", rateCardLineId: "billingR_ratecardlineid_3", billingPeriodKey: "billingR_billingperiodkey_3", quantityRated: 289, billableUnits: 64.705, amountAccrued: 476004285.17, currency: "GBP", ratingExplanation: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: billingRatedEvents");

  // billingAccrualSnapshots
  await db.insert(schema.billingAccrualSnapshots).values([
    { accrualSnapshotId: "billingA_accrualsnapshotid_1", tenantId: "tenant-lagos-main", billingAccountId: "billingA_billingaccountid_1", billingPeriodKey: "billingA_billingperiodkey_1", meterKey: "billingA_meterkey_1", productKey: "billingA_productkey_1", ratedEventCount: 440, usageQuantity: 138, accruedAmount: 494450845.58, unratedEventCount: 93, lastUsageAt: new Date("2025-08-21 00:00:00"), lastRatedAt: new Date("2026-02-22 00:00:00"), snapshotStatus: "completed" },
    { accrualSnapshotId: "billingA_accrualsnapshotid_2", tenantId: "tenant-kano-north", billingAccountId: "billingA_billingaccountid_2", billingPeriodKey: "billingA_billingperiodkey_2", meterKey: "billingA_meterkey_2", productKey: "billingA_productkey_2", ratedEventCount: 202, usageQuantity: 72, accruedAmount: 121728461.38, unratedEventCount: 388, lastUsageAt: new Date("2025-09-01 00:00:00"), lastRatedAt: new Date("2025-09-17 00:00:00"), snapshotStatus: "completed" },
    { accrualSnapshotId: "billingA_accrualsnapshotid_3", tenantId: "tenant-kano-north", billingAccountId: "billingA_billingaccountid_3", billingPeriodKey: "billingA_billingperiodkey_3", meterKey: "billingA_meterkey_3", productKey: "billingA_productkey_3", ratedEventCount: 430, usageQuantity: 152, accruedAmount: 277697759.85, unratedEventCount: 66, lastUsageAt: new Date("2025-12-06 00:00:00"), lastRatedAt: new Date("2026-03-13 00:00:00"), snapshotStatus: "rejected" },
  ]).onConflictDoNothing();
  console.log("  seeded: billingAccrualSnapshots");

  // billingContractOverrides
  await db.insert(schema.billingContractOverrides).values([
    { contractOverrideId: "billingC_contractoverrideid_1", billingAccountId: "billingC_billingaccountid_1", tenantId: "tenant-lagos-main", overrideType: "standard", meterKey: "billingC_meterkey_1", productKey: "billingC_productkey_1", valueNumber: 282986737.24, valueText: "billingContractOverrides_valuetext_1", effectiveFrom: new Date("2025-10-09 00:00:00"), effectiveTo: new Date("2026-03-16 00:00:00"), status: "inactive", createdBy: "billingContractOverrides_createdby_1", notes: "54Bank billingContractOverrides record 1" },
    { contractOverrideId: "billingC_contractoverrideid_2", billingAccountId: "billingC_billingaccountid_2", tenantId: "tenant-ph-south", overrideType: "premium", meterKey: "billingC_meterkey_2", productKey: "billingC_productkey_2", valueNumber: 169835576.21, valueText: "billingContractOverrides_valuetext_2", effectiveFrom: new Date("2025-12-22 00:00:00"), effectiveTo: new Date("2026-02-07 00:00:00"), status: "rejected", createdBy: "billingContractOverrides_createdby_2", notes: "54Bank billingContractOverrides record 2" },
    { contractOverrideId: "billingC_contractoverrideid_3", billingAccountId: "billingC_billingaccountid_3", tenantId: "tenant-kano-north", overrideType: "standard", meterKey: "billingC_meterkey_3", productKey: "billingC_productkey_3", valueNumber: 416572940.76, valueText: "billingContractOverrides_valuetext_3", effectiveFrom: new Date("2026-03-25 00:00:00"), effectiveTo: new Date("2025-06-26 00:00:00"), status: "rejected", createdBy: "billingContractOverrides_createdby_3", notes: "54Bank billingContractOverrides record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: billingContractOverrides");

  // billingDiscountRules
  await db.insert(schema.billingDiscountRules).values([
    { discountRuleId: "billingD_discountruleid_1", billingAccountId: "billingD_billingaccountid_1", tenantId: "tenant-lagos-main", name: "Yetunde Olowe", discountType: "premium", meterKey: "billingD_meterkey_1", productKey: "billingD_productkey_1", percentage: 1.5345, fixedAmount: 41145405.65, thresholdAmount: 289193453.86, effectiveFrom: new Date("2025-09-12 00:00:00"), effectiveTo: new Date("2025-09-05 00:00:00"), status: "inactive", createdBy: "billingDiscountRules_createdby_1" },
    { discountRuleId: "billingD_discountruleid_2", billingAccountId: "billingD_billingaccountid_2", tenantId: "tenant-abuja-hq", name: "Emeka & Sons Trading", discountType: "standard", meterKey: "billingD_meterkey_2", productKey: "billingD_productkey_2", percentage: 15.6377, fixedAmount: 206029577.65, thresholdAmount: 18624795.43, effectiveFrom: new Date("2026-01-08 00:00:00"), effectiveTo: new Date("2026-05-08 00:00:00"), status: "completed", createdBy: "billingDiscountRules_createdby_2" },
    { discountRuleId: "billingD_discountruleid_3", billingAccountId: "billingD_billingaccountid_3", tenantId: "tenant-lagos-main", name: "Ngozi Okafor", discountType: "premium", meterKey: "billingD_meterkey_3", productKey: "billingD_productkey_3", percentage: 24.4449, fixedAmount: 316554298.53, thresholdAmount: 19621450.67, effectiveFrom: new Date("2025-05-29 00:00:00"), effectiveTo: new Date("2025-07-25 00:00:00"), status: "active", createdBy: "billingDiscountRules_createdby_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: billingDiscountRules");

  // billingRevenueShareRules
  await db.insert(schema.billingRevenueShareRules).values([
    { revenueShareRuleId: "billingR_revenueshareruleid_1", billingAccountId: "billingR_billingaccountid_1", tenantId: "tenant-lagos-main", name: "Kemi Adeyemi", target: "billingRevenueShareRules_target_1", percentage: 6.9101, beneficiaryName: "billingRevenueShareRules_beneficiaryname_1", settlementLedgerCode: "billingR_settlementledgercode_1", effectiveFrom: new Date("2026-01-12 00:00:00"), effectiveTo: new Date("2025-07-25 00:00:00"), status: "inactive", createdBy: "billingRevenueShareRules_createdby_1" },
    { revenueShareRuleId: "billingR_revenueshareruleid_2", billingAccountId: "billingR_billingaccountid_2", tenantId: "tenant-lagos-main", name: "Kano Textiles Ltd", target: "billingRevenueShareRules_target_2", percentage: 21.0086, beneficiaryName: "billingRevenueShareRules_beneficiaryname_2", settlementLedgerCode: "billingR_settlementledgercode_2", effectiveFrom: new Date("2025-11-10 00:00:00"), effectiveTo: new Date("2025-10-05 00:00:00"), status: "pending", createdBy: "billingRevenueShareRules_createdby_2" },
    { revenueShareRuleId: "billingR_revenueshareruleid_3", billingAccountId: "billingR_billingaccountid_3", tenantId: "tenant-lagos-main", name: "Folake Adeniyi", target: "billingRevenueShareRules_target_3", percentage: 6.8424, beneficiaryName: "billingRevenueShareRules_beneficiaryname_3", settlementLedgerCode: "billingR_settlementledgercode_3", effectiveFrom: new Date("2025-11-22 00:00:00"), effectiveTo: new Date("2025-07-04 00:00:00"), status: "inactive", createdBy: "billingRevenueShareRules_createdby_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: billingRevenueShareRules");

  // billingInvoices
  await db.insert(schema.billingInvoices).values([
    { billingInvoiceId: "billingI_billinginvoiceid_1", invoiceNumber: "billingI_invoicenumber_1", tenantId: "tenant-abuja-hq", billingAccountId: "billingI_billingaccountid_1", billingPeriodKey: "billingI_billingperiodkey_1", billingPeriodType: "basic", periodStartAt: new Date("2025-08-04 00:00:00"), periodEndAt: new Date("2025-06-21 00:00:00"), currency: "USD", subtotalAmount: 466587369.27, discountAmount: 387397023.81, revenueShareAmount: 159835656.46, minimumCommitAdjustment: 67.6299, taxAmount: 442017744.99, totalAmount: 294653347.35, status: "inactive", approvalStatus: "approved", dueAt: new Date("2025-10-02 00:00:00"), approvalStepCount: 149, issuedAt: new Date("2025-12-10 00:00:00") },
    { billingInvoiceId: "billingI_billinginvoiceid_2", invoiceNumber: "billingI_invoicenumber_2", tenantId: "tenant-kano-north", billingAccountId: "billingI_billingaccountid_2", billingPeriodKey: "billingI_billingperiodkey_2", billingPeriodType: "basic", periodStartAt: new Date("2026-04-19 00:00:00"), periodEndAt: new Date("2025-09-23 00:00:00"), currency: "NGN", subtotalAmount: 410122844.99, discountAmount: 426454046.82, revenueShareAmount: 74409985.68, minimumCommitAdjustment: 86.7438, taxAmount: 156841388.05, totalAmount: 445595045.51, status: "completed", approvalStatus: "active", dueAt: new Date("2025-06-21 00:00:00"), approvalStepCount: 54, issuedAt: new Date("2025-06-19 00:00:00") },
    { billingInvoiceId: "billingI_billinginvoiceid_3", invoiceNumber: "billingI_invoicenumber_3", tenantId: "tenant-lagos-main", billingAccountId: "billingI_billingaccountid_3", billingPeriodKey: "billingI_billingperiodkey_3", billingPeriodType: "basic", periodStartAt: new Date("2025-06-26 00:00:00"), periodEndAt: new Date("2025-11-04 00:00:00"), currency: "NGN", subtotalAmount: 491206187.85, discountAmount: 431702940.28, revenueShareAmount: 229379146.78, minimumCommitAdjustment: 80.5759, taxAmount: 438164051.33, totalAmount: 399558923.27, status: "approved", approvalStatus: "rejected", dueAt: new Date("2025-12-22 00:00:00"), approvalStepCount: 145, issuedAt: new Date("2025-07-25 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: billingInvoices");

  // billingInvoiceLines
  await db.insert(schema.billingInvoiceLines).values([
    { billingInvoiceLineId: "billingI_billinginvoicelineid_1", billingInvoiceId: "billingI_billinginvoiceid_1", lineType: "basic", meterKey: "billingI_meterkey_1", productKey: "billingI_productkey_1", description: "54Bank billingInvoiceLines record 1", quantity: 53.135, unitPrice: 35.1282, amount: 465949090.74, metadata: {"region": "west_africa", "currency": "NGN"} },
    { billingInvoiceLineId: "billingI_billinginvoicelineid_2", billingInvoiceId: "billingI_billinginvoiceid_2", lineType: "basic", meterKey: "billingI_meterkey_2", productKey: "billingI_productkey_2", description: "54Bank billingInvoiceLines record 2", quantity: 9.9438, unitPrice: 30.0361, amount: 294988402.24, metadata: {"region": "west_africa", "currency": "NGN"} },
    { billingInvoiceLineId: "billingI_billinginvoicelineid_3", billingInvoiceId: "billingI_billinginvoiceid_3", lineType: "premium", meterKey: "billingI_meterkey_3", productKey: "billingI_productkey_3", description: "54Bank billingInvoiceLines record 3", quantity: 71.3329, unitPrice: 83.0375, amount: 426764987.71, metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: billingInvoiceLines");

  // billingInvoiceApprovals
  await db.insert(schema.billingInvoiceApprovals).values([
    { billingInvoiceApprovalId: "billingI_billinginvoiceapprovalid_1", billingInvoiceId: "billingI_billinginvoiceid_1", stageKey: "billingI_stagekey_1", actorRole: "branch_manager", status: "completed", actedAt: new Date("2026-04-10 00:00:00"), note: "54Bank billingInvoiceApprovals record 1" },
    { billingInvoiceApprovalId: "billingI_billinginvoiceapprovalid_2", billingInvoiceId: "billingI_billinginvoiceid_2", stageKey: "billingI_stagekey_2", actorRole: "admin", status: "approved", actedAt: new Date("2026-04-01 00:00:00"), note: "54Bank billingInvoiceApprovals record 2" },
    { billingInvoiceApprovalId: "billingI_billinginvoiceapprovalid_3", billingInvoiceId: "billingI_billinginvoiceid_3", stageKey: "billingI_stagekey_3", actorRole: "teller", status: "completed", actedAt: new Date("2025-09-30 00:00:00"), note: "54Bank billingInvoiceApprovals record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: billingInvoiceApprovals");

  // partnerOnboardingRecords
  await db.insert(schema.partnerOnboardingRecords).values([
    { partnerId: "partnerO_partnerid_1", tenantId: "tenant-kano-north", partnerName: "partnerOnboardingRecords_partnername_1", legalEntity: "partnerOnboardingRecords_legalentity_1", partnerType: "premium", region: "Nigeria", stage: "partnerOnboardingRecords_stage_1", requestedModules: ["core_banking", "payments", "kyc", "aml"], primaryContact: {"key": "value"}, operationsContact: {"key": "value"}, commercial: {"key": "value"}, compliance: {"key": "value"}, branding: {"displayName": "54Bank", "primaryColor": "#1a5276"}, checklist: {"key": "value"}, blockers: {"key": "value"}, readinessScore: 97, submittedAt: new Date("2026-03-25 00:00:00"), launchedAt: new Date("2026-03-27 00:00:00"), lastSubmittedBy: "partnerOnboardingRecords_lastsubmittedby_1" },
    { partnerId: "partnerO_partnerid_2", tenantId: "tenant-kano-north", partnerName: "partnerOnboardingRecords_partnername_2", legalEntity: "partnerOnboardingRecords_legalentity_2", partnerType: "premium", region: "Nigeria", stage: "partnerOnboardingRecords_stage_2", requestedModules: ["core_banking", "payments", "kyc", "aml"], primaryContact: {"key": "value"}, operationsContact: {"key": "value"}, commercial: {"key": "value"}, compliance: {"key": "value"}, branding: {"displayName": "54Bank", "primaryColor": "#1a5276"}, checklist: {"key": "value"}, blockers: {"key": "value"}, readinessScore: 7, submittedAt: new Date("2026-02-18 00:00:00"), launchedAt: new Date("2025-11-15 00:00:00"), lastSubmittedBy: "partnerOnboardingRecords_lastsubmittedby_2" },
    { partnerId: "partnerO_partnerid_3", tenantId: "tenant-ph-south", partnerName: "partnerOnboardingRecords_partnername_3", legalEntity: "partnerOnboardingRecords_legalentity_3", partnerType: "standard", region: "Nigeria", stage: "partnerOnboardingRecords_stage_3", requestedModules: ["core_banking", "payments", "kyc", "aml"], primaryContact: {"key": "value"}, operationsContact: {"key": "value"}, commercial: {"key": "value"}, compliance: {"key": "value"}, branding: {"displayName": "54Bank", "primaryColor": "#1a5276"}, checklist: {"key": "value"}, blockers: {"key": "value"}, readinessScore: 47, submittedAt: new Date("2025-12-13 00:00:00"), launchedAt: new Date("2025-05-20 00:00:00"), lastSubmittedBy: "partnerOnboardingRecords_lastsubmittedby_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: partnerOnboardingRecords");

  // partnerApprovalRecords
  await db.insert(schema.partnerApprovalRecords).values([
    { approvalId: "partnerA_approvalid_1", partnerId: "partnerA_partnerid_1", stage: "partnerApprovalRecords_stage_1", title: "partnerApprovalRecords_title_1", detail: "54Bank partnerApprovalRecords record 1", state: "Oyo", requiredRole: "user", requestedById: "partnerA_requestedbyid_1", resolvedAt: new Date("2026-03-07 00:00:00"), resolutionNote: "54Bank partnerApprovalRecords record 1" },
    { approvalId: "partnerA_approvalid_2", partnerId: "partnerA_partnerid_2", stage: "partnerApprovalRecords_stage_2", title: "partnerApprovalRecords_title_2", detail: "54Bank partnerApprovalRecords record 2", state: "Enugu", requiredRole: "teller", requestedById: "partnerA_requestedbyid_2", resolvedAt: new Date("2025-10-18 00:00:00"), resolutionNote: "54Bank partnerApprovalRecords record 2" },
    { approvalId: "partnerA_approvalid_3", partnerId: "partnerA_partnerid_3", stage: "partnerApprovalRecords_stage_3", title: "partnerApprovalRecords_title_3", detail: "54Bank partnerApprovalRecords record 3", state: "Abuja", requiredRole: "branch_manager", requestedById: "partnerA_requestedbyid_3", resolvedAt: new Date("2025-11-23 00:00:00"), resolutionNote: "54Bank partnerApprovalRecords record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: partnerApprovalRecords");

  // farmers
  await db.insert(schema.farmers).values([
    { farmerId: "farmers_farmerid_1", tenantId: "tenant-lagos-main", name: "Amina Yusuf", bvn: "22885809644", phone: "+2348209310742", region: "Nigeria", localGovernment: "farmers_localgovernment_1", farmSizeHectares: 84.7893, primaryCrop: "farmers_primarycrop_1", secondaryCrops: {"key": "value"}, cooperativeId: "farmers_cooperativeid_1", cooperativeName: "farmers_cooperativename_1", bankAccountNumber: "5485204967", riskScore: 5.4554, riskTier: "tier_3", status: "rejected", geoCoordinates: {"key": "value"}, registrationChannel: "farmers_registrationchannel_1" },
    { farmerId: "farmers_farmerid_2", tenantId: "tenant-kano-north", name: "Lagos Agro-Allied Co", bvn: "22864167493", phone: "+2347638506159", region: "Nigeria", localGovernment: "farmers_localgovernment_2", farmSizeHectares: 72.0563, primaryCrop: "farmers_primarycrop_2", secondaryCrops: {"key": "value"}, cooperativeId: "farmers_cooperativeid_2", cooperativeName: "farmers_cooperativename_2", bankAccountNumber: "5488535488", riskScore: 12.056, riskTier: "tier_2", status: "pending", geoCoordinates: {"key": "value"}, registrationChannel: "farmers_registrationchannel_2" },
    { farmerId: "farmers_farmerid_3", tenantId: "tenant-ph-south", name: "Aisha Mohammed", bvn: "22986081525", phone: "+2347560889487", region: "Nigeria", localGovernment: "farmers_localgovernment_3", farmSizeHectares: 82.2117, primaryCrop: "farmers_primarycrop_3", secondaryCrops: {"key": "value"}, cooperativeId: "farmers_cooperativeid_3", cooperativeName: "farmers_cooperativename_3", bankAccountNumber: "5475161424", riskScore: 19.2595, riskTier: "tier_1", status: "active", geoCoordinates: {"key": "value"}, registrationChannel: "farmers_registrationchannel_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: farmers");

  // agriLoans
  await db.insert(schema.agriLoans).values([
    { loanId: "agriLoan_loanid_1", tenantId: "tenant-kano-north", farmerId: "agriLoan_farmerid_1", loanType: "standard", productCode: "agriLoan_productcode_1", principalAmount: 435866909.44, interestRateBps: 81, tenorMonths: 96, currency: "EUR", purpose: "54Bank agriLoans record 1", collateralType: "basic", collateralValue: 182696120.25, cropCycle: "agriLoans_cropcycle_1", expectedHarvestDate: "agriLoans_expectedharvestdate_1", disbursementDate: "agriLoans_disbursementdate_1", maturityDate: "agriLoans_maturitydate_1", outstandingBalance: 145847116.47, totalRepaid: 38.8377, status: "pending", approvalStatus: "rejected", riskGrade: "agriLoans_riskgrade_1", repaymentSchedule: {"key": "value"} },
    { loanId: "agriLoan_loanid_2", tenantId: "tenant-abuja-hq", farmerId: "agriLoan_farmerid_2", loanType: "premium", productCode: "agriLoan_productcode_2", principalAmount: 234426624.24, interestRateBps: 42, tenorMonths: 25, currency: "GBP", purpose: "54Bank agriLoans record 2", collateralType: "standard", collateralValue: 123229530.12, cropCycle: "agriLoans_cropcycle_2", expectedHarvestDate: "agriLoans_expectedharvestdate_2", disbursementDate: "agriLoans_disbursementdate_2", maturityDate: "agriLoans_maturitydate_2", outstandingBalance: 441418286.13, totalRepaid: 36.0049, status: "completed", approvalStatus: "inactive", riskGrade: "agriLoans_riskgrade_2", repaymentSchedule: {"key": "value"} },
    { loanId: "agriLoan_loanid_3", tenantId: "tenant-lagos-main", farmerId: "agriLoan_farmerid_3", loanType: "standard", productCode: "agriLoan_productcode_3", principalAmount: 499822879.95, interestRateBps: 78, tenorMonths: 36, currency: "GBP", purpose: "54Bank agriLoans record 3", collateralType: "premium", collateralValue: 136599271.58, cropCycle: "agriLoans_cropcycle_3", expectedHarvestDate: "agriLoans_expectedharvestdate_3", disbursementDate: "agriLoans_disbursementdate_3", maturityDate: "agriLoans_maturitydate_3", outstandingBalance: 70164915.0, totalRepaid: 33.3153, status: "inactive", approvalStatus: "completed", riskGrade: "agriLoans_riskgrade_3", repaymentSchedule: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: agriLoans");

  // cropInsurancePolicies
  await db.insert(schema.cropInsurancePolicies).values([
    { policyId: "cropInsu_policyid_1", tenantId: "tenant-lagos-main", farmerId: "cropInsu_farmerid_1", policyType: "basic", cropCovered: "cropInsurancePolicies_cropcovered_1", coverageAreaHectares: 32.0016, sumInsured: 78.3966, premiumAmount: 83082317.89, premiumFrequency: "cropInsurancePolicies_premiumfrequency_1", policyStart: "cropInsurancePolicies_policystart_1", policyEnd: "cropInsurancePolicies_policyend_1", weatherTrigger: {"key": "value"}, claims: {"key": "value"}, status: "completed", underwriter: "cropInsurancePolicies_underwriter_1" },
    { policyId: "cropInsu_policyid_2", tenantId: "tenant-abuja-hq", farmerId: "cropInsu_farmerid_2", policyType: "premium", cropCovered: "cropInsurancePolicies_cropcovered_2", coverageAreaHectares: 8.5175, sumInsured: 78.8697, premiumAmount: 475616072.96, premiumFrequency: "cropInsurancePolicies_premiumfrequency_2", policyStart: "cropInsurancePolicies_policystart_2", policyEnd: "cropInsurancePolicies_policyend_2", weatherTrigger: {"key": "value"}, claims: {"key": "value"}, status: "inactive", underwriter: "cropInsurancePolicies_underwriter_2" },
    { policyId: "cropInsu_policyid_3", tenantId: "tenant-lagos-main", farmerId: "cropInsu_farmerid_3", policyType: "basic", cropCovered: "cropInsurancePolicies_cropcovered_3", coverageAreaHectares: 94.6629, sumInsured: 32.5236, premiumAmount: 335309872.55, premiumFrequency: "cropInsurancePolicies_premiumfrequency_3", policyStart: "cropInsurancePolicies_policystart_3", policyEnd: "cropInsurancePolicies_policyend_3", weatherTrigger: {"key": "value"}, claims: {"key": "value"}, status: "approved", underwriter: "cropInsurancePolicies_underwriter_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: cropInsurancePolicies");

  // valueChainContracts
  await db.insert(schema.valueChainContracts).values([
    { contractId: "valueCha_contractid_1", tenantId: "tenant-lagos-main", contractType: "standard", buyerName: "valueChainContracts_buyername_1", buyerId: "valueCha_buyerid_1", sellerFarmerId: "valueCha_sellerfarmerid_1", commodity: "valueChainContracts_commodity_1", quantityTonnes: 80.207, pricePerTonne: 39.3858, totalValue: 460809365.33, currency: "EUR", deliveryLocation: "Imo", deliveryDeadline: "valueChainContracts_deliverydeadline_1", warehouseReceiptId: "valueCha_warehousereceiptid_1", qualityGrade: "valueChainContracts_qualitygrade_1", milestones: {"key": "value"}, status: "inactive" },
    { contractId: "valueCha_contractid_2", tenantId: "tenant-kano-north", contractType: "premium", buyerName: "valueChainContracts_buyername_2", buyerId: "valueCha_buyerid_2", sellerFarmerId: "valueCha_sellerfarmerid_2", commodity: "valueChainContracts_commodity_2", quantityTonnes: 63.4831, pricePerTonne: 55.6734, totalValue: 77346390.32, currency: "EUR", deliveryLocation: "Oyo", deliveryDeadline: "valueChainContracts_deliverydeadline_2", warehouseReceiptId: "valueCha_warehousereceiptid_2", qualityGrade: "valueChainContracts_qualitygrade_2", milestones: {"key": "value"}, status: "rejected" },
    { contractId: "valueCha_contractid_3", tenantId: "tenant-lagos-main", contractType: "premium", buyerName: "valueChainContracts_buyername_3", buyerId: "valueCha_buyerid_3", sellerFarmerId: "valueCha_sellerfarmerid_3", commodity: "valueChainContracts_commodity_3", quantityTonnes: 95.3806, pricePerTonne: 11.8924, totalValue: 22593131.14, currency: "EUR", deliveryLocation: "Ogun", deliveryDeadline: "valueChainContracts_deliverydeadline_3", warehouseReceiptId: "valueCha_warehousereceiptid_3", qualityGrade: "valueChainContracts_qualitygrade_3", milestones: {"key": "value"}, status: "pending" },
  ]).onConflictDoNothing();
  console.log("  seeded: valueChainContracts");

  // tellerSessions
  await db.insert(schema.tellerSessions).values([
    { sessionId: "tellerSe_sessionid_1", tenantId: "tenant-kano-north", tellerId: "tellerSe_tellerid_1", tellerName: "tellerSessions_tellername_1", branchCode: "LOS-001", branchName: "ABJ-001", windowNumber: 99, status: "approved", openedAt: "tellerSessions_openedat_1", closedAt: "tellerSessions_closedat_1", openingBalance: 220369841.16, currentBalance: 456234248.77, transactionCount: 154, cashDrawer: {"key": "value"} },
    { sessionId: "tellerSe_sessionid_2", tenantId: "tenant-ph-south", tellerId: "tellerSe_tellerid_2", tellerName: "tellerSessions_tellername_2", branchCode: "ABJ-001", branchName: "PHC-001", windowNumber: 58, status: "approved", openedAt: "tellerSessions_openedat_2", closedAt: "tellerSessions_closedat_2", openingBalance: 198585113.13, currentBalance: 494312286.94, transactionCount: 211, cashDrawer: {"key": "value"} },
    { sessionId: "tellerSe_sessionid_3", tenantId: "tenant-kano-north", tellerId: "tellerSe_tellerid_3", tellerName: "tellerSessions_tellername_3", branchCode: "LOS-001", branchName: "LOS-001", windowNumber: 32, status: "completed", openedAt: "tellerSessions_openedat_3", closedAt: "tellerSessions_closedat_3", openingBalance: 118706328.93, currentBalance: 463519381.22, transactionCount: 494, cashDrawer: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: tellerSessions");

  // tellerTransactions
  await db.insert(schema.tellerTransactions).values([
    { txnId: "tellerTr_txnid_1", sessionId: "tellerTr_sessionid_1", tenantId: "tenant-ph-south", txnType: "basic", customerId: "tellerTr_customerid_1", amount: 255893746.46, currency: "GBP", reference: "54B-TELL-455018", status: "approved", processedAt: "tellerTransactions_processedat_1" },
    { txnId: "tellerTr_txnid_2", sessionId: "tellerTr_sessionid_2", tenantId: "tenant-kano-north", txnType: "premium", customerId: "tellerTr_customerid_2", amount: 138212549.58, currency: "NGN", reference: "54B-TELL-120231", status: "completed", processedAt: "tellerTransactions_processedat_2" },
    { txnId: "tellerTr_txnid_3", sessionId: "tellerTr_sessionid_3", tenantId: "tenant-lagos-main", txnType: "standard", customerId: "tellerTr_customerid_3", amount: 425273436.14, currency: "NGN", reference: "54B-TELL-442340", status: "inactive", processedAt: "tellerTransactions_processedat_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: tellerTransactions");

  // vaultOperations
  await db.insert(schema.vaultOperations).values([
    { operationId: "vaultOpe_operationid_1", tenantId: "tenant-kano-north", operationType: "standard", fromLocation: "Rivers", toLocation: "Abuja", amount: 146080799.72, currency: "NGN", authorizedBy: "vaultOperations_authorizedby_1", dualControlBy: "vaultOperations_dualcontrolby_1", status: "inactive", reason: "54Bank vaultOperations record 1" },
    { operationId: "vaultOpe_operationid_2", tenantId: "tenant-kano-north", operationType: "premium", fromLocation: "Anambra", toLocation: "Kano", amount: 497231429.79, currency: "EUR", authorizedBy: "vaultOperations_authorizedby_2", dualControlBy: "vaultOperations_dualcontrolby_2", status: "approved", reason: "54Bank vaultOperations record 2" },
    { operationId: "vaultOpe_operationid_3", tenantId: "tenant-kano-north", operationType: "standard", fromLocation: "Oyo", toLocation: "Enugu", amount: 22962102.59, currency: "USD", authorizedBy: "vaultOperations_authorizedby_3", dualControlBy: "vaultOperations_dualcontrolby_3", status: "pending", reason: "54Bank vaultOperations record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: vaultOperations");

  // murabahaContracts
  await db.insert(schema.murabahaContracts).values([
    { contractId: "murabaha_contractid_1", tenantId: "tenant-lagos-main", customerId: "murabaha_customerid_1", customerName: "murabahaContracts_customername_1", assetDescription: "54Bank murabahaContracts record 1", assetCategory: "standard", costPrice: 26.4415, profitMarginPct: 22.6871, sellingPrice: 70.782, currency: "NGN", tenorMonths: 3, instalmentAmount: 497802228.5, totalPaid: 82.0633, outstandingBalance: 123082659.99, disbursementDate: "murabahaContracts_disbursementdate_1", maturityDate: "murabahaContracts_maturitydate_1", status: "rejected", shariaCompliance: "murabahaContracts_shariacompliance_1", shariaBoardReference: "54B-MURA-301358", instalmentSchedule: {"key": "value"} },
    { contractId: "murabaha_contractid_2", tenantId: "tenant-ph-south", customerId: "murabaha_customerid_2", customerName: "murabahaContracts_customername_2", assetDescription: "54Bank murabahaContracts record 2", assetCategory: "basic", costPrice: 94.8817, profitMarginPct: 51.1455, sellingPrice: 7.6869, currency: "EUR", tenorMonths: 62, instalmentAmount: 449291471.62, totalPaid: 93.9642, outstandingBalance: 39593509.77, disbursementDate: "murabahaContracts_disbursementdate_2", maturityDate: "murabahaContracts_maturitydate_2", status: "inactive", shariaCompliance: "murabahaContracts_shariacompliance_2", shariaBoardReference: "54B-MURA-537639", instalmentSchedule: {"key": "value"} },
    { contractId: "murabaha_contractid_3", tenantId: "tenant-ph-south", customerId: "murabaha_customerid_3", customerName: "murabahaContracts_customername_3", assetDescription: "54Bank murabahaContracts record 3", assetCategory: "standard", costPrice: 47.1148, profitMarginPct: 10.846, sellingPrice: 98.3671, currency: "USD", tenorMonths: 39, instalmentAmount: 299393695.63, totalPaid: 47.8762, outstandingBalance: 26265182.33, disbursementDate: "murabahaContracts_disbursementdate_3", maturityDate: "murabahaContracts_maturitydate_3", status: "pending", shariaCompliance: "murabahaContracts_shariacompliance_3", shariaBoardReference: "54B-MURA-879126", instalmentSchedule: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: murabahaContracts");

  // ijaraContracts
  await db.insert(schema.ijaraContracts).values([
    { contractId: "ijaraCon_contractid_1", tenantId: "tenant-kano-north", customerId: "ijaraCon_customerid_1", customerName: "ijaraContracts_customername_1", assetDescription: "54Bank ijaraContracts record 1", assetCategory: "premium", assetValue: 86016168.61, rentalAmount: 192886520.3, rentalFrequency: "ijaraContracts_rentalfrequency_1", currency: "GBP", leaseStart: "ijaraContracts_leasestart_1", leaseEnd: "ijaraContracts_leaseend_1", tenorMonths: 51, residualValue: 200863325.07, purchaseOption: 36, purchasePrice: 20.9597, totalRentPaid: 66.3491, status: "pending", shariaCompliance: "ijaraContracts_shariacompliance_1", maintenanceResponsibility: "ijaraContracts_maintenanceresponsibility_1" },
    { contractId: "ijaraCon_contractid_2", tenantId: "tenant-lagos-main", customerId: "ijaraCon_customerid_2", customerName: "ijaraContracts_customername_2", assetDescription: "54Bank ijaraContracts record 2", assetCategory: "basic", assetValue: 494428341.17, rentalAmount: 444462520.48, rentalFrequency: "ijaraContracts_rentalfrequency_2", currency: "EUR", leaseStart: "ijaraContracts_leasestart_2", leaseEnd: "ijaraContracts_leaseend_2", tenorMonths: 38, residualValue: 66422521.6, purchaseOption: 49, purchasePrice: 78.4105, totalRentPaid: 49.3863, status: "active", shariaCompliance: "ijaraContracts_shariacompliance_2", maintenanceResponsibility: "ijaraContracts_maintenanceresponsibility_2" },
    { contractId: "ijaraCon_contractid_3", tenantId: "tenant-ph-south", customerId: "ijaraCon_customerid_3", customerName: "ijaraContracts_customername_3", assetDescription: "54Bank ijaraContracts record 3", assetCategory: "basic", assetValue: 385567641.64, rentalAmount: 8441462.64, rentalFrequency: "ijaraContracts_rentalfrequency_3", currency: "NGN", leaseStart: "ijaraContracts_leasestart_3", leaseEnd: "ijaraContracts_leaseend_3", tenorMonths: 99, residualValue: 410372209.89, purchaseOption: 29, purchasePrice: 2.3554, totalRentPaid: 94.0798, status: "completed", shariaCompliance: "ijaraContracts_shariacompliance_3", maintenanceResponsibility: "ijaraContracts_maintenanceresponsibility_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: ijaraContracts");

  // mudarabahContracts
  await db.insert(schema.mudarabahContracts).values([
    { contractId: "mudaraba_contractid_1", tenantId: "tenant-lagos-main", investorId: "mudaraba_investorid_1", investorName: "mudarabahContracts_investorname_1", fundManagerId: "mudaraba_fundmanagerid_1", investmentPurpose: "54Bank mudarabahContracts record 1", capitalAmount: 279245162.2, currency: "NGN", profitSharingRatioInvestor: 57.0793, profitSharingRatioManager: 23.7095, investmentPeriodMonths: 44, startDate: "mudarabahContracts_startdate_1", maturityDate: "mudarabahContracts_maturitydate_1", realizedProfit: 80.0765, realizedLoss: 25.0344, distributions: {"key": "value"}, status: "rejected", shariaCompliance: "mudarabahContracts_shariacompliance_1", riskCategory: "standard" },
    { contractId: "mudaraba_contractid_2", tenantId: "tenant-abuja-hq", investorId: "mudaraba_investorid_2", investorName: "mudarabahContracts_investorname_2", fundManagerId: "mudaraba_fundmanagerid_2", investmentPurpose: "54Bank mudarabahContracts record 2", capitalAmount: 345866551.45, currency: "USD", profitSharingRatioInvestor: 30.7687, profitSharingRatioManager: 22.0603, investmentPeriodMonths: 26, startDate: "mudarabahContracts_startdate_2", maturityDate: "mudarabahContracts_maturitydate_2", realizedProfit: 9.2141, realizedLoss: 61.408, distributions: {"key": "value"}, status: "approved", shariaCompliance: "mudarabahContracts_shariacompliance_2", riskCategory: "standard" },
    { contractId: "mudaraba_contractid_3", tenantId: "tenant-kano-north", investorId: "mudaraba_investorid_3", investorName: "mudarabahContracts_investorname_3", fundManagerId: "mudaraba_fundmanagerid_3", investmentPurpose: "54Bank mudarabahContracts record 3", capitalAmount: 491304028.79, currency: "EUR", profitSharingRatioInvestor: 80.2393, profitSharingRatioManager: 46.9922, investmentPeriodMonths: 31, startDate: "mudarabahContracts_startdate_3", maturityDate: "mudarabahContracts_maturitydate_3", realizedProfit: 67.3316, realizedLoss: 59.8953, distributions: {"key": "value"}, status: "approved", shariaCompliance: "mudarabahContracts_shariacompliance_3", riskCategory: "premium" },
  ]).onConflictDoNothing();
  console.log("  seeded: mudarabahContracts");

  // lettersOfCredit
  await db.insert(schema.lettersOfCredit).values([
    { lcId: "lettersO_lcid_1", tenantId: "tenant-ph-south", lcType: "basic", applicantId: "lettersO_applicantid_1", applicantName: "lettersOfCredit_applicantname_1", beneficiaryName: "lettersOfCredit_beneficiaryname_1", beneficiaryBank: "lettersOfCredit_beneficiarybank_1", beneficiaryCountry: "Nigeria", issuingBank: "lettersOfCredit_issuingbank_1", advisingBank: "lettersOfCredit_advisingbank_1", amount: 112046093.1, currency: "EUR", commodity: "lettersOfCredit_commodity_1", incoterm: "lettersOfCredit_incoterm_1", portOfLoading: "lettersOfCredit_portofloading_1", portOfDischarge: "lettersOfCredit_portofdischarge_1", latestShipDate: "lettersOfCredit_latestshipdate_1", expiryDate: "lettersOfCredit_expirydate_1", documentsRequired: {"key": "value"}, amendments: {"key": "value"}, status: "pending" },
    { lcId: "lettersO_lcid_2", tenantId: "tenant-lagos-main", lcType: "basic", applicantId: "lettersO_applicantid_2", applicantName: "lettersOfCredit_applicantname_2", beneficiaryName: "lettersOfCredit_beneficiaryname_2", beneficiaryBank: "lettersOfCredit_beneficiarybank_2", beneficiaryCountry: "Nigeria", issuingBank: "lettersOfCredit_issuingbank_2", advisingBank: "lettersOfCredit_advisingbank_2", amount: 131606133.74, currency: "NGN", commodity: "lettersOfCredit_commodity_2", incoterm: "lettersOfCredit_incoterm_2", portOfLoading: "lettersOfCredit_portofloading_2", portOfDischarge: "lettersOfCredit_portofdischarge_2", latestShipDate: "lettersOfCredit_latestshipdate_2", expiryDate: "lettersOfCredit_expirydate_2", documentsRequired: {"key": "value"}, amendments: {"key": "value"}, status: "pending" },
    { lcId: "lettersO_lcid_3", tenantId: "tenant-ph-south", lcType: "premium", applicantId: "lettersO_applicantid_3", applicantName: "lettersOfCredit_applicantname_3", beneficiaryName: "lettersOfCredit_beneficiaryname_3", beneficiaryBank: "lettersOfCredit_beneficiarybank_3", beneficiaryCountry: "Nigeria", issuingBank: "lettersOfCredit_issuingbank_3", advisingBank: "lettersOfCredit_advisingbank_3", amount: 131962698.5, currency: "NGN", commodity: "lettersOfCredit_commodity_3", incoterm: "lettersOfCredit_incoterm_3", portOfLoading: "lettersOfCredit_portofloading_3", portOfDischarge: "lettersOfCredit_portofdischarge_3", latestShipDate: "lettersOfCredit_latestshipdate_3", expiryDate: "lettersOfCredit_expirydate_3", documentsRequired: {"key": "value"}, amendments: {"key": "value"}, status: "completed" },
  ]).onConflictDoNothing();
  console.log("  seeded: lettersOfCredit");

  // warehouseReceipts
  await db.insert(schema.warehouseReceipts).values([
    { receiptId: "warehous_receiptid_1", tenantId: "tenant-ph-south", depositorId: "warehous_depositorid_1", depositorName: "warehouseReceipts_depositorname_1", warehouseId: "warehous_warehouseid_1", warehouseName: "warehouseReceipts_warehousename_1", location: "Ogun", commodity: "warehouseReceipts_commodity_1", quantity: 82.1829, quantityUnit: "warehouseReceipts_quantityunit_1", qualityGrade: "warehouseReceipts_qualitygrade_1", storageStartDate: "warehouseReceipts_storagestartdate_1", expiryDate: "warehouseReceipts_expirydate_1", marketValue: 98271084.51, currency: "GBP", pledgedAsCollateral: 3, collateralLoanId: "warehous_collateralloanid_1", insurancePolicyId: "warehous_insurancepolicyid_1", status: "completed" },
    { receiptId: "warehous_receiptid_2", tenantId: "tenant-kano-north", depositorId: "warehous_depositorid_2", depositorName: "warehouseReceipts_depositorname_2", warehouseId: "warehous_warehouseid_2", warehouseName: "warehouseReceipts_warehousename_2", location: "Kaduna", commodity: "warehouseReceipts_commodity_2", quantity: 28.1434, quantityUnit: "warehouseReceipts_quantityunit_2", qualityGrade: "warehouseReceipts_qualitygrade_2", storageStartDate: "warehouseReceipts_storagestartdate_2", expiryDate: "warehouseReceipts_expirydate_2", marketValue: 29703336.81, currency: "EUR", pledgedAsCollateral: 46, collateralLoanId: "warehous_collateralloanid_2", insurancePolicyId: "warehous_insurancepolicyid_2", status: "completed" },
    { receiptId: "warehous_receiptid_3", tenantId: "tenant-ph-south", depositorId: "warehous_depositorid_3", depositorName: "warehouseReceipts_depositorname_3", warehouseId: "warehous_warehouseid_3", warehouseName: "warehouseReceipts_warehousename_3", location: "Rivers", commodity: "warehouseReceipts_commodity_3", quantity: 63.9261, quantityUnit: "warehouseReceipts_quantityunit_3", qualityGrade: "warehouseReceipts_qualitygrade_3", storageStartDate: "warehouseReceipts_storagestartdate_3", expiryDate: "warehouseReceipts_expirydate_3", marketValue: 230194636.16, currency: "GBP", pledgedAsCollateral: 80, collateralLoanId: "warehous_collateralloanid_3", insurancePolicyId: "warehous_insurancepolicyid_3", status: "approved" },
  ]).onConflictDoNothing();
  console.log("  seeded: warehouseReceipts");

  // bankGuarantees
  await db.insert(schema.bankGuarantees).values([
    { guaranteeId: "bankGuar_guaranteeid_1", tenantId: "tenant-ph-south", guaranteeType: "basic", applicantId: "bankGuar_applicantid_1", applicantName: "bankGuarantees_applicantname_1", beneficiaryName: "bankGuarantees_beneficiaryname_1", amount: 4483339.95, currency: "NGN", purpose: "54Bank bankGuarantees record 1", effectiveDate: "bankGuarantees_effectivedate_1", expiryDate: "bankGuarantees_expirydate_1", claimDeadline: "bankGuarantees_claimdeadline_1", commissionRate: 2.962, commissionAmount: 297672428.56, status: "rejected" },
    { guaranteeId: "bankGuar_guaranteeid_2", tenantId: "tenant-abuja-hq", guaranteeType: "standard", applicantId: "bankGuar_applicantid_2", applicantName: "bankGuarantees_applicantname_2", beneficiaryName: "bankGuarantees_beneficiaryname_2", amount: 295944083.77, currency: "GBP", purpose: "54Bank bankGuarantees record 2", effectiveDate: "bankGuarantees_effectivedate_2", expiryDate: "bankGuarantees_expirydate_2", claimDeadline: "bankGuarantees_claimdeadline_2", commissionRate: 19.2019, commissionAmount: 201064690.97, status: "inactive" },
    { guaranteeId: "bankGuar_guaranteeid_3", tenantId: "tenant-abuja-hq", guaranteeType: "standard", applicantId: "bankGuar_applicantid_3", applicantName: "bankGuarantees_applicantname_3", beneficiaryName: "bankGuarantees_beneficiaryname_3", amount: 487672829.18, currency: "NGN", purpose: "54Bank bankGuarantees record 3", effectiveDate: "bankGuarantees_effectivedate_3", expiryDate: "bankGuarantees_expirydate_3", claimDeadline: "bankGuarantees_claimdeadline_3", commissionRate: 2.4706, commissionAmount: 353093123.58, status: "completed" },
  ]).onConflictDoNothing();
  console.log("  seeded: bankGuarantees");

  // mortgageApplications
  await db.insert(schema.mortgageApplications).values([
    { mortgageId: "mortgage_mortgageid_1", tenantId: "tenant-ph-south", applicantId: "mortgage_applicantid_1", applicantName: "mortgageApplications_applicantname_1", propertyValue: 167922163.45, loanAmount: 236031041.23, downPayment: 22.6003, interestRatePct: 19.1136, tenorMonths: 60, mortgageType: "premium", emi: 63.2329, ltvPct: 22.5433, ltvGrade: "mortgageApplications_ltvgrade_1", dtiRatio: 0.2398, propertyAddress: "93 Broad Street, Oyo", propertyType: "basic", status: "pending", disbursedAt: new Date("2026-03-31 00:00:00") },
    { mortgageId: "mortgage_mortgageid_2", tenantId: "tenant-kano-north", applicantId: "mortgage_applicantid_2", applicantName: "mortgageApplications_applicantname_2", propertyValue: 295690977.42, loanAmount: 180874879.21, downPayment: 13.81, interestRatePct: 2.4518, tenorMonths: 63, mortgageType: "standard", emi: 91.9288, ltvPct: 2.4474, ltvGrade: "mortgageApplications_ltvgrade_2", dtiRatio: 62.3487, propertyAddress: "179 Marina Street, Kano", propertyType: "premium", status: "completed", disbursedAt: new Date("2026-02-22 00:00:00") },
    { mortgageId: "mortgage_mortgageid_3", tenantId: "tenant-ph-south", applicantId: "mortgage_applicantid_3", applicantName: "mortgageApplications_applicantname_3", propertyValue: 387395489.19, loanAmount: 94637728.79, downPayment: 40.2488, interestRatePct: 19.7801, tenorMonths: 47, mortgageType: "basic", emi: 93.7959, ltvPct: 80.7404, ltvGrade: "mortgageApplications_ltvgrade_3", dtiRatio: 40.991, propertyAddress: "41 Broad Street, Kaduna", propertyType: "premium", status: "pending", disbursedAt: new Date("2026-04-19 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: mortgageApplications");

  // educationLoans
  await db.insert(schema.educationLoans).values([
    { loanId: "educatio_loanid_1", tenantId: "tenant-lagos-main", studentId: "educatio_studentid_1", studentName: "educationLoans_studentname_1", institutionName: "educationLoans_institutionname_1", programName: "educationLoans_programname_1", loanAmount: 465021175.04, interestRate: 9.9156, tenorMonths: 82, graceMonths: 4, emi: 5.5561, outstandingBalance: 79432129.77, cosignerName: "educationLoans_cosignername_1", cosignerType: "premium", status: "completed" },
    { loanId: "educatio_loanid_2", tenantId: "tenant-ph-south", studentId: "educatio_studentid_2", studentName: "educationLoans_studentname_2", institutionName: "educationLoans_institutionname_2", programName: "educationLoans_programname_2", loanAmount: 359984499.78, interestRate: 7.0187, tenorMonths: 5, graceMonths: 2, emi: 90.8691, outstandingBalance: 342495637.69, cosignerName: "educationLoans_cosignername_2", cosignerType: "premium", status: "inactive" },
    { loanId: "educatio_loanid_3", tenantId: "tenant-kano-north", studentId: "educatio_studentid_3", studentName: "educationLoans_studentname_3", institutionName: "educationLoans_institutionname_3", programName: "educationLoans_programname_3", loanAmount: 105006019.32, interestRate: 1.0077, tenorMonths: 93, graceMonths: 89, emi: 19.9451, outstandingBalance: 27854024.5, cosignerName: "educationLoans_cosignername_3", cosignerType: "standard", status: "pending" },
  ]).onConflictDoNothing();
  console.log("  seeded: educationLoans");

  // esusuGroups
  await db.insert(schema.esusuGroups).values([
    { groupId: "esusuGro_groupid_1", tenantId: "tenant-lagos-main", name: "Ibrahim Musa", organiserId: "esusuGro_organiserid_1", organiserName: "esusuGroups_organisername_1", contributionAmount: 395719613.16, currency: "EUR", frequency: "esusuGroups_frequency_1", maxMembers: 92, status: "active", startDate: new Date("2025-09-27 00:00:00") },
    { groupId: "esusuGro_groupid_2", tenantId: "tenant-lagos-main", name: "Dangote Industries Ltd", organiserId: "esusuGro_organiserid_2", organiserName: "esusuGroups_organisername_2", contributionAmount: 102818158.58, currency: "NGN", frequency: "esusuGroups_frequency_2", maxMembers: 58, status: "rejected", startDate: new Date("2025-06-05 00:00:00") },
    { groupId: "esusuGro_groupid_3", tenantId: "tenant-lagos-main", name: "Kemi Adeyemi", organiserId: "esusuGro_organiserid_3", organiserName: "esusuGroups_organisername_3", contributionAmount: 363268496.48, currency: "USD", frequency: "esusuGroups_frequency_3", maxMembers: 28, status: "inactive", startDate: new Date("2026-03-18 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: esusuGroups");

  // virtualAccounts
  await db.insert(schema.virtualAccounts).values([
    { accountId: "virtualA_accountid_1", tenantId: "tenant-abuja-hq", van: "virtualAccounts_van_1", parentAccountId: "virtualA_parentaccountid_1", ownerId: "virtualA_ownerid_1", ownerName: "virtualAccounts_ownername_1", ownerType: "basic", purpose: "54Bank virtualAccounts record 1", currency: "GBP", dailyLimit: 95.508, monthlyLimit: 87.0397, status: "inactive", expiryDate: new Date("2026-03-09 00:00:00") },
    { accountId: "virtualA_accountid_2", tenantId: "tenant-abuja-hq", van: "virtualAccounts_van_2", parentAccountId: "virtualA_parentaccountid_2", ownerId: "virtualA_ownerid_2", ownerName: "virtualAccounts_ownername_2", ownerType: "basic", purpose: "54Bank virtualAccounts record 2", currency: "NGN", dailyLimit: 78.4933, monthlyLimit: 92.5844, status: "completed", expiryDate: new Date("2025-11-06 00:00:00") },
    { accountId: "virtualA_accountid_3", tenantId: "tenant-abuja-hq", van: "virtualAccounts_van_3", parentAccountId: "virtualA_parentaccountid_3", ownerId: "virtualA_ownerid_3", ownerName: "virtualAccounts_ownername_3", ownerType: "standard", purpose: "54Bank virtualAccounts record 3", currency: "NGN", dailyLimit: 52.5801, monthlyLimit: 19.826, status: "active", expiryDate: new Date("2026-01-03 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: virtualAccounts");

  // agentBankingAgents
  await db.insert(schema.agentBankingAgents).values([
    { agentId: "agentBan_agentid_1", tenantId: "tenant-ph-south", agentCode: "agentBan_agentcode_1", businessName: "agentBankingAgents_businessname_1", ownerName: "agentBankingAgents_ownername_1", phoneNumber: "+2347723699071", email: "ngozi.okafor@54bank.ng", bvn: "22457570792", lga: "agentBankingAgents_lga_1", state: "Enugu", agentType: "premium", superAgentId: "agentBan_superagentid_1", status: "completed" },
    { agentId: "agentBan_agentid_2", tenantId: "tenant-kano-north", agentCode: "agentBan_agentcode_2", businessName: "agentBankingAgents_businessname_2", ownerName: "agentBankingAgents_ownername_2", phoneNumber: "+2347660933194", email: "ngozi.okafor@54bank.ng", bvn: "22104367042", lga: "agentBankingAgents_lga_2", state: "Oyo", agentType: "standard", superAgentId: "agentBan_superagentid_2", status: "inactive" },
    { agentId: "agentBan_agentid_3", tenantId: "tenant-abuja-hq", agentCode: "agentBan_agentcode_3", businessName: "agentBankingAgents_businessname_3", ownerName: "agentBankingAgents_ownername_3", phoneNumber: "+2347468151127", email: "kemi.adeyemi@54bank.ng", bvn: "22357391544", lga: "agentBankingAgents_lga_3", state: "Ogun", agentType: "standard", superAgentId: "agentBan_superagentid_3", status: "approved" },
  ]).onConflictDoNothing();
  console.log("  seeded: agentBankingAgents");

  // lendingGroups
  await db.insert(schema.lendingGroups).values([
    { groupId: "lendingG_groupid_1", tenantId: "tenant-abuja-hq", name: "Kemi Adeyemi", purpose: "54Bank lendingGroups record 1", groupLeaderId: "lendingG_groupleaderid_1", groupLeaderName: "lendingGroups_groupleadername_1", maxMembers: 66, liabilityType: "standard", status: "active" },
    { groupId: "lendingG_groupid_2", tenantId: "tenant-abuja-hq", name: "Dangote Industries Ltd", purpose: "54Bank lendingGroups record 2", groupLeaderId: "lendingG_groupleaderid_2", groupLeaderName: "lendingGroups_groupleadername_2", maxMembers: 19, liabilityType: "basic", status: "pending" },
    { groupId: "lendingG_groupid_3", tenantId: "tenant-abuja-hq", name: "Samuel Eze", purpose: "54Bank lendingGroups record 3", groupLeaderId: "lendingG_groupleaderid_3", groupLeaderName: "lendingGroups_groupleadername_3", maxMembers: 9, liabilityType: "premium", status: "inactive" },
  ]).onConflictDoNothing();
  console.log("  seeded: lendingGroups");

  // identityProfiles
  await db.insert(schema.identityProfiles).values([
    { profileId: "identity_profileid_1", tenantId: "tenant-ph-south", customerId: "identity_customerid_1", customerName: "identityProfiles_customername_1", email: "samuel.eze@54bank.ng", phoneNumber: "+2348511273025", bvn: "22931972518", nin: "identityProfiles_nin_1", mfaMethods: {"key": "value"}, activeChannels: {"key": "value"}, status: "approved", lastLoginAt: new Date("2025-07-31 00:00:00") },
    { profileId: "identity_profileid_2", tenantId: "tenant-abuja-hq", customerId: "identity_customerid_2", customerName: "identityProfiles_customername_2", email: "ibrahim.musa@54bank.ng", phoneNumber: "+2347684279916", bvn: "22989705595", nin: "identityProfiles_nin_2", mfaMethods: {"key": "value"}, activeChannels: {"key": "value"}, status: "rejected", lastLoginAt: new Date("2025-06-26 00:00:00") },
    { profileId: "identity_profileid_3", tenantId: "tenant-kano-north", customerId: "identity_customerid_3", customerName: "identityProfiles_customername_3", email: "tunde.bakare@54bank.ng", phoneNumber: "+2348198469027", bvn: "22354386265", nin: "identityProfiles_nin_3", mfaMethods: {"key": "value"}, activeChannels: {"key": "value"}, status: "completed", lastLoginAt: new Date("2025-11-15 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: identityProfiles");

  // disputeCases
  await db.insert(schema.disputeCases).values([
    { disputeId: "disputeC_disputeid_1", tenantId: "tenant-lagos-main", customerId: "disputeC_customerid_1", customerName: "disputeCases_customername_1", category: "premium", description: "54Bank disputeCases record 1", transactionId: "disputeC_transactionid_1", transactionAmount: 202919552.13, disputedAmount: 161043256.47, channel: "disputeCases_channel_1", status: "rejected", slaDeadline: new Date("2026-04-16 00:00:00"), assignedTo: "disputeCases_assignedto_1", resolution: "disputeCases_resolution_1", resolutionAmount: 286431564.99 },
    { disputeId: "disputeC_disputeid_2", tenantId: "tenant-kano-north", customerId: "disputeC_customerid_2", customerName: "disputeCases_customername_2", category: "standard", description: "54Bank disputeCases record 2", transactionId: "disputeC_transactionid_2", transactionAmount: 32912252.37, disputedAmount: 483004651.33, channel: "disputeCases_channel_2", status: "approved", slaDeadline: new Date("2026-01-21 00:00:00"), assignedTo: "disputeCases_assignedto_2", resolution: "disputeCases_resolution_2", resolutionAmount: 174810610.44 },
    { disputeId: "disputeC_disputeid_3", tenantId: "tenant-ph-south", customerId: "disputeC_customerid_3", customerName: "disputeCases_customername_3", category: "standard", description: "54Bank disputeCases record 3", transactionId: "disputeC_transactionid_3", transactionAmount: 463459229.28, disputedAmount: 194408568.22, channel: "disputeCases_channel_3", status: "rejected", slaDeadline: new Date("2025-10-19 00:00:00"), assignedTo: "disputeCases_assignedto_3", resolution: "disputeCases_resolution_3", resolutionAmount: 87105681.84 },
  ]).onConflictDoNothing();
  console.log("  seeded: disputeCases");

  // reconciliationRuns
  await db.insert(schema.reconciliationRuns).values([
    { runId: "reconcil_runid_1", tenantId: "tenant-kano-north", runType: "standard", scope: "reconciliationRuns_scope_1", status: "active", durationMs: 78, startTime: new Date("2026-04-21 00:00:00"), endTime: new Date("2025-12-15 00:00:00") },
    { runId: "reconcil_runid_2", tenantId: "tenant-ph-south", runType: "basic", scope: "reconciliationRuns_scope_2", status: "pending", durationMs: 26, startTime: new Date("2025-07-06 00:00:00"), endTime: new Date("2025-10-28 00:00:00") },
    { runId: "reconcil_runid_3", tenantId: "tenant-ph-south", runType: "premium", scope: "reconciliationRuns_scope_3", status: "rejected", durationMs: 95, startTime: new Date("2025-10-08 00:00:00"), endTime: new Date("2026-02-28 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: reconciliationRuns");

  // erpnextSyncJobs
  await db.insert(schema.erpnextSyncJobs).values([
    { jobId: "erpnextS_jobid_1", tenantId: "tenant-abuja-hq", syncType: "standard", direction: "erpnextSyncJobs_direction_1", status: "active", startedAt: new Date("2026-02-09 00:00:00"), completedAt: new Date("2026-04-11 00:00:00"), errorMessage: "erpnextSyncJobs_errormessage_1" },
    { jobId: "erpnextS_jobid_2", tenantId: "tenant-ph-south", syncType: "basic", direction: "erpnextSyncJobs_direction_2", status: "inactive", startedAt: new Date("2026-03-19 00:00:00"), completedAt: new Date("2025-06-12 00:00:00"), errorMessage: "erpnextSyncJobs_errormessage_2" },
    { jobId: "erpnextS_jobid_3", tenantId: "tenant-lagos-main", syncType: "basic", direction: "erpnextSyncJobs_direction_3", status: "completed", startedAt: new Date("2025-12-12 00:00:00"), completedAt: new Date("2025-07-08 00:00:00"), errorMessage: "erpnextSyncJobs_errormessage_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: erpnextSyncJobs");

  // regulatoryReports
  await db.insert(schema.regulatoryReports).values([
    { reportId: "regulato_reportid_1", tenantId: "tenant-kano-north", reportType: "premium", period: "regulatoryReports_period_1", status: "completed", submittedTo: "regulatoryReports_submittedto_1", submittedAt: new Date("2026-02-07 00:00:00"), data: {"key": "value"}, summary: {"key": "value"} },
    { reportId: "regulato_reportid_2", tenantId: "tenant-abuja-hq", reportType: "standard", period: "regulatoryReports_period_2", status: "inactive", submittedTo: "regulatoryReports_submittedto_2", submittedAt: new Date("2025-05-23 00:00:00"), data: {"key": "value"}, summary: {"key": "value"} },
    { reportId: "regulato_reportid_3", tenantId: "tenant-lagos-main", reportType: "basic", period: "regulatoryReports_period_3", status: "approved", submittedTo: "regulatoryReports_submittedto_3", submittedAt: new Date("2025-09-19 00:00:00"), data: {"key": "value"}, summary: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: regulatoryReports");

  // accounts
  await db.insert(schema.accounts).values([
    { accountId: "accounts_accountid_1", customerId: "accounts_customerid_1", tenantId: "tenant-ph-south", accountName: "accounts_accountname_1", accountType: "basic", currency: "GBP", balance: 23334291.14, availableBalance: 249228860.87, ledgerBalance: 50468438.68, status: "completed", branchCode: "ABJ-001", lastTransactionAt: new Date("2025-08-21 00:00:00"), version: 8, tigerbeetleAccountId: "accounts_tigerbeetleaccountid_1" },
    { accountId: "accounts_accountid_2", customerId: "accounts_customerid_2", tenantId: "tenant-abuja-hq", accountName: "accounts_accountname_2", accountType: "basic", currency: "NGN", balance: 123770600.69, availableBalance: 138575371.53, ledgerBalance: 162836642.48, status: "pending", branchCode: "LOS-001", lastTransactionAt: new Date("2026-05-11 00:00:00"), version: 31, tigerbeetleAccountId: "accounts_tigerbeetleaccountid_2" },
    { accountId: "accounts_accountid_3", customerId: "accounts_customerid_3", tenantId: "tenant-ph-south", accountName: "accounts_accountname_3", accountType: "premium", currency: "USD", balance: 297769814.42, availableBalance: 168649681.6, ledgerBalance: 146367586.22, status: "rejected", branchCode: "ABJ-001", lastTransactionAt: new Date("2026-04-18 00:00:00"), version: 38, tigerbeetleAccountId: "accounts_tigerbeetleaccountid_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: accounts");

  // transactions
  await db.insert(schema.transactions).values([
    { transactionId: "transact_transactionid_1", accountId: "transact_accountid_1", tenantId: "tenant-kano-north", type: "standard", amount: 269749944.61, currency: "GBP", narration: "transactions_narration_1", reference: "54B-TRAN-861222", channel: "transactions_channel_1", counterpartyAccountId: "transact_counterpartyaccountid_1", counterpartyName: "transactions_counterpartyname_1", balanceAfter: 436838487.84, status: "completed" },
    { transactionId: "transact_transactionid_2", accountId: "transact_accountid_2", tenantId: "tenant-ph-south", type: "premium", amount: 44238942.03, currency: "USD", narration: "transactions_narration_2", reference: "54B-TRAN-603814", channel: "transactions_channel_2", counterpartyAccountId: "transact_counterpartyaccountid_2", counterpartyName: "transactions_counterpartyname_2", balanceAfter: 255957066.18, status: "active" },
    { transactionId: "transact_transactionid_3", accountId: "transact_accountid_3", tenantId: "tenant-kano-north", type: "basic", amount: 113115411.83, currency: "GBP", narration: "transactions_narration_3", reference: "54B-TRAN-409607", channel: "transactions_channel_3", counterpartyAccountId: "transact_counterpartyaccountid_3", counterpartyName: "transactions_counterpartyname_3", balanceAfter: 129953738.07, status: "pending" },
  ]).onConflictDoNothing();
  console.log("  seeded: transactions");

  // journalEntries
  await db.insert(schema.journalEntries).values([
    { entryId: "journalE_entryid_1", tenantId: "tenant-ph-south", accountId: "journalE_accountid_1", glAccountCode: "journalE_glaccountcode_1", type: "basic", amount: 199475033.33, currency: "GBP", narration: "journalEntries_narration_1", transactionRef: "54B-JOUR-143153", batchId: "journalE_batchid_1", reversalOf: "journalEntries_reversalof_1" },
    { entryId: "journalE_entryid_2", tenantId: "tenant-kano-north", accountId: "journalE_accountid_2", glAccountCode: "journalE_glaccountcode_2", type: "premium", amount: 379037096.91, currency: "USD", narration: "journalEntries_narration_2", transactionRef: "54B-JOUR-398462", batchId: "journalE_batchid_2", reversalOf: "journalEntries_reversalof_2" },
    { entryId: "journalE_entryid_3", tenantId: "tenant-abuja-hq", accountId: "journalE_accountid_3", glAccountCode: "journalE_glaccountcode_3", type: "premium", amount: 190418925.12, currency: "NGN", narration: "journalEntries_narration_3", transactionRef: "54B-JOUR-143878", batchId: "journalE_batchid_3", reversalOf: "journalEntries_reversalof_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: journalEntries");

  // glAccounts
  await db.insert(schema.glAccounts).values([
    { glAccountCode: "glAccoun_glaccountcode_1", tenantId: "tenant-abuja-hq", name: "Ibrahim Musa", category: "standard", subcategory: "premium", parentCode: "glAccoun_parentcode_1", currency: "NGN", balance: 476261505.21, status: "approved", isControlAccount: 33 },
    { glAccountCode: "glAccoun_glaccountcode_2", tenantId: "tenant-kano-north", name: "Kano Textiles Ltd", category: "premium", subcategory: "premium", parentCode: "glAccoun_parentcode_2", currency: "USD", balance: 317718156.75, status: "pending", isControlAccount: 224 },
    { glAccountCode: "glAccoun_glaccountcode_3", tenantId: "tenant-lagos-main", name: "Uchenna Ikenna", category: "basic", subcategory: "premium", parentCode: "glAccoun_parentcode_3", currency: "GBP", balance: 240181740.17, status: "inactive", isControlAccount: 218 },
  ]).onConflictDoNothing();
  console.log("  seeded: glAccounts");

  // loans
  await db.insert(schema.loans).values([
    { loanId: "loans_loanid_1", customerId: "loans_customerid_1", tenantId: "tenant-lagos-main", loanType: "premium", principalAmount: 20329877.35, outstandingBalance: 120899345.77, interestRate: 15.6545, currency: "NGN", tenor: 74, tenorUnit: "loans_tenorunit_1", disbursementDate: new Date("2026-04-29 00:00:00"), maturityDate: new Date("2026-02-02 00:00:00"), nextPaymentDate: new Date("2025-07-14 00:00:00"), nextPaymentAmount: 263524070.83, status: "rejected", collateralValue: 221492241.06, approvedBy: "loans_approvedby_1" },
    { loanId: "loans_loanid_2", customerId: "loans_customerid_2", tenantId: "tenant-ph-south", loanType: "premium", principalAmount: 462292084.18, outstandingBalance: 2632313.39, interestRate: 14.0688, currency: "EUR", tenor: 78, tenorUnit: "loans_tenorunit_2", disbursementDate: new Date("2025-07-01 00:00:00"), maturityDate: new Date("2025-05-24 00:00:00"), nextPaymentDate: new Date("2025-11-06 00:00:00"), nextPaymentAmount: 184661148.64, status: "active", collateralValue: 409449685.36, approvedBy: "loans_approvedby_2" },
    { loanId: "loans_loanid_3", customerId: "loans_customerid_3", tenantId: "tenant-lagos-main", loanType: "basic", principalAmount: 312409017.32, outstandingBalance: 290516515.81, interestRate: 16.3313, currency: "USD", tenor: 87, tenorUnit: "loans_tenorunit_3", disbursementDate: new Date("2025-08-18 00:00:00"), maturityDate: new Date("2025-05-29 00:00:00"), nextPaymentDate: new Date("2025-09-24 00:00:00"), nextPaymentAmount: 192655879.46, status: "pending", collateralValue: 351862314.45, approvedBy: "loans_approvedby_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: loans");

  // loanRepayments
  await db.insert(schema.loanRepayments).values([
    { repaymentId: "loanRepa_repaymentid_1", loanId: "loanRepa_loanid_1", tenantId: "tenant-ph-south", principalPortion: 98.6182, interestPortion: 5.4455, penaltyPortion: 2.4263, totalAmount: 108790651.56, dueDate: new Date("2025-08-08 00:00:00"), paidDate: new Date("2025-11-03 00:00:00"), status: "completed", transactionRef: "54B-LOAN-200051" },
    { repaymentId: "loanRepa_repaymentid_2", loanId: "loanRepa_loanid_2", tenantId: "tenant-kano-north", principalPortion: 45.8345, interestPortion: 42.1602, penaltyPortion: 15.1073, totalAmount: 156628521.02, dueDate: new Date("2025-08-30 00:00:00"), paidDate: new Date("2025-05-16 00:00:00"), status: "active", transactionRef: "54B-LOAN-318321" },
    { repaymentId: "loanRepa_repaymentid_3", loanId: "loanRepa_loanid_3", tenantId: "tenant-abuja-hq", principalPortion: 59.3834, interestPortion: 35.6762, penaltyPortion: 34.9854, totalAmount: 290483363.97, dueDate: new Date("2025-11-26 00:00:00"), paidDate: new Date("2025-05-20 00:00:00"), status: "approved", transactionRef: "54B-LOAN-953801" },
  ]).onConflictDoNothing();
  console.log("  seeded: loanRepayments");

  // transfers
  await db.insert(schema.transfers).values([
    { transferId: "transfer_transferid_1", tenantId: "tenant-abuja-hq", sourceAccountId: "transfer_sourceaccountid_1", destinationAccountId: "transfer_destinationaccountid_1", destinationBank: "transfers_destinationbank_1", destinationAccountNumber: "5482183750", beneficiaryName: "transfers_beneficiaryname_1", amount: 187349222.44, currency: "EUR", channel: "transfers_channel_1", narration: "transfers_narration_1", nipSessionId: "transfer_nipsessionid_1", mojaloopTransferId: "transfer_mojalooptransferid_1", status: "approved", failureReason: "54Bank transfers record 1", idempotencyKey: "transfer_idempotencykey_1", completedAt: new Date("2025-06-10 00:00:00") },
    { transferId: "transfer_transferid_2", tenantId: "tenant-ph-south", sourceAccountId: "transfer_sourceaccountid_2", destinationAccountId: "transfer_destinationaccountid_2", destinationBank: "transfers_destinationbank_2", destinationAccountNumber: "5433688014", beneficiaryName: "transfers_beneficiaryname_2", amount: 332913000.22, currency: "EUR", channel: "transfers_channel_2", narration: "transfers_narration_2", nipSessionId: "transfer_nipsessionid_2", mojaloopTransferId: "transfer_mojalooptransferid_2", status: "pending", failureReason: "54Bank transfers record 2", idempotencyKey: "transfer_idempotencykey_2", completedAt: new Date("2025-05-26 00:00:00") },
    { transferId: "transfer_transferid_3", tenantId: "tenant-kano-north", sourceAccountId: "transfer_sourceaccountid_3", destinationAccountId: "transfer_destinationaccountid_3", destinationBank: "transfers_destinationbank_3", destinationAccountNumber: "5479726344", beneficiaryName: "transfers_beneficiaryname_3", amount: 271619163.89, currency: "USD", channel: "transfers_channel_3", narration: "transfers_narration_3", nipSessionId: "transfer_nipsessionid_3", mojaloopTransferId: "transfer_mojalooptransferid_3", status: "rejected", failureReason: "54Bank transfers record 3", idempotencyKey: "transfer_idempotencykey_3", completedAt: new Date("2026-05-03 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: transfers");

  // settlements
  await db.insert(schema.settlements).values([
    { settlementId: "settleme_settlementid_1", tenantId: "tenant-ph-south", windowId: "settleme_windowid_1", model: "settlements_model_1", corridor: "settleme_corridor_1", totalDebits: 19.3446, totalCredits: 10.8579, netPosition: 10.9834, currency: "NGN", participantCount: 248, transferCount: 9, status: "approved", closedAt: new Date("2025-12-17 00:00:00"), settledAt: new Date("2025-07-25 00:00:00") },
    { settlementId: "settleme_settlementid_2", tenantId: "tenant-kano-north", windowId: "settleme_windowid_2", model: "settlements_model_2", corridor: "settleme_corridor_2", totalDebits: 46.0308, totalCredits: 92.4104, netPosition: 95.9422, currency: "GBP", participantCount: 237, transferCount: 242, status: "inactive", closedAt: new Date("2025-07-16 00:00:00"), settledAt: new Date("2026-02-05 00:00:00") },
    { settlementId: "settleme_settlementid_3", tenantId: "tenant-kano-north", windowId: "settleme_windowid_3", model: "settlements_model_3", corridor: "settleme_corridor_3", totalDebits: 42.826, totalCredits: 85.1896, netPosition: 18.0554, currency: "GBP", participantCount: 340, transferCount: 149, status: "completed", closedAt: new Date("2026-03-07 00:00:00"), settledAt: new Date("2025-11-30 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: settlements");

  // amlAlerts
  await db.insert(schema.amlAlerts).values([
    { alertId: "amlAlert_alertid_1", tenantId: "tenant-ph-south", customerId: "amlAlert_customerid_1", entityType: "basic", entityId: "amlAlert_entityid_1", ruleId: "amlAlert_ruleid_1", ruleName: "amlAlerts_rulename_1", riskScore: 21.8153, severity: "amlAlerts_severity_1", status: "pending", assignedTo: "amlAlerts_assignedto_1", notes: "54Bank amlAlerts record 1", resolvedAt: new Date("2025-08-23 00:00:00") },
    { alertId: "amlAlert_alertid_2", tenantId: "tenant-kano-north", customerId: "amlAlert_customerid_2", entityType: "basic", entityId: "amlAlert_entityid_2", ruleId: "amlAlert_ruleid_2", ruleName: "amlAlerts_rulename_2", riskScore: 2.7946, severity: "amlAlerts_severity_2", status: "completed", assignedTo: "amlAlerts_assignedto_2", notes: "54Bank amlAlerts record 2", resolvedAt: new Date("2025-08-15 00:00:00") },
    { alertId: "amlAlert_alertid_3", tenantId: "tenant-ph-south", customerId: "amlAlert_customerid_3", entityType: "standard", entityId: "amlAlert_entityid_3", ruleId: "amlAlert_ruleid_3", ruleName: "amlAlerts_rulename_3", riskScore: 8.2264, severity: "amlAlerts_severity_3", status: "approved", assignedTo: "amlAlerts_assignedto_3", notes: "54Bank amlAlerts record 3", resolvedAt: new Date("2025-07-24 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: amlAlerts");

  // kycVerifications
  await db.insert(schema.kycVerifications).values([
    { verificationId: "kycVerif_verificationid_1", customerId: "kycVerif_customerid_1", tenantId: "tenant-lagos-main", verificationType: "basic", documentReference: "54B-KYCV-416156", provider: "kycVerif_provider_1", providerResponse: {"key": "value"}, matchScore: 16.1103, status: "completed", verifiedAt: new Date("2025-12-19 00:00:00"), expiresAt: new Date("2025-07-28 00:00:00") },
    { verificationId: "kycVerif_verificationid_2", customerId: "kycVerif_customerid_2", tenantId: "tenant-lagos-main", verificationType: "standard", documentReference: "54B-KYCV-465194", provider: "kycVerif_provider_2", providerResponse: {"key": "value"}, matchScore: 23.9802, status: "active", verifiedAt: new Date("2025-08-16 00:00:00"), expiresAt: new Date("2025-11-14 00:00:00") },
    { verificationId: "kycVerif_verificationid_3", customerId: "kycVerif_customerid_3", tenantId: "tenant-lagos-main", verificationType: "standard", documentReference: "54B-KYCV-443187", provider: "kycVerif_provider_3", providerResponse: {"key": "value"}, matchScore: 19.0038, status: "approved", verifiedAt: new Date("2026-01-24 00:00:00"), expiresAt: new Date("2026-03-11 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: kycVerifications");

  // fxTrades
  await db.insert(schema.fxTrades).values([
    { tradeId: "fxTrades_tradeid_1", tenantId: "tenant-kano-north", buyCurrency: "USD", sellCurrency: "GBP", buyAmount: 384735293.17, sellAmount: 427334825.49, exchangeRate: 3.2127, tradeType: "basic", counterparty: "fxTrades_counterparty_1", valueDate: new Date("2026-03-30 00:00:00"), status: "completed", traderId: "fxTrades_traderid_1", approvedBy: "fxTrades_approvedby_1" },
    { tradeId: "fxTrades_tradeid_2", tenantId: "tenant-abuja-hq", buyCurrency: "USD", sellCurrency: "EUR", buyAmount: 147482847.68, sellAmount: 274391796.35, exchangeRate: 22.7199, tradeType: "standard", counterparty: "fxTrades_counterparty_2", valueDate: new Date("2026-04-26 00:00:00"), status: "completed", traderId: "fxTrades_traderid_2", approvedBy: "fxTrades_approvedby_2" },
    { tradeId: "fxTrades_tradeid_3", tenantId: "tenant-lagos-main", buyCurrency: "EUR", sellCurrency: "USD", buyAmount: 78862970.3, sellAmount: 18196300.26, exchangeRate: 14.1834, tradeType: "standard", counterparty: "fxTrades_counterparty_3", valueDate: new Date("2025-11-10 00:00:00"), status: "approved", traderId: "fxTrades_traderid_3", approvedBy: "fxTrades_approvedby_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: fxTrades");

  // nostroAccounts
  await db.insert(schema.nostroAccounts).values([
    { nostroId: "nostroAc_nostroid_1", tenantId: "tenant-abuja-hq", correspondentBank: "nostroAccounts_correspondentbank_1", currency: "EUR", accountNumber: "5476063158", swiftCode: "nostroAc_swiftcode_1", balance: 327003105.62, lastReconciledAt: new Date("2025-08-18 00:00:00"), status: "completed" },
    { nostroId: "nostroAc_nostroid_2", tenantId: "tenant-abuja-hq", correspondentBank: "nostroAccounts_correspondentbank_2", currency: "NGN", accountNumber: "5477897892", swiftCode: "nostroAc_swiftcode_2", balance: 437878890.37, lastReconciledAt: new Date("2026-04-08 00:00:00"), status: "pending" },
    { nostroId: "nostroAc_nostroid_3", tenantId: "tenant-abuja-hq", correspondentBank: "nostroAccounts_correspondentbank_3", currency: "NGN", accountNumber: "5475661681", swiftCode: "nostroAc_swiftcode_3", balance: 417525395.39, lastReconciledAt: new Date("2025-07-11 00:00:00"), status: "completed" },
  ]).onConflictDoNothing();
  console.log("  seeded: nostroAccounts");

  // auditTrail
  await db.insert(schema.auditTrail).values([
    { auditId: "auditTra_auditid_1", tenantId: "tenant-lagos-main", entityType: "premium", entityId: "auditTra_entityid_1", action: "auditTrail_action_1", actorId: "auditTra_actorid_1", actorRole: "admin", changes: {"key": "value"}, ipAddress: "190 Marina Street, Rivers", userAgent: "auditTrail_useragent_1" },
    { auditId: "auditTra_auditid_2", tenantId: "tenant-ph-south", entityType: "standard", entityId: "auditTra_entityid_2", action: "auditTrail_action_2", actorId: "auditTra_actorid_2", actorRole: "branch_manager", changes: {"key": "value"}, ipAddress: "82 Allen Street, Enugu", userAgent: "auditTrail_useragent_2" },
    { auditId: "auditTra_auditid_3", tenantId: "tenant-ph-south", entityType: "premium", entityId: "auditTra_entityid_3", action: "auditTrail_action_3", actorId: "auditTra_actorid_3", actorRole: "teller", changes: {"key": "value"}, ipAddress: "151 Marina Street, Imo", userAgent: "auditTrail_useragent_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: auditTrail");

  // swiftMessages
  await db.insert(schema.swiftMessages).values([
    { messageId: "swiftMes_messageid_1", tenantId: "tenant-ph-south", messageType: "basic", direction: "swiftMessages_direction_1", senderBic: "swiftMessages_senderbic_1", receiverBic: "swiftMessages_receiverbic_1", amount: 448028515.23, currency: "NGN", valueDate: new Date("2026-01-21 00:00:00"), rawMessage: "swiftMessages_rawmessage_1", status: "completed", relatedTransferId: "swiftMes_relatedtransferid_1" },
    { messageId: "swiftMes_messageid_2", tenantId: "tenant-ph-south", messageType: "basic", direction: "swiftMessages_direction_2", senderBic: "swiftMessages_senderbic_2", receiverBic: "swiftMessages_receiverbic_2", amount: 241615612.44, currency: "USD", valueDate: new Date("2025-10-03 00:00:00"), rawMessage: "swiftMessages_rawmessage_2", status: "rejected", relatedTransferId: "swiftMes_relatedtransferid_2" },
    { messageId: "swiftMes_messageid_3", tenantId: "tenant-kano-north", messageType: "basic", direction: "swiftMessages_direction_3", senderBic: "swiftMessages_senderbic_3", receiverBic: "swiftMessages_receiverbic_3", amount: 408569968.22, currency: "USD", valueDate: new Date("2025-09-28 00:00:00"), rawMessage: "swiftMessages_rawmessage_3", status: "inactive", relatedTransferId: "swiftMes_relatedtransferid_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: swiftMessages");

  // nipTransactions
  await db.insert(schema.nipTransactions).values([
    { nipId: "nipTrans_nipid_1", tenantId: "tenant-abuja-hq", sessionId: "nipTrans_sessionid_1", direction: "nipTransactions_direction_1", sourceBank: "nipTransactions_sourcebank_1", destinationBank: "nipTransactions_destinationbank_1", sourceAccount: "nipTransactions_sourceaccount_1", destinationAccount: "nipTransactions_destinationaccount_1", amount: 109027547.89, narration: "nipTransactions_narration_1", responseCode: "nipTrans_responsecode_1", status: "active", completedAt: new Date("2025-09-10 00:00:00") },
    { nipId: "nipTrans_nipid_2", tenantId: "tenant-lagos-main", sessionId: "nipTrans_sessionid_2", direction: "nipTransactions_direction_2", sourceBank: "nipTransactions_sourcebank_2", destinationBank: "nipTransactions_destinationbank_2", sourceAccount: "nipTransactions_sourceaccount_2", destinationAccount: "nipTransactions_destinationaccount_2", amount: 433641412.25, narration: "nipTransactions_narration_2", responseCode: "nipTrans_responsecode_2", status: "inactive", completedAt: new Date("2026-05-12 00:00:00") },
    { nipId: "nipTrans_nipid_3", tenantId: "tenant-kano-north", sessionId: "nipTrans_sessionid_3", direction: "nipTransactions_direction_3", sourceBank: "nipTransactions_sourcebank_3", destinationBank: "nipTransactions_destinationbank_3", sourceAccount: "nipTransactions_sourceaccount_3", destinationAccount: "nipTransactions_destinationaccount_3", amount: 354637268.02, narration: "nipTransactions_narration_3", responseCode: "nipTrans_responsecode_3", status: "rejected", completedAt: new Date("2026-05-10 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: nipTransactions");

  // cardTransactions
  await db.insert(schema.cardTransactions).values([
    { cardTxnId: "cardTran_cardtxnid_1", tenantId: "tenant-kano-north", cardId: "cardTran_cardid_1", accountId: "cardTran_accountid_1", merchantName: "cardTransactions_merchantname_1", merchantCategory: "basic", amount: 82926955.07, currency: "USD", type: "standard", channel: "cardTransactions_channel_1", authorizationCode: "cardTran_authorizationcode_1", stan: "cardTransactions_stan_1", rrn: "cardTransactions_rrn_1", status: "pending", declineReason: "54Bank cardTransactions record 1" },
    { cardTxnId: "cardTran_cardtxnid_2", tenantId: "tenant-lagos-main", cardId: "cardTran_cardid_2", accountId: "cardTran_accountid_2", merchantName: "cardTransactions_merchantname_2", merchantCategory: "premium", amount: 296041965.47, currency: "NGN", type: "basic", channel: "cardTransactions_channel_2", authorizationCode: "cardTran_authorizationcode_2", stan: "cardTransactions_stan_2", rrn: "cardTransactions_rrn_2", status: "active", declineReason: "54Bank cardTransactions record 2" },
    { cardTxnId: "cardTran_cardtxnid_3", tenantId: "tenant-lagos-main", cardId: "cardTran_cardid_3", accountId: "cardTran_accountid_3", merchantName: "cardTransactions_merchantname_3", merchantCategory: "premium", amount: 325102494.11, currency: "GBP", type: "premium", channel: "cardTransactions_channel_3", authorizationCode: "cardTran_authorizationcode_3", stan: "cardTransactions_stan_3", rrn: "cardTransactions_rrn_3", status: "completed", declineReason: "54Bank cardTransactions record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: cardTransactions");

  // trialBalances
  await db.insert(schema.trialBalances).values([
    { trialBalanceId: "trialBal_trialbalanceid_1", tenantId: "tenant-abuja-hq", glAccountCode: "trialBal_glaccountcode_1", periodStart: new Date("2026-02-17 00:00:00"), periodEnd: new Date("2025-11-27 00:00:00"), openingBalance: 180379663.96, totalDebits: 34.7881, totalCredits: 19.8845, closingBalance: 380009872.11, currency: "EUR", status: "active" },
    { trialBalanceId: "trialBal_trialbalanceid_2", tenantId: "tenant-abuja-hq", glAccountCode: "trialBal_glaccountcode_2", periodStart: new Date("2026-03-10 00:00:00"), periodEnd: new Date("2025-10-15 00:00:00"), openingBalance: 365957593.07, totalDebits: 74.1514, totalCredits: 61.3254, closingBalance: 498511896.17, currency: "NGN", status: "approved" },
    { trialBalanceId: "trialBal_trialbalanceid_3", tenantId: "tenant-kano-north", glAccountCode: "trialBal_glaccountcode_3", periodStart: new Date("2026-02-06 00:00:00"), periodEnd: new Date("2026-02-07 00:00:00"), openingBalance: 22415466.75, totalDebits: 34.5177, totalCredits: 6.2738, closingBalance: 494791667.96, currency: "NGN", status: "completed" },
  ]).onConflictDoNothing();
  console.log("  seeded: trialBalances");

  // kyc_tiers
  await db.insert(schema.kycTiers).values([
    { customerId: "kyc_tier_customer_id_1", customerName: "kyc_tiers_customer_name_1", currentTier: 45, dailyLimitNGN: 77.7213, dailyUsedNGN: 68.0829, evaluationScore: 0.5272, riskFlags: {"key": "value"}, status: "pending", lastEvaluatedAt: new Date("2025-12-10 00:00:00") },
    { customerId: "kyc_tier_customer_id_2", customerName: "kyc_tiers_customer_name_2", currentTier: 29, dailyLimitNGN: 76.3238, dailyUsedNGN: 49.7564, evaluationScore: 14.1985, riskFlags: {"key": "value"}, status: "pending", lastEvaluatedAt: new Date("2025-11-13 00:00:00") },
    { customerId: "kyc_tier_customer_id_3", customerName: "kyc_tiers_customer_name_3", currentTier: 78, dailyLimitNGN: 4.7022, dailyUsedNGN: 21.1981, evaluationScore: 5.856, riskFlags: {"key": "value"}, status: "pending", lastEvaluatedAt: new Date("2025-11-29 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: kyc_tiers");

  // kyc_tier_history
  await db.insert(schema.kycTierHistory).values([
    { customerId: "kyc_tier_customer_id_1", previousTier: 87, newTier: 47, reason: "54Bank kyc_tier_history record 1", changedBy: "kyc_tier_history_changed_by_1" },
    { customerId: "kyc_tier_customer_id_2", previousTier: 23, newTier: 81, reason: "54Bank kyc_tier_history record 2", changedBy: "kyc_tier_history_changed_by_2" },
    { customerId: "kyc_tier_customer_id_3", previousTier: 92, newTier: 41, reason: "54Bank kyc_tier_history record 3", changedBy: "kyc_tier_history_changed_by_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: kyc_tier_history");

  // sanctions_screenings
  await db.insert(schema.sanctionsScreenings).values([
    { entityName: "sanctions_screenings_entity_name_1", entityType: "premium", listsChecked: {"key": "value"}, matchFound: 48, highestScore: 24.7543, matchDetails: {"key": "value"}, status: "inactive", screenedBy: "sanctions_screenings_screened_by_1" },
    { entityName: "sanctions_screenings_entity_name_2", entityType: "basic", listsChecked: {"key": "value"}, matchFound: 25, highestScore: 17.5839, matchDetails: {"key": "value"}, status: "completed", screenedBy: "sanctions_screenings_screened_by_2" },
    { entityName: "sanctions_screenings_entity_name_3", entityType: "standard", listsChecked: {"key": "value"}, matchFound: 9, highestScore: 17.8172, matchDetails: {"key": "value"}, status: "active", screenedBy: "sanctions_screenings_screened_by_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: sanctions_screenings");

  // transaction_monitoring_rules
  await db.insert(schema.transactionMonitoringRules).values([
    { name: "Samuel Eze", category: "basic", scenarioCode: "transact_scenario_code_1", description: "54Bank transaction_monitoring_rules record 1", riskScoreImpact: 90, enabled: 70, cbnPrescribed: 28, thresholdConfig: {"region": "west_africa", "currency": "NGN"} },
    { name: "Emeka & Sons Trading", category: "basic", scenarioCode: "transact_scenario_code_2", description: "54Bank transaction_monitoring_rules record 2", riskScoreImpact: 90, enabled: 79, cbnPrescribed: 5, thresholdConfig: {"region": "west_africa", "currency": "NGN"} },
    { name: "Ibrahim Musa", category: "basic", scenarioCode: "transact_scenario_code_3", description: "54Bank transaction_monitoring_rules record 3", riskScoreImpact: 72, enabled: 59, cbnPrescribed: 32, thresholdConfig: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: transaction_monitoring_rules");

  // transaction_alerts
  await db.insert(schema.transactionAlerts).values([
    { ruleId: 63, customerId: "transact_customer_id_1", alertType: "premium", severity: "transaction_alerts_severity_1", amountNGN: 164530596.85, description: "54Bank transaction_alerts record 1", status: "active", assignedTo: "transaction_alerts_assigned_to_1", resolvedAt: new Date("2025-06-18 00:00:00") },
    { ruleId: 19, customerId: "transact_customer_id_2", alertType: "premium", severity: "transaction_alerts_severity_2", amountNGN: 344288153.28, description: "54Bank transaction_alerts record 2", status: "completed", assignedTo: "transaction_alerts_assigned_to_2", resolvedAt: new Date("2025-11-15 00:00:00") },
    { ruleId: 52, customerId: "transact_customer_id_3", alertType: "basic", severity: "transaction_alerts_severity_3", amountNGN: 376619202.47, description: "54Bank transaction_alerts record 3", status: "pending", assignedTo: "transaction_alerts_assigned_to_3", resolvedAt: new Date("2026-01-03 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: transaction_alerts");

  // ubo_graph_nodes
  await db.insert(schema.uboGraphNodes).values([
    { entityName: "ubo_graph_nodes_entity_name_1", entityType: "basic", nationality: "ubo_graph_nodes_nationality_1", riskLevel: "ubo_graph_nodes_risk_level_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { entityName: "ubo_graph_nodes_entity_name_2", entityType: "basic", nationality: "ubo_graph_nodes_nationality_2", riskLevel: "ubo_graph_nodes_risk_level_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { entityName: "ubo_graph_nodes_entity_name_3", entityType: "premium", nationality: "ubo_graph_nodes_nationality_3", riskLevel: "ubo_graph_nodes_risk_level_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: ubo_graph_nodes");

  // ubo_graph_edges
  await db.insert(schema.uboGraphEdges).values([
    { sourceId: 95, targetId: 34, relationship: "ubo_graph_edges_relationship_1", ownershipPct: 84.2538 },
    { sourceId: 31, targetId: 33, relationship: "ubo_graph_edges_relationship_2", ownershipPct: 85.9623 },
    { sourceId: 23, targetId: 21, relationship: "ubo_graph_edges_relationship_3", ownershipPct: 28.9162 },
  ]).onConflictDoNothing();
  console.log("  seeded: ubo_graph_edges");

  // risk_scores
  await db.insert(schema.riskScores).values([
    { customerId: "risk_sco_customer_id_1", staticScore: 3.3482, dynamicScore: 6.6647, totalScore: 10.5255, riskTier: "tier_2", factors: {"key": "value"}, lastCalculatedAt: new Date("2026-04-26 00:00:00") },
    { customerId: "risk_sco_customer_id_2", staticScore: 24.9756, dynamicScore: 3.8497, totalScore: 24.9235, riskTier: "tier_3", factors: {"key": "value"}, lastCalculatedAt: new Date("2025-09-27 00:00:00") },
    { customerId: "risk_sco_customer_id_3", staticScore: 16.8211, dynamicScore: 5.3841, totalScore: 16.228, riskTier: "tier_3", factors: {"key": "value"}, lastCalculatedAt: new Date("2025-05-14 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: risk_scores");

  // agent_kyc_captures
  await db.insert(schema.agentKycCaptures).values([
    { agentId: "agent_ky_agent_id_1", agentName: "agent_kyc_captures_agent_name_1", customerId: "agent_ky_customer_id_1", customerName: "agent_kyc_captures_customer_name_1", lga: "agent_kyc_captures_lga_1", state: "Anambra", offlineCapture: 73, qualityScore: 9.3504, gpsLat: 57.7098, gpsLng: 80.6065, syncedAt: new Date("2026-01-01 00:00:00") },
    { agentId: "agent_ky_agent_id_2", agentName: "agent_kyc_captures_agent_name_2", customerId: "agent_ky_customer_id_2", customerName: "agent_kyc_captures_customer_name_2", lga: "agent_kyc_captures_lga_2", state: "Enugu", offlineCapture: 80, qualityScore: 13.6889, gpsLat: 5.0607, gpsLng: 10.1602, syncedAt: new Date("2025-09-30 00:00:00") },
    { agentId: "agent_ky_agent_id_3", agentName: "agent_kyc_captures_agent_name_3", customerId: "agent_ky_customer_id_3", customerName: "agent_kyc_captures_customer_name_3", lga: "agent_kyc_captures_lga_3", state: "Kaduna", offlineCapture: 29, qualityScore: 8.064, gpsLat: 81.3878, gpsLng: 54.1615, syncedAt: new Date("2026-01-17 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: agent_kyc_captures");

  // adverse_media_hits
  await db.insert(schema.adverseMediaHits).values([
    { entityName: "adverse_media_hits_entity_name_1", source: "adverse_media_hits_source_1", headline: "adverse_media_hits_headline_1", riskImpact: "adverse_media_hits_risk_impact_1", sentiment: 53.8144, url: "https://api.54bank.ng/v1/adverse_media_hits/1", reviewedAt: new Date("2025-08-29 00:00:00"), status: "approved" },
    { entityName: "adverse_media_hits_entity_name_2", source: "adverse_media_hits_source_2", headline: "adverse_media_hits_headline_2", riskImpact: "adverse_media_hits_risk_impact_2", sentiment: 67.1458, url: "https://api.54bank.ng/v1/adverse_media_hits/2", reviewedAt: new Date("2025-12-29 00:00:00"), status: "pending" },
    { entityName: "adverse_media_hits_entity_name_3", source: "adverse_media_hits_source_3", headline: "adverse_media_hits_headline_3", riskImpact: "adverse_media_hits_risk_impact_3", sentiment: 59.0451, url: "https://api.54bank.ng/v1/adverse_media_hits/3", reviewedAt: new Date("2025-10-22 00:00:00"), status: "inactive" },
  ]).onConflictDoNothing();
  console.log("  seeded: adverse_media_hits");

  // corporate_monitoring_events
  await db.insert(schema.corporateMonitoringEvents).values([
    { companyId: "corporat_company_id_1", eventType: "basic", description: "54Bank corporate_monitoring_events record 1", riskImpact: "corporate_monitoring_events_risk_impact_1", sourceSystem: "corporate_monitoring_events_source_system_1", acknowledgedAt: new Date("2025-11-25 00:00:00") },
    { companyId: "corporat_company_id_2", eventType: "premium", description: "54Bank corporate_monitoring_events record 2", riskImpact: "corporate_monitoring_events_risk_impact_2", sourceSystem: "corporate_monitoring_events_source_system_2", acknowledgedAt: new Date("2025-10-29 00:00:00") },
    { companyId: "corporat_company_id_3", eventType: "premium", description: "54Bank corporate_monitoring_events record 3", riskImpact: "corporate_monitoring_events_risk_impact_3", sourceSystem: "corporate_monitoring_events_source_system_3", acknowledgedAt: new Date("2026-01-14 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: corporate_monitoring_events");

  // kyc_data_quality_metrics
  await db.insert(schema.kycDataQualityMetrics).values([
    { totalCustomers: 70, kycComplete: 24, kycCompletePct: 87.4857, expiredDocuments: 30, duplicateBVN: 89, missingNIN: 99 },
    { totalCustomers: 70, kycComplete: 92, kycCompletePct: 38.6203, expiredDocuments: 51, duplicateBVN: 95, missingNIN: 78 },
    { totalCustomers: 47, kycComplete: 18, kycCompletePct: 53.0363, expiredDocuments: 14, duplicateBVN: 41, missingNIN: 26 },
  ]).onConflictDoNothing();
  console.log("  seeded: kyc_data_quality_metrics");

  // efass_returns
  await db.insert(schema.efassReturns).values([
    { period: "efass_returns_period_1", type: "premium", tier1Count: 443, tier2Count: 351, tier3Count: 222, totalCustomers: 48, status: "pending", submittedAt: new Date("2025-05-25 00:00:00") },
    { period: "efass_returns_period_2", type: "premium", tier1Count: 156, tier2Count: 88, tier3Count: 106, totalCustomers: 62, status: "inactive", submittedAt: new Date("2026-04-01 00:00:00") },
    { period: "efass_returns_period_3", type: "premium", tier1Count: 293, tier2Count: 150, tier3Count: 356, totalCustomers: 98, status: "pending", submittedAt: new Date("2026-05-08 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: efass_returns");

  // nfiu_filings
  await db.insert(schema.nfiuFilings).values([
    { reportType: "basic", customerId: "nfiu_fil_customer_id_1", customerName: "nfiu_filings_customer_name_1", amountNGN: 4938452.14, transactionType: "premium", status: "active", cbnReference: "54B-NFIU-262979", slaDeadline: new Date("2025-07-31 00:00:00"), filedAt: new Date("2026-02-04 00:00:00") },
    { reportType: "premium", customerId: "nfiu_fil_customer_id_2", customerName: "nfiu_filings_customer_name_2", amountNGN: 251214391.7, transactionType: "standard", status: "approved", cbnReference: "54B-NFIU-529999", slaDeadline: new Date("2026-01-09 00:00:00"), filedAt: new Date("2026-05-13 00:00:00") },
    { reportType: "premium", customerId: "nfiu_fil_customer_id_3", customerName: "nfiu_filings_customer_name_3", amountNGN: 438166337.46, transactionType: "basic", status: "inactive", cbnReference: "54B-NFIU-260070", slaDeadline: new Date("2025-10-06 00:00:00"), filedAt: new Date("2025-09-24 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: nfiu_filings");

  // bureau_checks
  await db.insert(schema.bureauChecks).values([
    { customerId: "bureau_c_customer_id_1", bureau: "bureau_checks_bureau_1", creditScore: 82, riskGrade: "bureau_checks_risk_grade_1", activeLoans: 40, defaultHistory: 93 },
    { customerId: "bureau_c_customer_id_2", bureau: "bureau_checks_bureau_2", creditScore: 14, riskGrade: "bureau_checks_risk_grade_2", activeLoans: 47, defaultHistory: 76 },
    { customerId: "bureau_c_customer_id_3", bureau: "bureau_checks_bureau_3", creditScore: 53, riskGrade: "bureau_checks_risk_grade_3", activeLoans: 53, defaultHistory: 52 },
  ]).onConflictDoNothing();
  console.log("  seeded: bureau_checks");

  // escrow_accounts
  await db.insert(schema.escrowAccounts).values([
    { escrowId: "escrow_a_escrowid_1", tenantId: "tenant-abuja-hq", escrowType: "premium", status: "completed", amount: 164486019.61, currency: "USD", condition: "escrow_accounts_condition_1", expiresAt: new Date("2026-01-11 00:00:00"), tigerBeetleTxId: "escrow_a_tigerbeetletxid_1", kafkaEventId: "escrow_a_kafkaeventid_1", temporalWorkflowId: "escrow_a_temporalworkflowid_1", approvedBy: "escrow_accounts_approvedby_1", releasedAt: new Date("2026-04-02 00:00:00"), cancelledAt: new Date("2026-03-11 00:00:00"), disputeReason: "54Bank escrow_accounts record 1", notes: "54Bank escrow_accounts record 1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { escrowId: "escrow_a_escrowid_2", tenantId: "tenant-lagos-main", escrowType: "standard", status: "inactive", amount: 89898457.09, currency: "NGN", condition: "escrow_accounts_condition_2", expiresAt: new Date("2025-10-04 00:00:00"), tigerBeetleTxId: "escrow_a_tigerbeetletxid_2", kafkaEventId: "escrow_a_kafkaeventid_2", temporalWorkflowId: "escrow_a_temporalworkflowid_2", approvedBy: "escrow_accounts_approvedby_2", releasedAt: new Date("2026-02-12 00:00:00"), cancelledAt: new Date("2025-05-18 00:00:00"), disputeReason: "54Bank escrow_accounts record 2", notes: "54Bank escrow_accounts record 2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { escrowId: "escrow_a_escrowid_3", tenantId: "tenant-kano-north", escrowType: "basic", status: "pending", amount: 443421749.85, currency: "USD", condition: "escrow_accounts_condition_3", expiresAt: new Date("2025-06-08 00:00:00"), tigerBeetleTxId: "escrow_a_tigerbeetletxid_3", kafkaEventId: "escrow_a_kafkaeventid_3", temporalWorkflowId: "escrow_a_temporalworkflowid_3", approvedBy: "escrow_accounts_approvedby_3", releasedAt: new Date("2025-10-17 00:00:00"), cancelledAt: new Date("2025-12-03 00:00:00"), disputeReason: "54Bank escrow_accounts record 3", notes: "54Bank escrow_accounts record 3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_accounts");

  // escrow_parties
  await db.insert(schema.escrowParties).values([
    { escrowId: "escrow_p_escrowid_1", role: "user", name: "Samuel Eze", accountId: "escrow_p_accountid_1", email: "aisha.mohammed@54bank.ng", phone: "+2347805027744", signedAt: new Date("2026-05-02 00:00:00"), metadata: {"region": "west_africa", "currency": "NGN"} },
    { escrowId: "escrow_p_escrowid_2", role: "admin", name: "Kano Textiles Ltd", accountId: "escrow_p_accountid_2", email: "uchenna.ikenna@54bank.ng", phone: "+2347149398149", signedAt: new Date("2025-09-11 00:00:00"), metadata: {"region": "west_africa", "currency": "NGN"} },
    { escrowId: "escrow_p_escrowid_3", role: "admin", name: "Fatima Hassan", accountId: "escrow_p_accountid_3", email: "rashida.bello@54bank.ng", phone: "+2347644639542", signedAt: new Date("2025-07-12 00:00:00"), metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_parties");

  // escrow_transactions
  await db.insert(schema.escrowTransactions).values([
    { txId: "escrow_t_txid_1", escrowId: "escrow_t_escrowid_1", type: "basic", amount: 14287201.91, currency: "GBP", fromAccount: "escrow_transactions_fromaccount_1", toAccount: "escrow_transactions_toaccount_1", status: "active", ledgerRef: "54B-ESCR-897972", milestoneId: "escrow_t_milestoneid_1", narration: "escrow_transactions_narration_1", fxRate: 21.5715, fxSourceCurrency: "NGN" },
    { txId: "escrow_t_txid_2", escrowId: "escrow_t_escrowid_2", type: "basic", amount: 23311238.14, currency: "USD", fromAccount: "escrow_transactions_fromaccount_2", toAccount: "escrow_transactions_toaccount_2", status: "approved", ledgerRef: "54B-ESCR-568198", milestoneId: "escrow_t_milestoneid_2", narration: "escrow_transactions_narration_2", fxRate: 23.2896, fxSourceCurrency: "GBP" },
    { txId: "escrow_t_txid_3", escrowId: "escrow_t_escrowid_3", type: "premium", amount: 461599595.58, currency: "GBP", fromAccount: "escrow_transactions_fromaccount_3", toAccount: "escrow_transactions_toaccount_3", status: "pending", ledgerRef: "54B-ESCR-619261", milestoneId: "escrow_t_milestoneid_3", narration: "escrow_transactions_narration_3", fxRate: 21.4284, fxSourceCurrency: "EUR" },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_transactions");

  // escrow_milestones
  await db.insert(schema.escrowMilestones).values([
    { milestoneId: "escrow_m_milestoneid_1", escrowId: "escrow_m_escrowid_1", description: "54Bank escrow_milestones record 1", releaseAmount: 460407531.34, releasePercent: 6.6824, dueDate: new Date("2025-12-19 00:00:00"), status: "approved", verifiedBy: "escrow_milestones_verifiedby_1", verifiedAt: new Date("2026-03-12 00:00:00"), evidenceDocId: "escrow_m_evidencedocid_1" },
    { milestoneId: "escrow_m_milestoneid_2", escrowId: "escrow_m_escrowid_2", description: "54Bank escrow_milestones record 2", releaseAmount: 27435985.64, releasePercent: 22.1798, dueDate: new Date("2025-08-18 00:00:00"), status: "completed", verifiedBy: "escrow_milestones_verifiedby_2", verifiedAt: new Date("2025-05-20 00:00:00"), evidenceDocId: "escrow_m_evidencedocid_2" },
    { milestoneId: "escrow_m_milestoneid_3", escrowId: "escrow_m_escrowid_3", description: "54Bank escrow_milestones record 3", releaseAmount: 165168184.98, releasePercent: 9.6338, dueDate: new Date("2026-01-27 00:00:00"), status: "active", verifiedBy: "escrow_milestones_verifiedby_3", verifiedAt: new Date("2025-11-11 00:00:00"), evidenceDocId: "escrow_m_evidencedocid_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_milestones");

  // escrow_disputes
  await db.insert(schema.escrowDisputes).values([
    { disputeId: "escrow_d_disputeid_1", escrowId: "escrow_d_escrowid_1", raisedBy: "escrow_disputes_raisedby_1", raisedByPartyId: 87, reason: "54Bank escrow_disputes record 1", category: "basic", status: "pending", resolution: "escrow_disputes_resolution_1", arbitratorName: "escrow_disputes_arbitratorname_1", arbitratorDecision: "escrow_disputes_arbitratordecision_1", resolvedAt: new Date("2025-10-28 00:00:00") },
    { disputeId: "escrow_d_disputeid_2", escrowId: "escrow_d_escrowid_2", raisedBy: "escrow_disputes_raisedby_2", raisedByPartyId: 34, reason: "54Bank escrow_disputes record 2", category: "basic", status: "active", resolution: "escrow_disputes_resolution_2", arbitratorName: "escrow_disputes_arbitratorname_2", arbitratorDecision: "escrow_disputes_arbitratordecision_2", resolvedAt: new Date("2025-12-23 00:00:00") },
    { disputeId: "escrow_d_disputeid_3", escrowId: "escrow_d_escrowid_3", raisedBy: "escrow_disputes_raisedby_3", raisedByPartyId: 71, reason: "54Bank escrow_disputes record 3", category: "standard", status: "rejected", resolution: "escrow_disputes_resolution_3", arbitratorName: "escrow_disputes_arbitratorname_3", arbitratorDecision: "escrow_disputes_arbitratordecision_3", resolvedAt: new Date("2026-04-04 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_disputes");

  // escrow_documents
  await db.insert(schema.escrowDocuments).values([
    { documentId: "escrow_d_documentid_1", escrowId: "escrow_d_escrowid_1", documentType: "standard", fileName: "escrow_documents_filename_1", fileSize: 163, mimeType: "premium", storageUrl: "https://api.54bank.ng/v1/escrow_documents/1", uploadedBy: "escrow_documents_uploadedby_1", verifiedBy: "escrow_documents_verifiedby_1", verifiedAt: new Date("2025-09-09 00:00:00"), metadata: {"region": "west_africa", "currency": "NGN"} },
    { documentId: "escrow_d_documentid_2", escrowId: "escrow_d_escrowid_2", documentType: "basic", fileName: "escrow_documents_filename_2", fileSize: 286, mimeType: "standard", storageUrl: "https://api.54bank.ng/v1/escrow_documents/2", uploadedBy: "escrow_documents_uploadedby_2", verifiedBy: "escrow_documents_verifiedby_2", verifiedAt: new Date("2025-05-15 00:00:00"), metadata: {"region": "west_africa", "currency": "NGN"} },
    { documentId: "escrow_d_documentid_3", escrowId: "escrow_d_escrowid_3", documentType: "standard", fileName: "escrow_documents_filename_3", fileSize: 416, mimeType: "standard", storageUrl: "https://api.54bank.ng/v1/escrow_documents/3", uploadedBy: "escrow_documents_uploadedby_3", verifiedBy: "escrow_documents_verifiedby_3", verifiedAt: new Date("2025-09-30 00:00:00"), metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_documents");

  // escrow_fees
  await db.insert(schema.escrowFees).values([
    { feeId: "escrow_f_feeid_1", escrowId: "escrow_f_escrowid_1", feeType: "premium", amount: 363939707.95, currency: "GBP", ledgerRef: "54B-ESCR-599722", narration: "escrow_fees_narration_1" },
    { feeId: "escrow_f_feeid_2", escrowId: "escrow_f_escrowid_2", feeType: "basic", amount: 315616190.78, currency: "EUR", ledgerRef: "54B-ESCR-436003", narration: "escrow_fees_narration_2" },
    { feeId: "escrow_f_feeid_3", escrowId: "escrow_f_escrowid_3", feeType: "premium", amount: 295900494.72, currency: "GBP", ledgerRef: "54B-ESCR-764992", narration: "escrow_fees_narration_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_fees");

  // escrow_interest_accruals
  await db.insert(schema.escrowInterestAccruals).values([
    { accrualId: "escrow_i_accrualid_1", escrowId: "escrow_i_escrowid_1", principalAmount: 361697170.78, rate: 6.4914, accrualPeriodStart: new Date("2026-02-21 00:00:00"), accrualPeriodEnd: new Date("2026-03-06 00:00:00"), daysInPeriod: 28, interestAmount: 334982015.88, cumulativeInterest: 32.8934, ledgerRef: "54B-ESCR-111377" },
    { accrualId: "escrow_i_accrualid_2", escrowId: "escrow_i_escrowid_2", principalAmount: 76521882.54, rate: 8.8413, accrualPeriodStart: new Date("2025-05-27 00:00:00"), accrualPeriodEnd: new Date("2025-08-07 00:00:00"), daysInPeriod: 28, interestAmount: 307911017.41, cumulativeInterest: 85.866, ledgerRef: "54B-ESCR-576540" },
    { accrualId: "escrow_i_accrualid_3", escrowId: "escrow_i_escrowid_3", principalAmount: 362007713.41, rate: 21.9173, accrualPeriodStart: new Date("2025-07-06 00:00:00"), accrualPeriodEnd: new Date("2026-02-03 00:00:00"), daysInPeriod: 51, interestAmount: 340740077.88, cumulativeInterest: 42.4666, ledgerRef: "54B-ESCR-385363" },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_interest_accruals");

  // escrow_regulatory_reports
  await db.insert(schema.escrowRegulatoryReports).values([
    { reportId: "escrow_r_reportid_1", reportType: "basic", reportingPeriodStart: new Date("2025-08-31 00:00:00"), reportingPeriodEnd: new Date("2026-03-24 00:00:00"), totalEscrowAccounts: 187, totalHeldValue: 382158486.52, totalReleasedValue: 378099432.5, totalDisputedValue: 415956902.31, totalInterestAccrued: 32.9119, filedAt: new Date("2025-11-15 00:00:00"), filingReference: "54B-ESCR-157227", reportData: {"key": "value"} },
    { reportId: "escrow_r_reportid_2", reportType: "basic", reportingPeriodStart: new Date("2026-01-11 00:00:00"), reportingPeriodEnd: new Date("2026-01-29 00:00:00"), totalEscrowAccounts: 403, totalHeldValue: 489037036.9, totalReleasedValue: 252869064.45, totalDisputedValue: 70844390.13, totalInterestAccrued: 15.732, filedAt: new Date("2026-03-02 00:00:00"), filingReference: "54B-ESCR-328793", reportData: {"key": "value"} },
    { reportId: "escrow_r_reportid_3", reportType: "basic", reportingPeriodStart: new Date("2026-04-21 00:00:00"), reportingPeriodEnd: new Date("2025-12-28 00:00:00"), totalEscrowAccounts: 179, totalHeldValue: 446484256.96, totalReleasedValue: 191692662.67, totalDisputedValue: 22087751.89, totalInterestAccrued: 99.8968, filedAt: new Date("2025-10-28 00:00:00"), filingReference: "54B-ESCR-844354", reportData: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_regulatory_reports");

  // escrow_audit_log
  await db.insert(schema.escrowAuditLog).values([
    { auditId: "escrow_a_auditid_1", escrowId: "escrow_a_escrowid_1", action: "escrow_audit_log_action_1", actor: "escrow_audit_log_actor_1", details: "54Bank escrow_audit_log record 1", ipAddress: "154 Allen Street, Oyo", kafkaTopic: "escrow_audit_log_kafkatopic_1", kafkaOffset: "escrow_audit_log_kafkaoffset_1" },
    { auditId: "escrow_a_auditid_2", escrowId: "escrow_a_escrowid_2", action: "escrow_audit_log_action_2", actor: "escrow_audit_log_actor_2", details: "54Bank escrow_audit_log record 2", ipAddress: "42 Allen Street, Kaduna", kafkaTopic: "escrow_audit_log_kafkatopic_2", kafkaOffset: "escrow_audit_log_kafkaoffset_2" },
    { auditId: "escrow_a_auditid_3", escrowId: "escrow_a_escrowid_3", action: "escrow_audit_log_action_3", actor: "escrow_audit_log_actor_3", details: "54Bank escrow_audit_log record 3", ipAddress: "13 Marina Street, Lagos", kafkaTopic: "escrow_audit_log_kafkatopic_3", kafkaOffset: "escrow_audit_log_kafkaoffset_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: escrow_audit_log");

  // scratch_cards
  await db.insert(schema.scratchCards).values([
    { cardId: "scratch__card_id_1", batchId: "scratch__batch_id_1", serialNumber: "scratch__serial_number_1", cardType: "premium", pinHash: "scratch_cards_pin_hash_1", pinLength: 160, status: "approved", value: 177913182.55, currency: "USD", issuedTo: "scratch_cards_issued_to_1", customerId: "scratch__customer_id_1", branchCode: "PHC-001", expiresAt: new Date("2025-05-27 00:00:00"), activatedAt: new Date("2025-10-31 00:00:00"), usedAt: new Date("2025-12-13 00:00:00"), revokedAt: new Date("2025-06-05 00:00:00"), revokeReason: "54Bank scratch_cards record 1" },
    { cardId: "scratch__card_id_2", batchId: "scratch__batch_id_2", serialNumber: "scratch__serial_number_2", cardType: "standard", pinHash: "scratch_cards_pin_hash_2", pinLength: 250, status: "completed", value: 272366446.91, currency: "GBP", issuedTo: "scratch_cards_issued_to_2", customerId: "scratch__customer_id_2", branchCode: "KAN-001", expiresAt: new Date("2025-05-28 00:00:00"), activatedAt: new Date("2026-01-29 00:00:00"), usedAt: new Date("2025-11-09 00:00:00"), revokedAt: new Date("2026-05-05 00:00:00"), revokeReason: "54Bank scratch_cards record 2" },
    { cardId: "scratch__card_id_3", batchId: "scratch__batch_id_3", serialNumber: "scratch__serial_number_3", cardType: "premium", pinHash: "scratch_cards_pin_hash_3", pinLength: 325, status: "pending", value: 376577849.48, currency: "EUR", issuedTo: "scratch_cards_issued_to_3", customerId: "scratch__customer_id_3", branchCode: "ABJ-001", expiresAt: new Date("2025-09-30 00:00:00"), activatedAt: new Date("2026-02-23 00:00:00"), usedAt: new Date("2025-08-13 00:00:00"), revokedAt: new Date("2025-10-19 00:00:00"), revokeReason: "54Bank scratch_cards record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: scratch_cards");

  // card_batches
  await db.insert(schema.cardBatches).values([
    { batchId: "card_bat_batch_id_1", batchSize: 402, cardType: "standard", generatedBy: "card_batches_generated_by_1", status: "approved", branchCode: "PHC-001", expiresAt: new Date("2026-02-03 00:00:00") },
    { batchId: "card_bat_batch_id_2", batchSize: 206, cardType: "basic", generatedBy: "card_batches_generated_by_2", status: "rejected", branchCode: "LOS-001", expiresAt: new Date("2026-01-06 00:00:00") },
    { batchId: "card_bat_batch_id_3", batchSize: 128, cardType: "premium", generatedBy: "card_batches_generated_by_3", status: "active", branchCode: "LOS-001", expiresAt: new Date("2025-10-20 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: card_batches");

  // pin_verifications
  await db.insert(schema.pinVerifications).values([
    { verificationId: "pin_veri_verification_id_1", cardId: "pin_veri_card_id_1", serialNumber: "pin_veri_serial_number_1", customerId: "pin_veri_customer_id_1", transactionId: "pin_veri_transaction_id_1", channel: "pin_verifications_channel_1", result: "pin_verifications_result_1", ipAddress: "93 Allen Street, Enugu", deviceId: "pin_veri_device_id_1" },
    { verificationId: "pin_veri_verification_id_2", cardId: "pin_veri_card_id_2", serialNumber: "pin_veri_serial_number_2", customerId: "pin_veri_customer_id_2", transactionId: "pin_veri_transaction_id_2", channel: "pin_verifications_channel_2", result: "pin_verifications_result_2", ipAddress: "141 Marina Street, Lagos", deviceId: "pin_veri_device_id_2" },
    { verificationId: "pin_veri_verification_id_3", cardId: "pin_veri_card_id_3", serialNumber: "pin_veri_serial_number_3", customerId: "pin_veri_customer_id_3", transactionId: "pin_veri_transaction_id_3", channel: "pin_verifications_channel_3", result: "pin_verifications_result_3", ipAddress: "27 Marina Street, Ogun", deviceId: "pin_veri_device_id_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: pin_verifications");

  // grid_cards
  await db.insert(schema.gridCards).values([
    { gridCardId: "grid_car_grid_card_id_1", customerId: "grid_car_customer_id_1", cardSerial: "grid_car_card_serial_1", gridSize: "grid_car_grid_size_1", gridValuesEncrypted: "grid_car_grid_values_encrypted_1", status: "inactive", branchCode: "PHC-001", issuedAt: new Date("2026-03-06 00:00:00"), expiresAt: new Date("2025-09-15 00:00:00"), lastUsedAt: new Date("2026-01-19 00:00:00") },
    { gridCardId: "grid_car_grid_card_id_2", customerId: "grid_car_customer_id_2", cardSerial: "grid_car_card_serial_2", gridSize: "grid_car_grid_size_2", gridValuesEncrypted: "grid_car_grid_values_encrypted_2", status: "inactive", branchCode: "PHC-001", issuedAt: new Date("2025-05-21 00:00:00"), expiresAt: new Date("2025-07-08 00:00:00"), lastUsedAt: new Date("2025-12-08 00:00:00") },
    { gridCardId: "grid_car_grid_card_id_3", customerId: "grid_car_customer_id_3", cardSerial: "grid_car_card_serial_3", gridSize: "grid_car_grid_size_3", gridValuesEncrypted: "grid_car_grid_values_encrypted_3", status: "pending", branchCode: "ABJ-001", issuedAt: new Date("2026-01-09 00:00:00"), expiresAt: new Date("2026-01-06 00:00:00"), lastUsedAt: new Date("2025-12-22 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: grid_cards");

  // crypto_keys
  await db.insert(schema.cryptoKeys).values([
    { keyId: "crypto_k_key_id_1", name: "Ngozi Okafor", keyType: "basic", algorithm: "crypto_keys_algorithm_1", purpose: "54Bank crypto_keys record 1", status: "completed", keySizeBits: 135, rotationPeriodDays: 67, hsmSlot: "crypto_keys_hsm_slot_1", custodian1: "crypto_keys_custodian_1_1", custodian2: "crypto_keys_custodian_2_1", lastUsedAt: new Date("2026-04-26 00:00:00"), expiresAt: new Date("2025-06-23 00:00:00"), rotatedAt: new Date("2025-08-17 00:00:00") },
    { keyId: "crypto_k_key_id_2", name: "Emeka & Sons Trading", keyType: "premium", algorithm: "crypto_keys_algorithm_2", purpose: "54Bank crypto_keys record 2", status: "rejected", keySizeBits: 336, rotationPeriodDays: 66, hsmSlot: "crypto_keys_hsm_slot_2", custodian1: "crypto_keys_custodian_1_2", custodian2: "crypto_keys_custodian_2_2", lastUsedAt: new Date("2025-07-06 00:00:00"), expiresAt: new Date("2025-07-29 00:00:00"), rotatedAt: new Date("2025-12-03 00:00:00") },
    { keyId: "crypto_k_key_id_3", name: "Ibrahim Musa", keyType: "basic", algorithm: "crypto_keys_algorithm_3", purpose: "54Bank crypto_keys record 3", status: "rejected", keySizeBits: 394, rotationPeriodDays: 59, hsmSlot: "crypto_keys_hsm_slot_3", custodian1: "crypto_keys_custodian_1_3", custodian2: "crypto_keys_custodian_2_3", lastUsedAt: new Date("2025-07-31 00:00:00"), expiresAt: new Date("2025-08-08 00:00:00"), rotatedAt: new Date("2025-08-28 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: crypto_keys");

  // mfa_enrollments
  await db.insert(schema.mfaEnrollments).values([
    { enrollmentId: "mfa_enro_enrollment_id_1", customerId: "mfa_enro_customer_id_1", methods: "card", primaryMethod: "card", backupMethod: "ussd", status: "active", riskLevel: "mfa_enrollments_risk_level_1", channel: "mfa_enrollments_channel_1", lastVerified: new Date("2025-12-24 00:00:00") },
    { enrollmentId: "mfa_enro_enrollment_id_2", customerId: "mfa_enro_customer_id_2", methods: "bank_transfer", primaryMethod: "ussd", backupMethod: "mobile_money", status: "pending", riskLevel: "mfa_enrollments_risk_level_2", channel: "mfa_enrollments_channel_2", lastVerified: new Date("2026-02-10 00:00:00") },
    { enrollmentId: "mfa_enro_enrollment_id_3", customerId: "mfa_enro_customer_id_3", methods: "ussd", primaryMethod: "mobile_money", backupMethod: "ussd", status: "active", riskLevel: "mfa_enrollments_risk_level_3", channel: "mfa_enrollments_channel_3", lastVerified: new Date("2026-02-01 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: mfa_enrollments");

  // mfa_policies
  await db.insert(schema.mfaPolicies).values([
    { policyId: "mfa_poli_policy_id_1", name: "Rashida Bello", transactionType: "basic", allowedMethods: "bank_transfer", status: "active" },
    { policyId: "mfa_poli_policy_id_2", name: "Emeka & Sons Trading", transactionType: "standard", allowedMethods: "mobile_money", status: "completed" },
    { policyId: "mfa_poli_policy_id_3", name: "Aisha Mohammed", transactionType: "standard", allowedMethods: "mobile_money", status: "rejected" },
  ]).onConflictDoNothing();
  console.log("  seeded: mfa_policies");

  // otp_records
  await db.insert(schema.otpRecords).values([
    { otpId: "otp_reco_otp_id_1", policyId: "otp_reco_policy_id_1", customerId: "otp_reco_customer_id_1", channel: "otp_records_channel_1", purpose: "54Bank otp_records record 1", otpHash: "otp_records_otp_hash_1", status: "approved", deliveredVia: "otp_records_delivered_via_1", expiresAt: new Date("2025-09-11 00:00:00"), verifiedAt: new Date("2025-07-30 00:00:00") },
    { otpId: "otp_reco_otp_id_2", policyId: "otp_reco_policy_id_2", customerId: "otp_reco_customer_id_2", channel: "otp_records_channel_2", purpose: "54Bank otp_records record 2", otpHash: "otp_records_otp_hash_2", status: "inactive", deliveredVia: "otp_records_delivered_via_2", expiresAt: new Date("2025-12-30 00:00:00"), verifiedAt: new Date("2026-05-02 00:00:00") },
    { otpId: "otp_reco_otp_id_3", policyId: "otp_reco_policy_id_3", customerId: "otp_reco_customer_id_3", channel: "otp_records_channel_3", purpose: "54Bank otp_records record 3", otpHash: "otp_records_otp_hash_3", status: "rejected", deliveredVia: "otp_records_delivered_via_3", expiresAt: new Date("2025-07-30 00:00:00"), verifiedAt: new Date("2026-03-20 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: otp_records");

  // session_records
  await db.insert(schema.sessionRecords).values([
    { sessionId: "session__session_id_1", customerId: "session__customer_id_1", channel: "session_records_channel_1", deviceFingerprint: "session_records_device_fingerprint_1", ipAddress: "57 Allen Street, Imo", geoLocation: "Imo", status: "active", mfaLevel: "session_records_mfa_level_1", riskScore: 15.8266, lastActivity: new Date("2025-05-23 00:00:00"), expiresAt: new Date("2026-03-13 00:00:00"), terminatedReason: "54Bank session_records record 1" },
    { sessionId: "session__session_id_2", customerId: "session__customer_id_2", channel: "session_records_channel_2", deviceFingerprint: "session_records_device_fingerprint_2", ipAddress: "23 Marina Street, Kaduna", geoLocation: "Imo", status: "completed", mfaLevel: "session_records_mfa_level_2", riskScore: 2.3751, lastActivity: new Date("2026-04-15 00:00:00"), expiresAt: new Date("2025-10-21 00:00:00"), terminatedReason: "54Bank session_records record 2" },
    { sessionId: "session__session_id_3", customerId: "session__customer_id_3", channel: "session_records_channel_3", deviceFingerprint: "session_records_device_fingerprint_3", ipAddress: "57 Ahmadu Bello Street, Kano", geoLocation: "Imo", status: "inactive", mfaLevel: "session_records_mfa_level_3", riskScore: 17.5303, lastActivity: new Date("2025-09-07 00:00:00"), expiresAt: new Date("2025-07-06 00:00:00"), terminatedReason: "54Bank session_records record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: session_records");

  // api_keys
  await db.insert(schema.apiKeys).values([
    { apiKeyId: "api_keys_api_key_id_1", name: "Godwin Etim", keyPrefix: "54B-API_-784190", tenantId: "tenant-ph-south", scopes: "api_keys_scopes_1", rateLimit: 270490417, status: "active", ipWhitelist: "api_keys_ip_whitelist_1", lastUsedAt: new Date("2025-07-21 00:00:00"), expiresAt: new Date("2026-03-13 00:00:00"), createdBy: "api_keys_created_by_1" },
    { apiKeyId: "api_keys_api_key_id_2", name: "Dangote Industries Ltd", keyPrefix: "54B-API_-183912", tenantId: "tenant-abuja-hq", scopes: "api_keys_scopes_2", rateLimit: 291381329, status: "approved", ipWhitelist: "api_keys_ip_whitelist_2", lastUsedAt: new Date("2026-05-08 00:00:00"), expiresAt: new Date("2026-02-26 00:00:00"), createdBy: "api_keys_created_by_2" },
    { apiKeyId: "api_keys_api_key_id_3", name: "Chidi Obi", keyPrefix: "54B-API_-695547", tenantId: "tenant-lagos-main", scopes: "api_keys_scopes_3", rateLimit: 496601017, status: "completed", ipWhitelist: "api_keys_ip_whitelist_3", lastUsedAt: new Date("2025-12-10 00:00:00"), expiresAt: new Date("2026-04-03 00:00:00"), createdBy: "api_keys_created_by_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: api_keys");

  // security_events
  await db.insert(schema.securityEvents).values([
    { eventId: "security_event_id_1", eventType: "basic", subType: "basic", actor: "security_events_actor_1", channel: "security_events_channel_1", ipAddress: "45 Marina Street, Ogun", geoLocation: "Ogun", details: "54Bank security_events record 1", riskScore: 4.2942, severity: "security_events_severity_1", hashChain: "security_events_hash_chain_1" },
    { eventId: "security_event_id_2", eventType: "standard", subType: "basic", actor: "security_events_actor_2", channel: "security_events_channel_2", ipAddress: "153 Marina Street, Lagos", geoLocation: "Enugu", details: "54Bank security_events record 2", riskScore: 18.3344, severity: "security_events_severity_2", hashChain: "security_events_hash_chain_2" },
    { eventId: "security_event_id_3", eventType: "premium", subType: "basic", actor: "security_events_actor_3", channel: "security_events_channel_3", ipAddress: "36 Ahmadu Bello Street, Lagos", geoLocation: "Rivers", details: "54Bank security_events record 3", riskScore: 8.6625, severity: "security_events_severity_3", hashChain: "security_events_hash_chain_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: security_events");

  // certificates
  await db.insert(schema.certificates).values([
    { certId: "certific_cert_id_1", commonName: "certificates_common_name_1", certType: "premium", algorithm: "certificates_algorithm_1", issuer: "certificates_issuer_1", serialNumber: "certific_serial_number_1", status: "approved", validFrom: new Date("2025-08-18 00:00:00"), validTo: new Date("2025-08-17 00:00:00"), renewalDays: 27, lastRenewed: new Date("2025-12-31 00:00:00"), revokedAt: new Date("2026-02-18 00:00:00"), revocationReason: "54Bank certificates record 1" },
    { certId: "certific_cert_id_2", commonName: "certificates_common_name_2", certType: "basic", algorithm: "certificates_algorithm_2", issuer: "certificates_issuer_2", serialNumber: "certific_serial_number_2", status: "inactive", validFrom: new Date("2025-07-18 00:00:00"), validTo: new Date("2025-10-15 00:00:00"), renewalDays: 78, lastRenewed: new Date("2025-09-07 00:00:00"), revokedAt: new Date("2025-06-06 00:00:00"), revocationReason: "54Bank certificates record 2" },
    { certId: "certific_cert_id_3", commonName: "certificates_common_name_3", certType: "premium", algorithm: "certificates_algorithm_3", issuer: "certificates_issuer_3", serialNumber: "certific_serial_number_3", status: "approved", validFrom: new Date("2025-05-27 00:00:00"), validTo: new Date("2026-03-08 00:00:00"), renewalDays: 66, lastRenewed: new Date("2025-07-07 00:00:00"), revokedAt: new Date("2026-02-23 00:00:00"), revocationReason: "54Bank certificates record 3" },
  ]).onConflictDoNothing();
  console.log("  seeded: certificates");

  // jwt_validations
  await db.insert(schema.jwtValidations).values([
    { tokenType: "basic", issuer: "jwt_validations_issuer_1", audience: "jwt_validations_audience_1", algorithm: "jwt_validations_algorithm_1", avgLatencyMs: 12.3619, cacheHitRate: 22.4376 },
    { tokenType: "standard", issuer: "jwt_validations_issuer_2", audience: "jwt_validations_audience_2", algorithm: "jwt_validations_algorithm_2", avgLatencyMs: 43.5375, cacheHitRate: 15.7055 },
    { tokenType: "basic", issuer: "jwt_validations_issuer_3", audience: "jwt_validations_audience_3", algorithm: "jwt_validations_algorithm_3", avgLatencyMs: 20.8103, cacheHitRate: 3.8997 },
  ]).onConflictDoNothing();
  console.log("  seeded: jwt_validations");

  // route_schemas
  await db.insert(schema.routeSchemas).values([
    { path: "route_schemas_path_1", method: "mobile_money", schemaName: "route_schemas_schema_name_1", passRate: 19.0619 },
    { path: "route_schemas_path_2", method: "mobile_money", schemaName: "route_schemas_schema_name_2", passRate: 23.9922 },
    { path: "route_schemas_path_3", method: "bank_transfer", schemaName: "route_schemas_schema_name_3", passRate: 18.7209 },
  ]).onConflictDoNothing();
  console.log("  seeded: route_schemas");

  // sql_queries
  await db.insert(schema.sqlQueries).values([
    { originalQuery: "sql_queries_original_query_1", avgLatencyMs: 23.5987 },
    { originalQuery: "sql_queries_original_query_2", avgLatencyMs: 62.2791 },
    { originalQuery: "sql_queries_original_query_3", avgLatencyMs: 74.2685 },
  ]).onConflictDoNothing();
  console.log("  seeded: sql_queries");

  // vault_secrets
  await db.insert(schema.vaultSecrets).values([
    { path: "vault_secrets_path_1", engine: "vault_secrets_engine_1", rotationDays: 94, lastRotated: new Date("2026-05-09 00:00:00"), nextRotation: new Date("2026-01-21 00:00:00") },
    { path: "vault_secrets_path_2", engine: "vault_secrets_engine_2", rotationDays: 97, lastRotated: new Date("2026-04-06 00:00:00"), nextRotation: new Date("2026-02-03 00:00:00") },
    { path: "vault_secrets_path_3", engine: "vault_secrets_engine_3", rotationDays: 11, lastRotated: new Date("2025-12-15 00:00:00"), nextRotation: new Date("2025-08-03 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: vault_secrets");

  // pin_hashes
  await db.insert(schema.pinHashes).values([
    { algorithm: "pin_hashes_algorithm_1", memoryCost: 25, timeCost: 98, parallelism: 84, saltLength: 133, hashLength: 388 },
    { algorithm: "pin_hashes_algorithm_2", memoryCost: 77, timeCost: 80, parallelism: 73, saltLength: 403, hashLength: 226 },
    { algorithm: "pin_hashes_algorithm_3", memoryCost: 1, timeCost: 29, parallelism: 36, saltLength: 404, hashLength: 44 },
  ]).onConflictDoNothing();
  console.log("  seeded: pin_hashes");

  // docker_hardening_checks
  await db.insert(schema.dockerHardeningChecks).values([
    { checkName: "docker_hardening_checks_check_name_1", category: "basic", cisBenchmark: "docker_hardening_checks_cis_benchmark_1", severity: "docker_hardening_checks_severity_1" },
    { checkName: "docker_hardening_checks_check_name_2", category: "basic", cisBenchmark: "docker_hardening_checks_cis_benchmark_2", severity: "docker_hardening_checks_severity_2" },
    { checkName: "docker_hardening_checks_check_name_3", category: "standard", cisBenchmark: "docker_hardening_checks_cis_benchmark_3", severity: "docker_hardening_checks_severity_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: docker_hardening_checks");

  // pkce_flows
  await db.insert(schema.pkceFlows).values([
    { clientId: "pkce_flo_client_id_1", grantType: "premium", codeChallengeMethod: "card", redirectUri: "pkce_flows_redirect_uri_1", scopes: {"key": "value"}, tokenLifetime: 74, refreshLifetime: 69 },
    { clientId: "pkce_flo_client_id_2", grantType: "basic", codeChallengeMethod: "ussd", redirectUri: "pkce_flows_redirect_uri_2", scopes: {"key": "value"}, tokenLifetime: 20, refreshLifetime: 20 },
    { clientId: "pkce_flo_client_id_3", grantType: "basic", codeChallengeMethod: "card", redirectUri: "pkce_flows_redirect_uri_3", scopes: {"key": "value"}, tokenLifetime: 72, refreshLifetime: 99 },
  ]).onConflictDoNothing();
  console.log("  seeded: pkce_flows");

  // token_families
  await db.insert(schema.tokenFamilies).values([
    { familyId: "token_fa_family_id_1", userId: "token_fa_user_id_1", clientId: "token_fa_client_id_1" },
    { familyId: "token_fa_family_id_2", userId: "token_fa_user_id_2", clientId: "token_fa_client_id_2" },
    { familyId: "token_fa_family_id_3", userId: "token_fa_user_id_3", clientId: "token_fa_client_id_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: token_families");

  // mtls_nodes
  await db.insert(schema.mtlsNodes).values([
    { serviceName: "mtls_nodes_service_name_1", spiffeId: "mtls_nod_spiffe_id_1", certSerial: "mtls_nod_cert_serial_1", certExpiry: new Date("2025-11-09 00:00:00"), issuer: "mtls_nodes_issuer_1" },
    { serviceName: "mtls_nodes_service_name_2", spiffeId: "mtls_nod_spiffe_id_2", certSerial: "mtls_nod_cert_serial_2", certExpiry: new Date("2026-02-17 00:00:00"), issuer: "mtls_nodes_issuer_2" },
    { serviceName: "mtls_nodes_service_name_3", spiffeId: "mtls_nod_spiffe_id_3", certSerial: "mtls_nod_cert_serial_3", certExpiry: new Date("2025-09-29 00:00:00"), issuer: "mtls_nodes_issuer_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: mtls_nodes");

  // body_limit_rules
  await db.insert(schema.bodyLimitRules).values([
    { path: "body_limit_rules_path_1", method: "mobile_money", maxBodyBytes: 41445001664, contentTypes: {"key": "value"} },
    { path: "body_limit_rules_path_2", method: "ussd", maxBodyBytes: 13080001931, contentTypes: {"key": "value"} },
    { path: "body_limit_rules_path_3", method: "card", maxBodyBytes: 3618679592, contentTypes: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: body_limit_rules");

  // kms_keys
  await db.insert(schema.kmsKeys).values([
    { provider: "kms_keys_provider_1", keyId: "kms_keys_key_id_1", algorithm: "kms_keys_algorithm_1", usage: "kms_keys_usage_1", state: "Rivers" },
    { provider: "kms_keys_provider_2", keyId: "kms_keys_key_id_2", algorithm: "kms_keys_algorithm_2", usage: "kms_keys_usage_2", state: "Enugu" },
    { provider: "kms_keys_provider_3", keyId: "kms_keys_key_id_3", algorithm: "kms_keys_algorithm_3", usage: "kms_keys_usage_3", state: "Kano" },
  ]).onConflictDoNothing();
  console.log("  seeded: kms_keys");

  // tls_configs
  await db.insert(schema.tlsConfigs).values([
    { domain: "tls_configs_domain_1", protocol: "tls_configs_protocol_1", cipherSuites: {"key": "value"}, certExpiry: new Date("2026-01-06 00:00:00") },
    { domain: "tls_configs_domain_2", protocol: "tls_configs_protocol_2", cipherSuites: {"key": "value"}, certExpiry: new Date("2025-07-06 00:00:00") },
    { domain: "tls_configs_domain_3", protocol: "tls_configs_protocol_3", cipherSuites: {"key": "value"}, certExpiry: new Date("2025-09-09 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: tls_configs");

  // correlation_rules
  await db.insert(schema.correlationRules).values([
    { name: "Kemi Adeyemi", mitreIds: {"key": "value"}, killChainPhase: "correlation_rules_kill_chain_phase_1", triggerEvents: {"key": "value"}, correlationWindow: "correlation_rules_correlation_window_1" },
    { name: "Kano Textiles Ltd", mitreIds: {"key": "value"}, killChainPhase: "correlation_rules_kill_chain_phase_2", triggerEvents: {"key": "value"}, correlationWindow: "correlation_rules_correlation_window_2" },
    { name: "Kemi Adeyemi", mitreIds: {"key": "value"}, killChainPhase: "correlation_rules_kill_chain_phase_3", triggerEvents: {"key": "value"}, correlationWindow: "correlation_rules_correlation_window_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: correlation_rules");

  // pci_scans
  await db.insert(schema.pciScans).values([
    { requirement: "pci_scans_requirement_1", findings: {"key": "value"}, lastScan: new Date("2025-12-24 00:00:00"), scanDuration: "pci_scans_scan_duration_1" },
    { requirement: "pci_scans_requirement_2", findings: {"key": "value"}, lastScan: new Date("2025-06-15 00:00:00"), scanDuration: "pci_scans_scan_duration_2" },
    { requirement: "pci_scans_requirement_3", findings: {"key": "value"}, lastScan: new Date("2025-10-21 00:00:00"), scanDuration: "pci_scans_scan_duration_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: pci_scans");

  // api_key_policies
  await db.insert(schema.apiKeyPolicies).values([
    { name: "Yetunde Olowe", prefix: "54B-API_-293898", requiredScopes: {"key": "value"}, ipWhitelist: {"key": "value"}, rateLimit: 341943333, rotationWarningDays: 66 },
    { name: "Lagos Agro-Allied Co", prefix: "54B-API_-872836", requiredScopes: {"key": "value"}, ipWhitelist: {"key": "value"}, rateLimit: 90792257, rotationWarningDays: 24 },
    { name: "Godwin Etim", prefix: "54B-API_-641052", requiredScopes: {"key": "value"}, ipWhitelist: {"key": "value"}, rateLimit: 39981535, rotationWarningDays: 30 },
  ]).onConflictDoNothing();
  console.log("  seeded: api_key_policies");

  // path_validation_rules
  await db.insert(schema.pathValidationRules).values([
    { pattern: "path_validation_rules_pattern_1", regex: "path_validation_rules_regex_1", commonViolations: {"key": "value"} },
    { pattern: "path_validation_rules_pattern_2", regex: "path_validation_rules_regex_2", commonViolations: {"key": "value"} },
    { pattern: "path_validation_rules_pattern_3", regex: "path_validation_rules_regex_3", commonViolations: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: path_validation_rules");

  // key_rotation_schedules
  await db.insert(schema.keyRotationSchedules).values([
    { keyId: "key_rota_key_id_1", algorithm: "key_rotation_schedules_algorithm_1", rotationInterval: "key_rotation_schedules_rotation_interval_1", gracePeriod: "key_rotation_schedules_grace_period_1", previousVersion: 90, nextRotation: new Date("2026-02-13 00:00:00") },
    { keyId: "key_rota_key_id_2", algorithm: "key_rotation_schedules_algorithm_2", rotationInterval: "key_rotation_schedules_rotation_interval_2", gracePeriod: "key_rotation_schedules_grace_period_2", previousVersion: 16, nextRotation: new Date("2026-05-11 00:00:00") },
    { keyId: "key_rota_key_id_3", algorithm: "key_rotation_schedules_algorithm_3", rotationInterval: "key_rotation_schedules_rotation_interval_3", gracePeriod: "key_rotation_schedules_grace_period_3", previousVersion: 77, nextRotation: new Date("2025-08-01 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: key_rotation_schedules");

  // network_policies
  await db.insert(schema.networkPolicies).values([
    { name: "Danladi Garba", namespace: "network_policies_namespace_1", podSelector: "network_policies_pod_selector_1", ingressRules: {"key": "value"}, egressRules: {"key": "value"} },
    { name: "Abuja Properties Ltd", namespace: "network_policies_namespace_2", podSelector: "network_policies_pod_selector_2", ingressRules: {"key": "value"}, egressRules: {"key": "value"} },
    { name: "Obinna Chukwu", namespace: "network_policies_namespace_3", podSelector: "network_policies_pod_selector_3", ingressRules: {"key": "value"}, egressRules: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: network_policies");

  // vault_engines
  await db.insert(schema.vaultEngines).values([
    { path: "vault_engines_path_1", engineType: "premium", description: "54Bank vault_engines record 1", maxTTL: "vault_engines_max_ttl_1", defaultTTL: "vault_engines_default_ttl_1" },
    { path: "vault_engines_path_2", engineType: "premium", description: "54Bank vault_engines record 2", maxTTL: "vault_engines_max_ttl_2", defaultTTL: "vault_engines_default_ttl_2" },
    { path: "vault_engines_path_3", engineType: "premium", description: "54Bank vault_engines record 3", maxTTL: "vault_engines_max_ttl_3", defaultTTL: "vault_engines_default_ttl_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: vault_engines");

  // anomaly_models
  await db.insert(schema.anomalyModels).values([
    { name: "Ngozi Okafor", modelType: "standard", features: ["core_banking", "payments", "kyc", "aml"], accuracy: 30.6022, precision: 92.8313, recall: 8.4282, f1Score: 3.4331, trainingSize: 29075900185 },
    { name: "Abuja Properties Ltd", modelType: "premium", features: ["core_banking", "payments", "kyc", "aml"], accuracy: 17.5291, precision: 67.775, recall: 40.961, f1Score: 12.6111, trainingSize: 19391614531 },
    { name: "Aisha Mohammed", modelType: "basic", features: ["core_banking", "payments", "kyc", "aml"], accuracy: 82.9884, precision: 57.1839, recall: 42.1509, f1Score: 6.4088, trainingSize: 39561250509 },
  ]).onConflictDoNothing();
  console.log("  seeded: anomaly_models");

  // ndpr_records
  await db.insert(schema.ndprRecords).values([
    { recordType: "standard", subject: "ndpr_records_subject_1", requestType: "standard", responseTimeDays: 47, slaDeadlineDays: 80, dataCategories: {"key": "value"}, dpo: "ndpr_records_dpo_1" },
    { recordType: "basic", subject: "ndpr_records_subject_2", requestType: "basic", responseTimeDays: 4, slaDeadlineDays: 80, dataCategories: {"key": "value"}, dpo: "ndpr_records_dpo_2" },
    { recordType: "basic", subject: "ndpr_records_subject_3", requestType: "standard", responseTimeDays: 75, slaDeadlineDays: 97, dataCategories: {"key": "value"}, dpo: "ndpr_records_dpo_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: ndpr_records");

  // output_encoding_rules
  await db.insert(schema.outputEncodingRules).values([
    { context: "output_encoding_rules_context_1", encoder: "output_e_encoder_1", charsEncoded: {"key": "value"} },
    { context: "output_encoding_rules_context_2", encoder: "output_e_encoder_2", charsEncoded: {"key": "value"} },
    { context: "output_encoding_rules_context_3", encoder: "output_e_encoder_3", charsEncoded: {"key": "value"} },
  ]).onConflictDoNothing();
  console.log("  seeded: output_encoding_rules");

  // image_scans
  await db.insert(schema.imageScans).values([
    { imageName: "image_scans_image_name_1", registry: "image_scans_registry_1", baseImage: "image_scans_base_image_1", lastScanned: new Date("2025-11-20 00:00:00") },
    { imageName: "image_scans_image_name_2", registry: "image_scans_registry_2", baseImage: "image_scans_base_image_2", lastScanned: new Date("2026-03-10 00:00:00") },
    { imageName: "image_scans_image_name_3", registry: "image_scans_registry_3", baseImage: "image_scans_base_image_3", lastScanned: new Date("2025-12-01 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: image_scans");

  // waf_rules
  await db.insert(schema.wafRules).values([
    { ruleId: "waf_rule_rule_id_1", name: "Adewale Ogundimu", category: "premium", severity: "waf_rules_severity_1" },
    { ruleId: "waf_rule_rule_id_2", name: "Emeka & Sons Trading", category: "premium", severity: "waf_rules_severity_2" },
    { ruleId: "waf_rule_rule_id_3", name: "Ibrahim Musa", category: "premium", severity: "waf_rules_severity_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: waf_rules");

  // ddos_rules
  await db.insert(schema.ddosRules).values([
    { name: "Samuel Eze", layer: "ddos_rules_layer_1", threshold: "ddos_rules_threshold_1", action: "ddos_rules_action_1" },
    { name: "Emeka & Sons Trading", layer: "ddos_rules_layer_2", threshold: "ddos_rules_threshold_2", action: "ddos_rules_action_2" },
    { name: "Kemi Adeyemi", layer: "ddos_rules_layer_3", threshold: "ddos_rules_threshold_3", action: "ddos_rules_action_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: ddos_rules");

  // ip_rules
  await db.insert(schema.ipRules).values([
    { name: "Kemi Adeyemi", cidr: "ip_rules_cidr_1", ruleType: "premium", appliesTo: "ip_rules_applies_to_1", geoCountry: "Nigeria" },
    { name: "Lagos Agro-Allied Co", cidr: "ip_rules_cidr_2", ruleType: "basic", appliesTo: "ip_rules_applies_to_2", geoCountry: "Nigeria" },
    { name: "Danladi Garba", cidr: "ip_rules_cidr_3", ruleType: "basic", appliesTo: "ip_rules_applies_to_3", geoCountry: "Nigeria" },
  ]).onConflictDoNothing();
  console.log("  seeded: ip_rules");

  // siem_pipelines
  await db.insert(schema.siemPipelines).values([
    { name: "Yetunde Olowe", format: "siem_pipelines_format_1", destination: "siem_pipelines_destination_1", avgLatencyMs: 24.6777, errorRate: 3.2313, batchSize: 377 },
    { name: "Oando Energy", format: "siem_pipelines_format_2", destination: "siem_pipelines_destination_2", avgLatencyMs: 93.2944, errorRate: 11.2332, batchSize: 92 },
    { name: "Danladi Garba", format: "siem_pipelines_format_3", destination: "siem_pipelines_destination_3", avgLatencyMs: 78.768, errorRate: 18.5327, batchSize: 371 },
  ]).onConflictDoNothing();
  console.log("  seeded: siem_pipelines");

  // cbn_compliance_checks
  await db.insert(schema.cbnComplianceChecks).values([
    { circular: "cbn_compliance_checks_circular_1", title: "cbn_compliance_checks_title_1", category: "standard", complianceScore: 24.3952, lastAssessed: new Date("2025-10-16 00:00:00"), nextAssessment: new Date("2026-01-22 00:00:00") },
    { circular: "cbn_compliance_checks_circular_2", title: "cbn_compliance_checks_title_2", category: "standard", complianceScore: 5.4897, lastAssessed: new Date("2026-04-15 00:00:00"), nextAssessment: new Date("2026-04-19 00:00:00") },
    { circular: "cbn_compliance_checks_circular_3", title: "cbn_compliance_checks_title_3", category: "basic", complianceScore: 16.5127, lastAssessed: new Date("2025-07-15 00:00:00"), nextAssessment: new Date("2025-05-14 00:00:00") },
  ]).onConflictDoNothing();
  console.log("  seeded: cbn_compliance_checks");

  // egress_policies
  await db.insert(schema.egressPolicies).values([
    { name: "Amina Yusuf", domains: {"key": "value"}, ports: {"key": "value"}, protocol: "egress_policies_protocol_1" },
    { name: "Emeka & Sons Trading", domains: {"key": "value"}, ports: {"key": "value"}, protocol: "egress_policies_protocol_2" },
    { name: "Godwin Etim", domains: {"key": "value"}, ports: {"key": "value"}, protocol: "egress_policies_protocol_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: egress_policies");

  // incidents
  await db.insert(schema.incidents).values([
    { title: "incidents_title_1", severity: "incidents_severity_1", category: "basic", affectedSystems: {"key": "value"}, containmentActions: {"key": "value"}, assignee: "incidents_assignee_1", detectedAt: new Date("2026-05-05 00:00:00"), containedAt: new Date("2025-10-15 00:00:00"), ttdMinutes: 85, ttcMinutes: 69 },
    { title: "incidents_title_2", severity: "incidents_severity_2", category: "premium", affectedSystems: {"key": "value"}, containmentActions: {"key": "value"}, assignee: "incidents_assignee_2", detectedAt: new Date("2025-09-04 00:00:00"), containedAt: new Date("2026-03-16 00:00:00"), ttdMinutes: 4, ttcMinutes: 98 },
    { title: "incidents_title_3", severity: "incidents_severity_3", category: "basic", affectedSystems: {"key": "value"}, containmentActions: {"key": "value"}, assignee: "incidents_assignee_3", detectedAt: new Date("2025-11-20 00:00:00"), containedAt: new Date("2026-04-05 00:00:00"), ttdMinutes: 42, ttcMinutes: 66 },
  ]).onConflictDoNothing();
  console.log("  seeded: incidents");

  // immutable_audit_blocks
  await db.insert(schema.immutableAuditBlocks).values([
    { blockNumber: 35070682698, previousHash: "immutable_audit_blocks_previous_hash_1", merkleRoot: "immutable_audit_blocks_merkle_root_1", validator: "immutabl_validator_1", anchoredToChain: "immutable_audit_blocks_anchored_to_chain_1", anchorTxHash: "immutable_audit_blocks_anchor_tx_hash_1" },
    { blockNumber: 25531809691, previousHash: "immutable_audit_blocks_previous_hash_2", merkleRoot: "immutable_audit_blocks_merkle_root_2", validator: "immutabl_validator_2", anchoredToChain: "immutable_audit_blocks_anchored_to_chain_2", anchorTxHash: "immutable_audit_blocks_anchor_tx_hash_2" },
    { blockNumber: 28362485180, previousHash: "immutable_audit_blocks_previous_hash_3", merkleRoot: "immutable_audit_blocks_merkle_root_3", validator: "immutabl_validator_3", anchoredToChain: "immutable_audit_blocks_anchored_to_chain_3", anchorTxHash: "immutable_audit_blocks_anchor_tx_hash_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: immutable_audit_blocks");

  // soc2_evidence
  await db.insert(schema.soc2Evidence).values([
    { controlId: "soc2_evi_control_id_1", category: "basic", title: "soc2_evidence_title_1", evidenceType: "premium", result: "soc2_evidence_result_1", period: "soc2_evidence_period_1", artifacts: {"key": "value"}, auditor: "soc2_evidence_auditor_1" },
    { controlId: "soc2_evi_control_id_2", category: "basic", title: "soc2_evidence_title_2", evidenceType: "premium", result: "soc2_evidence_result_2", period: "soc2_evidence_period_2", artifacts: {"key": "value"}, auditor: "soc2_evidence_auditor_2" },
    { controlId: "soc2_evi_control_id_3", category: "standard", title: "soc2_evidence_title_3", evidenceType: "basic", result: "soc2_evidence_result_3", period: "soc2_evidence_period_3", artifacts: {"key": "value"}, auditor: "soc2_evidence_auditor_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: soc2_evidence");

  // pentest_scans
  await db.insert(schema.pentestScans).values([
    { name: "Oluwaseun Ajayi", scope: "pentest_scans_scope_1", scanType: "standard", target: "pentest_scans_target_1", vendor: "pentest_scans_vendor_1" },
    { name: "Oando Energy", scope: "pentest_scans_scope_2", scanType: "standard", target: "pentest_scans_target_2", vendor: "pentest_scans_vendor_2" },
    { name: "Rashida Bello", scope: "pentest_scans_scope_3", scanType: "standard", target: "pentest_scans_target_3", vendor: "pentest_scans_vendor_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: pentest_scans");

  // sri_hashes
  await db.insert(schema.sriHashes).values([
    { resource: "sri_hashes_resource_1", algorithm: "sri_hashes_algorithm_1", hash: "sri_hashes_hash_1", lastVerified: new Date("2025-05-22 00:00:00"), cdnProvider: "sri_hash_cdn_provider_1" },
    { resource: "sri_hashes_resource_2", algorithm: "sri_hashes_algorithm_2", hash: "sri_hashes_hash_2", lastVerified: new Date("2025-07-01 00:00:00"), cdnProvider: "sri_hash_cdn_provider_2" },
    { resource: "sri_hashes_resource_3", algorithm: "sri_hashes_algorithm_3", hash: "sri_hashes_hash_3", lastVerified: new Date("2025-12-30 00:00:00"), cdnProvider: "sri_hash_cdn_provider_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: sri_hashes");

  // csp_policies
  await db.insert(schema.cspPolicies).values([
    { domain: "csp_policies_domain_1", directives: {"key": "value"}, reportUri: "csp_policies_report_uri_1" },
    { domain: "csp_policies_domain_2", directives: {"key": "value"}, reportUri: "csp_policies_report_uri_2" },
    { domain: "csp_policies_domain_3", directives: {"key": "value"}, reportUri: "csp_policies_report_uri_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: csp_policies");

  // frame_policies
  await db.insert(schema.framePolicies).values([
    { domain: "frame_policies_domain_1", frameAncestors: "frame_policies_frame_ancestors_1", xFrameOptions: "frame_policies_x_frame_options_1", frameDetection: "frame_policies_frame_detection_1" },
    { domain: "frame_policies_domain_2", frameAncestors: "frame_policies_frame_ancestors_2", xFrameOptions: "frame_policies_x_frame_options_2", frameDetection: "frame_policies_frame_detection_2" },
    { domain: "frame_policies_domain_3", frameAncestors: "frame_policies_frame_ancestors_3", xFrameOptions: "frame_policies_x_frame_options_3", frameDetection: "frame_policies_frame_detection_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: frame_policies");

  // device_profiles
  await db.insert(schema.deviceProfiles).values([
    { fingerprintHash: "device_profiles_fingerprint_hash_1", userId: "device_p_user_id_1", deviceType: "standard", browser: "device_profiles_browser_1", os: "device_profiles_os_1", screenRes: "device_profiles_screen_res_1", timezone: "device_profiles_timezone_1" },
    { fingerprintHash: "device_profiles_fingerprint_hash_2", userId: "device_p_user_id_2", deviceType: "premium", browser: "device_profiles_browser_2", os: "device_profiles_os_2", screenRes: "device_profiles_screen_res_2", timezone: "device_profiles_timezone_2" },
    { fingerprintHash: "device_profiles_fingerprint_hash_3", userId: "device_p_user_id_3", deviceType: "standard", browser: "device_profiles_browser_3", os: "device_profiles_os_3", screenRes: "device_profiles_screen_res_3", timezone: "device_profiles_timezone_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: device_profiles");

  // redis_cache_entries
  await db.insert(schema.redisCacheEntries).values([
    { route: "redis_cache_entries_route_1", hitRate: "redis_cache_entries_hitrate_1" },
    { route: "redis_cache_entries_route_2", hitRate: "redis_cache_entries_hitrate_2" },
    { route: "redis_cache_entries_route_3", hitRate: "redis_cache_entries_hitrate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: redis_cache_entries");

  // redis_sessions
  await db.insert(schema.redisSessions).values([
    { sessionId: "redis_se_sessionid_1", userId: "redis_se_userid_1", deviceType: "standard", ipAddress: "65 Marina Street, Ogun", expiresIn: "redis_sessions_expiresin_1" },
    { sessionId: "redis_se_sessionid_2", userId: "redis_se_userid_2", deviceType: "premium", ipAddress: "19 Ahmadu Bello Street, Anambra", expiresIn: "redis_sessions_expiresin_2" },
    { sessionId: "redis_se_sessionid_3", userId: "redis_se_userid_3", deviceType: "basic", ipAddress: "100 Broad Street, Kaduna", expiresIn: "redis_sessions_expiresin_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: redis_sessions");

  // cache_invalidations
  await db.insert(schema.cacheInvalidations).values([
    { channel: "cache_invalidations_channel_1", pattern: "cache_invalidations_pattern_1" },
    { channel: "cache_invalidations_channel_2", pattern: "cache_invalidations_pattern_2" },
    { channel: "cache_invalidations_channel_3", pattern: "cache_invalidations_pattern_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: cache_invalidations");

  // bloom_filters
  await db.insert(schema.bloomFilters).values([
    { name: "Emeka Nwosu", falsePositiveRate: "bloom_filters_falsepositiverate_1" },
    { name: "Oando Energy", falsePositiveRate: "bloom_filters_falsepositiverate_2" },
    { name: "Folake Adeniyi", falsePositiveRate: "bloom_filters_falsepositiverate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: bloom_filters");

  // sorted_set_rankings
  await db.insert(schema.sortedSetRankings).values([
    { name: "Aisha Mohammed", updateFrequency: "sorted_set_rankings_updatefrequency_1" },
    { name: "Oando Energy", updateFrequency: "sorted_set_rankings_updatefrequency_2" },
    { name: "Folake Adeniyi", updateFrequency: "sorted_set_rankings_updatefrequency_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: sorted_set_rankings");

  // pgbouncer_pools
  await db.insert(schema.pgbouncerPools).values([
    { database: "pgbouncer_pools_database_1", poolMode: "pgbouncer_pools_poolmode_1" },
    { database: "pgbouncer_pools_database_2", poolMode: "pgbouncer_pools_poolmode_2" },
    { database: "pgbouncer_pools_database_3", poolMode: "pgbouncer_pools_poolmode_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: pgbouncer_pools");

  // query_cache_entries
  await db.insert(schema.queryCacheEntries).values([
    { queryHash: "query_cache_entries_queryhash_1", tableName: "query_cache_entries_tablename_1", hitRate: "query_cache_entries_hitrate_1" },
    { queryHash: "query_cache_entries_queryhash_2", tableName: "query_cache_entries_tablename_2", hitRate: "query_cache_entries_hitrate_2" },
    { queryHash: "query_cache_entries_queryhash_3", tableName: "query_cache_entries_tablename_3", hitRate: "query_cache_entries_hitrate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: query_cache_entries");

  // prepared_statements
  await db.insert(schema.preparedStatements).values([
    { queryPattern: "prepared_statements_querypattern_1", planCacheHits: "prepared_statements_plancachehits_1", paramTypes: "basic" },
    { queryPattern: "prepared_statements_querypattern_2", planCacheHits: "prepared_statements_plancachehits_2", paramTypes: "standard" },
    { queryPattern: "prepared_statements_querypattern_3", planCacheHits: "prepared_statements_plancachehits_3", paramTypes: "standard" },
  ]).onConflictDoNothing();
  console.log("  seeded: prepared_statements");

  // table_partitions
  await db.insert(schema.tablePartitions).values([
    { tableName: "table_partitions_tablename_1", partitionKey: "table_pa_partitionkey_1", partitionType: "premium", rowsPerPartition: "table_partitions_rowsperpartition_1" },
    { tableName: "table_partitions_tablename_2", partitionKey: "table_pa_partitionkey_2", partitionType: "premium", rowsPerPartition: "table_partitions_rowsperpartition_2" },
    { tableName: "table_partitions_tablename_3", partitionKey: "table_pa_partitionkey_3", partitionType: "standard", rowsPerPartition: "table_partitions_rowsperpartition_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: table_partitions");

  // materialized_views_perf
  await db.insert(schema.materializedViews).values([
    { viewName: "materialized_views_perf_viewname_1" },
    { viewName: "materialized_views_perf_viewname_2" },
    { viewName: "materialized_views_perf_viewname_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: materialized_views_perf");

  // hot_data_caches
  await db.insert(schema.hotDataCaches).values([
    { service: "hot_data_caches_service_1", cacheType: "standard", hitRate: "hot_data_caches_hitrate_1" },
    { service: "hot_data_caches_service_2", cacheType: "premium", hitRate: "hot_data_caches_hitrate_2" },
    { service: "hot_data_caches_service_3", cacheType: "basic", hitRate: "hot_data_caches_hitrate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: hot_data_caches");

  // batch_aggregator_configs
  await db.insert(schema.batchAggregatorConfigs).values([
    { endpoint: "batch_aggregator_configs_endpoint_1" },
    { endpoint: "batch_aggregator_configs_endpoint_2" },
    { endpoint: "batch_aggregator_configs_endpoint_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: batch_aggregator_configs");

  // keepalive_configs
  await db.insert(schema.keepaliveConfigs).values([
    { service: "keepalive_configs_service_1", reuseRate: "keepalive_configs_reuserate_1" },
    { service: "keepalive_configs_service_2", reuseRate: "keepalive_configs_reuserate_2" },
    { service: "keepalive_configs_service_3", reuseRate: "keepalive_configs_reuserate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: keepalive_configs");

  // compression_configs
  await db.insert(schema.compressionConfigs).values([
    { algorithm: "compression_configs_algorithm_1", compressionRatio: "compression_configs_compressionratio_1", bandwidthSaved24h: "compress_bandwidthsaved24h_1" },
    { algorithm: "compression_configs_algorithm_2", compressionRatio: "compression_configs_compressionratio_2", bandwidthSaved24h: "compress_bandwidthsaved24h_2" },
    { algorithm: "compression_configs_algorithm_3", compressionRatio: "compression_configs_compressionratio_3", bandwidthSaved24h: "compress_bandwidthsaved24h_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: compression_configs");

  // grpc_services
  await db.insert(schema.grpcServices).values([
    { service: "grpc_services_service_1", proto: "grpc_services_proto_1", compressionRatio: "grpc_services_compressionratio_1" },
    { service: "grpc_services_service_2", proto: "grpc_services_proto_2", compressionRatio: "grpc_services_compressionratio_2" },
    { service: "grpc_services_service_3", proto: "grpc_services_proto_3", compressionRatio: "grpc_services_compressionratio_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: grpc_services");

  // route_trie_stats
  await db.insert(schema.routeTrieStats).values([
    { routePrefix: "54B-ROUT-517531", cacheHitRate: "route_trie_stats_cachehitrate_1" },
    { routePrefix: "54B-ROUT-913269", cacheHitRate: "route_trie_stats_cachehitrate_2" },
    { routePrefix: "54B-ROUT-146458", cacheHitRate: "route_trie_stats_cachehitrate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: route_trie_stats");

  // stream_response_configs
  await db.insert(schema.streamResponseConfigs).values([
    { endpoint: "stream_response_configs_endpoint_1", bytesStreamed24h: "stream_response_configs_bytesstreamed24h_1", memoryReductionPct: "stream_response_configs_memoryreductionpct_1" },
    { endpoint: "stream_response_configs_endpoint_2", bytesStreamed24h: "stream_response_configs_bytesstreamed24h_2", memoryReductionPct: "stream_response_configs_memoryreductionpct_2" },
    { endpoint: "stream_response_configs_endpoint_3", bytesStreamed24h: "stream_response_configs_bytesstreamed24h_3", memoryReductionPct: "stream_response_configs_memoryreductionpct_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: stream_response_configs");

  // http2_connections
  await db.insert(schema.http2Connections).values([
    { clientIp: "http2_connections_clientip_1", windowSize: "http2_connections_windowsize_1" },
    { clientIp: "http2_connections_clientip_2", windowSize: "http2_connections_windowsize_2" },
    { clientIp: "http2_connections_clientip_3", windowSize: "http2_connections_windowsize_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: http2_connections");

  // coalescing_rules
  await db.insert(schema.coalescingRules).values([
    { route: "coalescing_rules_route_1", savingsRatio: "coalescing_rules_savingsratio_1" },
    { route: "coalescing_rules_route_2", savingsRatio: "coalescing_rules_savingsratio_2" },
    { route: "coalescing_rules_route_3", savingsRatio: "coalescing_rules_savingsratio_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: coalescing_rules");

  // fast_json_schemas
  await db.insert(schema.fastJsonSchemas).values([
    { schemaName: "fast_json_schemas_schemaname_1", speedup: "fast_json_schemas_speedup_1" },
    { schemaName: "fast_json_schemas_schemaname_2", speedup: "fast_json_schemas_speedup_2" },
    { schemaName: "fast_json_schemas_schemaname_3", speedup: "fast_json_schemas_speedup_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: fast_json_schemas");

  // sw_cache_strategies
  await db.insert(schema.swCacheStrategies).values([
    { pattern: "sw_cache_strategies_pattern_1", strategy: "sw_cache_strategies_strategy_1", cacheHitRate: "sw_cache_strategies_cachehitrate_1" },
    { pattern: "sw_cache_strategies_pattern_2", strategy: "sw_cache_strategies_strategy_2", cacheHitRate: "sw_cache_strategies_cachehitrate_2" },
    { pattern: "sw_cache_strategies_pattern_3", strategy: "sw_cache_strategies_strategy_3", cacheHitRate: "sw_cache_strategies_cachehitrate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: sw_cache_strategies");

  // virtual_scroll_configs
  await db.insert(schema.virtualScrollConfigs).values([
    { tableName: "virtual_scroll_configs_tablename_1" },
    { tableName: "virtual_scroll_configs_tablename_2" },
    { tableName: "virtual_scroll_configs_tablename_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: virtual_scroll_configs");

  // memoization_targets
  await db.insert(schema.memoizationTargets).values([
    { component: "memoization_targets_component_1", estimatedSavingPct: "memoization_targets_estimatedsavingpct_1", recommendation: "memoization_targets_recommendation_1" },
    { component: "memoization_targets_component_2", estimatedSavingPct: "memoization_targets_estimatedsavingpct_2", recommendation: "memoization_targets_recommendation_2" },
    { component: "memoization_targets_component_3", estimatedSavingPct: "memoization_targets_estimatedsavingpct_3", recommendation: "memoization_targets_recommendation_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: memoization_targets");

  // bundle_split_configs
  await db.insert(schema.bundleSplitConfigs).values([
    { chunk: "bundle_split_configs_chunk_1", preloadHint: "bundle_split_configs_preloadhint_1" },
    { chunk: "bundle_split_configs_chunk_2", preloadHint: "bundle_split_configs_preloadhint_2" },
    { chunk: "bundle_split_configs_chunk_3", preloadHint: "bundle_split_configs_preloadhint_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: bundle_split_configs");

  // optimistic_ui_configs
  await db.insert(schema.optimisticUIConfigs).values([
    { action: "optimistic_ui_configs_action_1", endpoint: "optimistic_ui_configs_endpoint_1", successRate: "optimistic_ui_configs_successrate_1" },
    { action: "optimistic_ui_configs_action_2", endpoint: "optimistic_ui_configs_endpoint_2", successRate: "optimistic_ui_configs_successrate_2" },
    { action: "optimistic_ui_configs_action_3", endpoint: "optimistic_ui_configs_endpoint_3", successRate: "optimistic_ui_configs_successrate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: optimistic_ui_configs");

  // kafka_consumer_groups
  await db.insert(schema.kafkaConsumerGroups).values([
    { groupId: "kafka_co_groupid_1", topic: "kafka_consumer_groups_topic_1" },
    { groupId: "kafka_co_groupid_2", topic: "kafka_consumer_groups_topic_2" },
    { groupId: "kafka_co_groupid_3", topic: "kafka_consumer_groups_topic_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: kafka_consumer_groups");

  // kafka_batch_producers
  await db.insert(schema.kafkaBatchProducers).values([
    { topic: "kafka_batch_producers_topic_1", compressionType: "standard" },
    { topic: "kafka_batch_producers_topic_2", compressionType: "basic" },
    { topic: "kafka_batch_producers_topic_3", compressionType: "premium" },
  ]).onConflictDoNothing();
  console.log("  seeded: kafka_batch_producers");

  // avro_schemas
  await db.insert(schema.avroSchemas).values([
    { subject: "avro_schemas_subject_1", compatibilityMode: "avro_schemas_compatibilitymode_1", compressionRatio: "avro_schemas_compressionratio_1" },
    { subject: "avro_schemas_subject_2", compatibilityMode: "avro_schemas_compatibilitymode_2", compressionRatio: "avro_schemas_compressionratio_2" },
    { subject: "avro_schemas_subject_3", compatibilityMode: "avro_schemas_compatibilitymode_3", compressionRatio: "avro_schemas_compressionratio_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: avro_schemas");

  // fluvio_smart_modules
  await db.insert(schema.fluvioSmartModules).values([
    { name: "Fatima Hassan", moduleType: "premium" },
    { name: "Kano Textiles Ltd", moduleType: "basic" },
    { name: "Ngozi Okafor", moduleType: "standard" },
  ]).onConflictDoNothing();
  console.log("  seeded: fluvio_smart_modules");

  // event_dedup_configs
  await db.insert(schema.eventDedupConfigs).values([
    { topic: "event_dedup_configs_topic_1", strategy: "event_dedup_configs_strategy_1" },
    { topic: "event_dedup_configs_topic_2", strategy: "event_dedup_configs_strategy_2" },
    { topic: "event_dedup_configs_topic_3", strategy: "event_dedup_configs_strategy_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: event_dedup_configs");

  // distroless_images
  await db.insert(schema.distrolessImages).values([
    { service: "distroless_images_service_1", baseImage: "distroless_images_baseimage_1", reductionPct: "distroless_images_reductionpct_1" },
    { service: "distroless_images_service_2", baseImage: "distroless_images_baseimage_2", reductionPct: "distroless_images_reductionpct_2" },
    { service: "distroless_images_service_3", baseImage: "distroless_images_baseimage_3", reductionPct: "distroless_images_reductionpct_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: distroless_images");

  // hpa_configs
  await db.insert(schema.hpaConfigs).values([
    { deployment: "hpa_configs_deployment_1", customMetric: "hpa_configs_custommetric_1" },
    { deployment: "hpa_configs_deployment_2", customMetric: "hpa_configs_custommetric_2" },
    { deployment: "hpa_configs_deployment_3", customMetric: "hpa_configs_custommetric_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: hpa_configs");

  // cdn_edge_configs
  await db.insert(schema.cdnEdgeConfigs).values([
    { provider: "cdn_edge_provider_1", origin: "cdn_edge_configs_origin_1", bandwidthSaved24h: "cdn_edge_bandwidthsaved24h_1" },
    { provider: "cdn_edge_provider_2", origin: "cdn_edge_configs_origin_2", bandwidthSaved24h: "cdn_edge_bandwidthsaved24h_2" },
    { provider: "cdn_edge_provider_3", origin: "cdn_edge_configs_origin_3", bandwidthSaved24h: "cdn_edge_bandwidthsaved24h_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: cdn_edge_configs");

  // read_replica_configs
  await db.insert(schema.readReplicaConfigs).values([
    { replicaHost: "read_replica_configs_replicahost_1" },
    { replicaHost: "read_replica_configs_replicahost_2" },
    { replicaHost: "read_replica_configs_replicahost_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: read_replica_configs");

  // keda_scale_triggers
  await db.insert(schema.kedaScaleTriggers).values([
    { scaleObject: "keda_scale_triggers_scaleobject_1", trigger: "keda_scale_triggers_trigger_1", metric: "keda_scale_triggers_metric_1" },
    { scaleObject: "keda_scale_triggers_scaleobject_2", trigger: "keda_scale_triggers_trigger_2", metric: "keda_scale_triggers_metric_2" },
    { scaleObject: "keda_scale_triggers_scaleobject_3", trigger: "keda_scale_triggers_trigger_3", metric: "keda_scale_triggers_metric_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: keda_scale_triggers");

  // prometheus_dashboards
  await db.insert(schema.prometheusDashboards).values([
    { dashboard: "prometheus_dashboards_dashboard_1", refreshInterval: "54B-PROM-176752", dataSourceRetention: "prometheus_dashboards_datasourceretention_1" },
    { dashboard: "prometheus_dashboards_dashboard_2", refreshInterval: "54B-PROM-623530", dataSourceRetention: "prometheus_dashboards_datasourceretention_2" },
    { dashboard: "prometheus_dashboards_dashboard_3", refreshInterval: "54B-PROM-516553", dataSourceRetention: "prometheus_dashboards_datasourceretention_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: prometheus_dashboards");

  // opensearch_index_configs
  await db.insert(schema.opensearchIndexConfigs).values([
    { indexName: "opensearch_index_configs_indexname_1" },
    { indexName: "opensearch_index_configs_indexname_2" },
    { indexName: "opensearch_index_configs_indexname_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: opensearch_index_configs");

  // temporal_memoized_activities
  await db.insert(schema.temporalMemoizedActivities).values([
    { workflow: "temporal_memoized_activities_workflow_1", activity: "temporal_memoized_activities_activity_1", replaySpeedup: "temporal_memoized_activities_replayspeedup_1", cacheTTL: "temporal_memoized_activities_cachettl_1", cacheHitRate: "temporal_memoized_activities_cachehitrate_1" },
    { workflow: "temporal_memoized_activities_workflow_2", activity: "temporal_memoized_activities_activity_2", replaySpeedup: "temporal_memoized_activities_replayspeedup_2", cacheTTL: "temporal_memoized_activities_cachettl_2", cacheHitRate: "temporal_memoized_activities_cachehitrate_2" },
    { workflow: "temporal_memoized_activities_workflow_3", activity: "temporal_memoized_activities_activity_3", replaySpeedup: "temporal_memoized_activities_replayspeedup_3", cacheTTL: "temporal_memoized_activities_cachettl_3", cacheHitRate: "temporal_memoized_activities_cachehitrate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: temporal_memoized_activities");

  // apisix_plugin_chains
  await db.insert(schema.apisixPluginChains).values([
    { route: "apisix_plugin_chains_route_1", latencySaving: "apisix_plugin_chains_latencysaving_1" },
    { route: "apisix_plugin_chains_route_2", latencySaving: "apisix_plugin_chains_latencysaving_2" },
    { route: "apisix_plugin_chains_route_3", latencySaving: "apisix_plugin_chains_latencysaving_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: apisix_plugin_chains");

  // aml_risk_scores
  await db.insert(schema.amlRiskScores).values([
    { customerId: "aml_risk_customerid_1", customerName: "aml_risk_scores_customername_1", riskLevel: "aml_risk_scores_risklevel_1", cddLevel: "aml_risk_scores_cddlevel_1" },
    { customerId: "aml_risk_customerid_2", customerName: "aml_risk_scores_customername_2", riskLevel: "aml_risk_scores_risklevel_2", cddLevel: "aml_risk_scores_cddlevel_2" },
    { customerId: "aml_risk_customerid_3", customerName: "aml_risk_scores_customername_3", riskLevel: "aml_risk_scores_risklevel_3", cddLevel: "aml_risk_scores_cddlevel_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: aml_risk_scores");

  // sar_reports_aml
  await db.insert(schema.sarReports).values([
    { customerId: "sar_repo_customerid_1", customerName: "sar_reports_aml_customername_1", reportType: "basic", reason: "54Bank sar_reports_aml record 1", currency: "EUR", nfiuReference: "54B-SAR_-748161", priority: "sar_reports_aml_priority_1" },
    { customerId: "sar_repo_customerid_2", customerName: "sar_reports_aml_customername_2", reportType: "basic", reason: "54Bank sar_reports_aml record 2", currency: "NGN", nfiuReference: "54B-SAR_-249071", priority: "sar_reports_aml_priority_2" },
    { customerId: "sar_repo_customerid_3", customerName: "sar_reports_aml_customername_3", reportType: "basic", reason: "54Bank sar_reports_aml record 3", currency: "EUR", nfiuReference: "54B-SAR_-987797", priority: "sar_reports_aml_priority_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: sar_reports_aml");

  // ctr_reports_aml
  await db.insert(schema.ctrReports).values([
    { customerId: "ctr_repo_customerid_1", customerName: "ctr_reports_aml_customername_1", transactionId: "ctr_repo_transactionid_1", currency: "GBP", transactionType: "standard", nfiuReference: "54B-CTR_-365598" },
    { customerId: "ctr_repo_customerid_2", customerName: "ctr_reports_aml_customername_2", transactionId: "ctr_repo_transactionid_2", currency: "NGN", transactionType: "premium", nfiuReference: "54B-CTR_-207801" },
    { customerId: "ctr_repo_customerid_3", customerName: "ctr_reports_aml_customername_3", transactionId: "ctr_repo_transactionid_3", currency: "GBP", transactionType: "basic", nfiuReference: "54B-CTR_-771257" },
  ]).onConflictDoNothing();
  console.log("  seeded: ctr_reports_aml");

  // aml_cases
  await db.insert(schema.amlCases).values([
    { customerId: "aml_case_customerid_1", customerName: "aml_cases_customername_1", caseType: "basic", riskLevel: "aml_cases_risklevel_1", assignedTo: "aml_cases_assignedto_1" },
    { customerId: "aml_case_customerid_2", customerName: "aml_cases_customername_2", caseType: "premium", riskLevel: "aml_cases_risklevel_2", assignedTo: "aml_cases_assignedto_2" },
    { customerId: "aml_case_customerid_3", customerName: "aml_cases_customername_3", caseType: "premium", riskLevel: "aml_cases_risklevel_3", assignedTo: "aml_cases_assignedto_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: aml_cases");

  // watchlist_sources
  await db.insert(schema.watchlistSources).values([
    { name: "Chidi Obi", source: "watchlist_sources_source_1", url: "https://api.54bank.ng/v1/watchlist_sources/1", format: "watchlist_sources_format_1", syncFrequency: "watchlist_sources_syncfrequency_1" },
    { name: "Abuja Properties Ltd", source: "watchlist_sources_source_2", url: "https://api.54bank.ng/v1/watchlist_sources/2", format: "watchlist_sources_format_2", syncFrequency: "watchlist_sources_syncfrequency_2" },
    { name: "Godwin Etim", source: "watchlist_sources_source_3", url: "https://api.54bank.ng/v1/watchlist_sources/3", format: "watchlist_sources_format_3", syncFrequency: "watchlist_sources_syncfrequency_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: watchlist_sources");

  // adverse_media_scans
  await db.insert(schema.adverseMediaScans).values([
    { customerId: "adverse__customerid_1", customerName: "adverse_media_scans_customername_1", sentiment: "adverse_media_scans_sentiment_1", riskImpact: "adverse_media_scans_riskimpact_1" },
    { customerId: "adverse__customerid_2", customerName: "adverse_media_scans_customername_2", sentiment: "adverse_media_scans_sentiment_2", riskImpact: "adverse_media_scans_riskimpact_2" },
    { customerId: "adverse__customerid_3", customerName: "adverse_media_scans_customername_3", sentiment: "adverse_media_scans_sentiment_3", riskImpact: "adverse_media_scans_riskimpact_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: adverse_media_scans");

  // beneficial_owners
  await db.insert(schema.beneficialOwners).values([
    { entityId: "benefici_entityid_1", entityName: "beneficial_owners_entityname_1", entityType: "standard", rcNumber: "benefici_rcnumber_1" },
    { entityId: "benefici_entityid_2", entityName: "beneficial_owners_entityname_2", entityType: "standard", rcNumber: "benefici_rcnumber_2" },
    { entityId: "benefici_entityid_3", entityName: "beneficial_owners_entityname_3", entityType: "standard", rcNumber: "benefici_rcnumber_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: beneficial_owners");

  // txn_pattern_analyses
  await db.insert(schema.txnPatternAnalyses).values([
    { customerId: "txn_patt_customerid_1", customerName: "txn_pattern_analyses_customername_1", baselineDeviation: "txn_pattern_analyses_baselinedeviation_1", recommendation: "txn_pattern_analyses_recommendation_1" },
    { customerId: "txn_patt_customerid_2", customerName: "txn_pattern_analyses_customername_2", baselineDeviation: "txn_pattern_analyses_baselinedeviation_2", recommendation: "txn_pattern_analyses_recommendation_2" },
    { customerId: "txn_patt_customerid_3", customerName: "txn_pattern_analyses_customername_3", baselineDeviation: "txn_pattern_analyses_baselinedeviation_3", recommendation: "txn_pattern_analyses_recommendation_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: txn_pattern_analyses");

  // goaml_reports
  await db.insert(schema.goamlReports).values([
    { reportType: "standard", subject: "goaml_reports_subject_1", nfiuAcknowledgement: "goaml_reports_nfiuacknowledgement_1" },
    { reportType: "basic", subject: "goaml_reports_subject_2", nfiuAcknowledgement: "goaml_reports_nfiuacknowledgement_2" },
    { reportType: "premium", subject: "goaml_reports_subject_3", nfiuAcknowledgement: "goaml_reports_nfiuacknowledgement_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: goaml_reports");

  // aml_compliance_metrics
  await db.insert(schema.amlComplianceMetrics).values([
    { period: "aml_compliance_metrics_period_1" },
    { period: "aml_compliance_metrics_period_2" },
    { period: "aml_compliance_metrics_period_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: aml_compliance_metrics");

  // sanctions_batch_runs
  await db.insert(schema.sanctionsBatchRuns).values([
    { triggerType: "basic" },
    { triggerType: "basic" },
    { triggerType: "basic" },
  ]).onConflictDoNothing();
  console.log("  seeded: sanctions_batch_runs");

  // aml_training_records
  await db.insert(schema.amlTrainingRecords).values([
    { staffId: "aml_trai_staffid_1", staffName: "aml_training_records_staffname_1", role: "user", trainingModule: "aml_training_records_trainingmodule_1" },
    { staffId: "aml_trai_staffid_2", staffName: "aml_training_records_staffname_2", role: "user", trainingModule: "aml_training_records_trainingmodule_2" },
    { staffId: "aml_trai_staffid_3", staffName: "aml_training_records_staffname_3", role: "branch_manager", trainingModule: "aml_training_records_trainingmodule_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: aml_training_records");

  // wire_transfer_monitor
  await db.insert(schema.wireTransferMonitor).values([
    { originatorName: "wire_transfer_monitor_originatorname_1", beneficiaryName: "wire_transfer_monitor_beneficiaryname_1", currency: "USD" },
    { originatorName: "wire_transfer_monitor_originatorname_2", beneficiaryName: "wire_transfer_monitor_beneficiaryname_2", currency: "GBP" },
    { originatorName: "wire_transfer_monitor_originatorname_3", beneficiaryName: "wire_transfer_monitor_beneficiaryname_3", currency: "NGN" },
  ]).onConflictDoNothing();
  console.log("  seeded: wire_transfer_monitor");

  // regulatory_reports_aml
  await db.insert(schema.amlRegulatoryReports).values([
    { reportType: "basic", period: "regulatory_reports_aml_period_1", submittedTo: "regulatory_reports_aml_submittedto_1", filedDate: "regulatory_reports_aml_fileddate_1" },
    { reportType: "standard", period: "regulatory_reports_aml_period_2", submittedTo: "regulatory_reports_aml_submittedto_2", filedDate: "regulatory_reports_aml_fileddate_2" },
    { reportType: "premium", period: "regulatory_reports_aml_period_3", submittedTo: "regulatory_reports_aml_submittedto_3", filedDate: "regulatory_reports_aml_fileddate_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: regulatory_reports_aml");

  // typology_matches
  await db.insert(schema.typologyMatches).values([
    { typologyCode: "typology_typologycode_1", typologyName: "typology_matches_typologyname_1", riskLevel: "typology_matches_risklevel_1" },
    { typologyCode: "typology_typologycode_2", typologyName: "typology_matches_typologyname_2", riskLevel: "typology_matches_risklevel_2" },
    { typologyCode: "typology_typologycode_3", typologyName: "typology_matches_typologyname_3", riskLevel: "typology_matches_risklevel_3" },
  ]).onConflictDoNothing();
  console.log("  seeded: typology_matches");

  // cooperative_management
  await db.insert(schema.cooperativeManagement).values([
    { tenantId: "tenant-abuja-hq", recordId: "cooperat_record_id_1", name: "Kemi Adeyemi", category: "basic", description: "54Bank cooperative_management record 1", status: "approved", region: "Nigeria", reference: "54B-COOP-494590", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "cooperat_record_id_2", name: "Abuja Properties Ltd", category: "standard", description: "54Bank cooperative_management record 2", status: "pending", region: "Nigeria", reference: "54B-COOP-733709", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "cooperat_record_id_3", name: "Obinna Chukwu", category: "premium", description: "54Bank cooperative_management record 3", status: "approved", region: "Nigeria", reference: "54B-COOP-461156", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: cooperative_management");

  // livestock_management
  await db.insert(schema.livestockManagement).values([
    { tenantId: "tenant-kano-north", recordId: "livestoc_record_id_1", name: "Uchenna Ikenna", category: "standard", description: "54Bank livestock_management record 1", status: "pending", region: "Nigeria", reference: "54B-LIVE-935771", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "livestoc_record_id_2", name: "Oando Energy", category: "standard", description: "54Bank livestock_management record 2", status: "pending", region: "Nigeria", reference: "54B-LIVE-697130", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "livestoc_record_id_3", name: "Rashida Bello", category: "premium", description: "54Bank livestock_management record 3", status: "approved", region: "Nigeria", reference: "54B-LIVE-965853", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: livestock_management");

  // agri_input_marketplace
  await db.insert(schema.agriInputMarketplace).values([
    { tenantId: "tenant-ph-south", recordId: "agri_inp_record_id_1", name: "Folake Adeniyi", category: "basic", description: "54Bank agri_input_marketplace record 1", status: "approved", region: "Nigeria", reference: "54B-AGRI-750876", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "agri_inp_record_id_2", name: "Kano Textiles Ltd", category: "premium", description: "54Bank agri_input_marketplace record 2", status: "active", region: "Nigeria", reference: "54B-AGRI-626037", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "agri_inp_record_id_3", name: "Rashida Bello", category: "standard", description: "54Bank agri_input_marketplace record 3", status: "active", region: "Nigeria", reference: "54B-AGRI-720931", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: agri_input_marketplace");

  // nirsal_credit_guarantee
  await db.insert(schema.nirsalCreditGuarantee).values([
    { tenantId: "tenant-lagos-main", recordId: "nirsal_c_record_id_1", name: "Chidi Obi", category: "basic", description: "54Bank nirsal_credit_guarantee record 1", status: "rejected", region: "Nigeria", reference: "54B-NIRS-432596", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "nirsal_c_record_id_2", name: "Emeka & Sons Trading", category: "standard", description: "54Bank nirsal_credit_guarantee record 2", status: "completed", region: "Nigeria", reference: "54B-NIRS-896406", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "nirsal_c_record_id_3", name: "Fatima Hassan", category: "premium", description: "54Bank nirsal_credit_guarantee record 3", status: "rejected", region: "Nigeria", reference: "54B-NIRS-446614", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: nirsal_credit_guarantee");

  // cbn_anchor_borrowers
  await db.insert(schema.cbnAnchorBorrowers).values([
    { tenantId: "tenant-kano-north", recordId: "cbn_anch_record_id_1", name: "Rashida Bello", category: "basic", description: "54Bank cbn_anchor_borrowers record 1", status: "approved", region: "Nigeria", reference: "54B-CBN_-258642", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "cbn_anch_record_id_2", name: "Emeka & Sons Trading", category: "basic", description: "54Bank cbn_anchor_borrowers record 2", status: "pending", region: "Nigeria", reference: "54B-CBN_-602997", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "cbn_anch_record_id_3", name: "Oluwaseun Ajayi", category: "standard", description: "54Bank cbn_anchor_borrowers record 3", status: "pending", region: "Nigeria", reference: "54B-CBN_-794588", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: cbn_anchor_borrowers");

  // interactive_ussd_agri
  await db.insert(schema.interactiveUssdAgri).values([
    { tenantId: "tenant-lagos-main", recordId: "interact_record_id_1", name: "Rashida Bello", category: "premium", description: "54Bank interactive_ussd_agri record 1", status: "inactive", region: "Nigeria", reference: "54B-INTE-528327", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "interact_record_id_2", name: "Oando Energy", category: "premium", description: "54Bank interactive_ussd_agri record 2", status: "active", region: "Nigeria", reference: "54B-INTE-844937", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "interact_record_id_3", name: "Adewale Ogundimu", category: "standard", description: "54Bank interactive_ussd_agri record 3", status: "approved", region: "Nigeria", reference: "54B-INTE-336816", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: interactive_ussd_agri");

  // agri_savings_cycles
  await db.insert(schema.agriSavingsCycles).values([
    { tenantId: "tenant-ph-south", recordId: "agri_sav_record_id_1", name: "Adewale Ogundimu", category: "basic", description: "54Bank agri_savings_cycles record 1", status: "approved", region: "Nigeria", reference: "54B-AGRI-255815", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "agri_sav_record_id_2", name: "Emeka & Sons Trading", category: "standard", description: "54Bank agri_savings_cycles record 2", status: "pending", region: "Nigeria", reference: "54B-AGRI-555674", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "agri_sav_record_id_3", name: "Rashida Bello", category: "standard", description: "54Bank agri_savings_cycles record 3", status: "inactive", region: "Nigeria", reference: "54B-AGRI-825948", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: agri_savings_cycles");

  // livestock_finance
  await db.insert(schema.livestockFinance).values([
    { tenantId: "tenant-ph-south", recordId: "livestoc_record_id_1", name: "Danladi Garba", category: "standard", description: "54Bank livestock_finance record 1", status: "approved", region: "Nigeria", reference: "54B-LIVE-421100", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "livestoc_record_id_2", name: "Abuja Properties Ltd", category: "premium", description: "54Bank livestock_finance record 2", status: "active", region: "Nigeria", reference: "54B-LIVE-752490", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "livestoc_record_id_3", name: "Folake Adeniyi", category: "premium", description: "54Bank livestock_finance record 3", status: "rejected", region: "Nigeria", reference: "54B-LIVE-891350", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: livestock_finance");

  // commodity_exchange
  await db.insert(schema.commodityExchange).values([
    { tenantId: "tenant-abuja-hq", recordId: "commodit_record_id_1", name: "Yetunde Olowe", category: "basic", description: "54Bank commodity_exchange record 1", status: "inactive", region: "Nigeria", reference: "54B-COMM-344905", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "commodit_record_id_2", name: "Emeka & Sons Trading", category: "basic", description: "54Bank commodity_exchange record 2", status: "active", region: "Nigeria", reference: "54B-COMM-679855", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "commodit_record_id_3", name: "Uchenna Ikenna", category: "basic", description: "54Bank commodity_exchange record 3", status: "active", region: "Nigeria", reference: "54B-COMM-232115", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: commodity_exchange");

  // agri_evoucher
  await db.insert(schema.agriEvoucher).values([
    { tenantId: "tenant-abuja-hq", recordId: "agri_evo_record_id_1", name: "Fatima Hassan", category: "premium", description: "54Bank agri_evoucher record 1", status: "pending", region: "Nigeria", reference: "54B-AGRI-679091", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "agri_evo_record_id_2", name: "Abuja Properties Ltd", category: "basic", description: "54Bank agri_evoucher record 2", status: "rejected", region: "Nigeria", reference: "54B-AGRI-893264", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "agri_evo_record_id_3", name: "Godwin Etim", category: "basic", description: "54Bank agri_evoucher record 3", status: "rejected", region: "Nigeria", reference: "54B-AGRI-767852", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: agri_evoucher");

  // commodity_price_intelligence
  await db.insert(schema.commodityPriceIntelligence).values([
    { tenantId: "tenant-kano-north", recordId: "commodit_record_id_1", name: "Danladi Garba", category: "standard", description: "54Bank commodity_price_intelligence record 1", status: "active", region: "Nigeria", reference: "54B-COMM-758739", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "commodit_record_id_2", name: "Lagos Agro-Allied Co", category: "premium", description: "54Bank commodity_price_intelligence record 2", status: "pending", region: "Nigeria", reference: "54B-COMM-344379", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "commodit_record_id_3", name: "Yetunde Olowe", category: "premium", description: "54Bank commodity_price_intelligence record 3", status: "active", region: "Nigeria", reference: "54B-COMM-551608", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: commodity_price_intelligence");

  // satellite_crop_monitor
  await db.insert(schema.satelliteCropMonitor).values([
    { tenantId: "tenant-lagos-main", recordId: "satellit_record_id_1", name: "Amina Yusuf", category: "premium", description: "54Bank satellite_crop_monitor record 1", status: "rejected", region: "Nigeria", reference: "54B-SATE-930691", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "satellit_record_id_2", name: "Emeka & Sons Trading", category: "premium", description: "54Bank satellite_crop_monitor record 2", status: "active", region: "Nigeria", reference: "54B-SATE-375462", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "satellit_record_id_3", name: "Oluwaseun Ajayi", category: "premium", description: "54Bank satellite_crop_monitor record 3", status: "active", region: "Nigeria", reference: "54B-SATE-946950", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: satellite_crop_monitor");

  // cooperative_credit_scoring
  await db.insert(schema.cooperativeCreditScoring).values([
    { tenantId: "tenant-abuja-hq", recordId: "cooperat_record_id_1", name: "Rashida Bello", category: "basic", description: "54Bank cooperative_credit_scoring record 1", status: "inactive", region: "Nigeria", reference: "54B-COOP-897797", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "cooperat_record_id_2", name: "Lagos Agro-Allied Co", category: "basic", description: "54Bank cooperative_credit_scoring record 2", status: "pending", region: "Nigeria", reference: "54B-COOP-370140", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "cooperat_record_id_3", name: "Danladi Garba", category: "standard", description: "54Bank cooperative_credit_scoring record 3", status: "completed", region: "Nigeria", reference: "54B-COOP-719731", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: cooperative_credit_scoring");

  // fisheries_aquaculture
  await db.insert(schema.fisheriesAquaculture).values([
    { tenantId: "tenant-lagos-main", recordId: "fisherie_record_id_1", name: "Tunde Bakare", category: "basic", description: "54Bank fisheries_aquaculture record 1", status: "inactive", region: "Nigeria", reference: "54B-FISH-210049", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "fisherie_record_id_2", name: "Abuja Properties Ltd", category: "basic", description: "54Bank fisheries_aquaculture record 2", status: "pending", region: "Nigeria", reference: "54B-FISH-660155", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "fisherie_record_id_3", name: "Tunde Bakare", category: "premium", description: "54Bank fisheries_aquaculture record 3", status: "pending", region: "Nigeria", reference: "54B-FISH-212854", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: fisheries_aquaculture");

  // farm_boundary_mapping
  await db.insert(schema.farmBoundaryMapping).values([
    { tenantId: "tenant-abuja-hq", recordId: "farm_bou_record_id_1", name: "Ngozi Okafor", category: "premium", description: "54Bank farm_boundary_mapping record 1", status: "active", region: "Nigeria", reference: "54B-FARM-500573", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "farm_bou_record_id_2", name: "Oando Energy", category: "basic", description: "54Bank farm_boundary_mapping record 2", status: "approved", region: "Nigeria", reference: "54B-FARM-582137", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "farm_bou_record_id_3", name: "Halima Abdullahi", category: "standard", description: "54Bank farm_boundary_mapping record 3", status: "active", region: "Nigeria", reference: "54B-FARM-203825", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: farm_boundary_mapping");

  // area_yield_index_insurance
  await db.insert(schema.areaYieldIndexInsurance).values([
    { tenantId: "tenant-kano-north", recordId: "area_yie_record_id_1", name: "Aisha Mohammed", category: "standard", description: "54Bank area_yield_index_insurance record 1", status: "completed", region: "Nigeria", reference: "54B-AREA-158208", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "area_yie_record_id_2", name: "Dangote Industries Ltd", category: "premium", description: "54Bank area_yield_index_insurance record 2", status: "rejected", region: "Nigeria", reference: "54B-AREA-213073", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "area_yie_record_id_3", name: "Obinna Chukwu", category: "premium", description: "54Bank area_yield_index_insurance record 3", status: "completed", region: "Nigeria", reference: "54B-AREA-117431", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: area_yield_index_insurance");

  // warehouse_management
  await db.insert(schema.warehouseManagement).values([
    { tenantId: "tenant-abuja-hq", recordId: "warehous_record_id_1", name: "Amina Yusuf", category: "premium", description: "54Bank warehouse_management record 1", status: "approved", region: "Nigeria", reference: "54B-WARE-941530", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "warehous_record_id_2", name: "Abuja Properties Ltd", category: "premium", description: "54Bank warehouse_management record 2", status: "approved", region: "Nigeria", reference: "54B-WARE-623054", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "warehous_record_id_3", name: "Ibrahim Musa", category: "premium", description: "54Bank warehouse_management record 3", status: "pending", region: "Nigeria", reference: "54B-WARE-972724", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: warehouse_management");

  // agent_farmer_onboarding
  await db.insert(schema.agentFarmerOnboarding).values([
    { tenantId: "tenant-ph-south", recordId: "agent_fa_record_id_1", name: "Ibrahim Musa", category: "premium", description: "54Bank agent_farmer_onboarding record 1", status: "completed", region: "Nigeria", reference: "54B-AGEN-364152", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "agent_fa_record_id_2", name: "Abuja Properties Ltd", category: "basic", description: "54Bank agent_farmer_onboarding record 2", status: "inactive", region: "Nigeria", reference: "54B-AGEN-270363", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "agent_fa_record_id_3", name: "Ngozi Okafor", category: "basic", description: "54Bank agent_farmer_onboarding record 3", status: "approved", region: "Nigeria", reference: "54B-AGEN-203544", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: agent_farmer_onboarding");

  // livestock_insurance
  await db.insert(schema.livestockInsurance).values([
    { tenantId: "tenant-lagos-main", recordId: "livestoc_record_id_1", name: "Kemi Adeyemi", category: "basic", description: "54Bank livestock_insurance record 1", status: "rejected", region: "Nigeria", reference: "54B-LIVE-345649", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "livestoc_record_id_2", name: "Emeka & Sons Trading", category: "premium", description: "54Bank livestock_insurance record 2", status: "completed", region: "Nigeria", reference: "54B-LIVE-857467", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "livestoc_record_id_3", name: "Adewale Ogundimu", category: "basic", description: "54Bank livestock_insurance record 3", status: "approved", region: "Nigeria", reference: "54B-LIVE-676088", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: livestock_insurance");

  // equipment_leasing
  await db.insert(schema.equipmentLeasing).values([
    { tenantId: "tenant-abuja-hq", recordId: "equipmen_record_id_1", name: "Obinna Chukwu", category: "premium", description: "54Bank equipment_leasing record 1", status: "rejected", region: "Nigeria", reference: "54B-EQUI-510904", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "equipmen_record_id_2", name: "Dangote Industries Ltd", category: "standard", description: "54Bank equipment_leasing record 2", status: "active", region: "Nigeria", reference: "54B-EQUI-694422", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "equipmen_record_id_3", name: "Oluwaseun Ajayi", category: "premium", description: "54Bank equipment_leasing record 3", status: "pending", region: "Nigeria", reference: "54B-EQUI-445218", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: equipment_leasing");

  // crop_yield_prediction
  await db.insert(schema.cropYieldPrediction).values([
    { tenantId: "tenant-abuja-hq", recordId: "crop_yie_record_id_1", name: "Obinna Chukwu", category: "basic", description: "54Bank crop_yield_prediction record 1", status: "approved", region: "Nigeria", reference: "54B-CROP-114716", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "crop_yie_record_id_2", name: "Kano Textiles Ltd", category: "premium", description: "54Bank crop_yield_prediction record 2", status: "inactive", region: "Nigeria", reference: "54B-CROP-823214", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "crop_yie_record_id_3", name: "Obinna Chukwu", category: "basic", description: "54Bank crop_yield_prediction record 3", status: "completed", region: "Nigeria", reference: "54B-CROP-942920", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: crop_yield_prediction");

  // multi_peril_crop_insurance
  await db.insert(schema.multiPerilCropInsurance).values([
    { tenantId: "tenant-lagos-main", recordId: "multi_pe_record_id_1", name: "Oluwaseun Ajayi", category: "premium", description: "54Bank multi_peril_crop_insurance record 1", status: "active", region: "Nigeria", reference: "54B-MULT-422884", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "multi_pe_record_id_2", name: "Kano Textiles Ltd", category: "premium", description: "54Bank multi_peril_crop_insurance record 2", status: "rejected", region: "Nigeria", reference: "54B-MULT-766906", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "multi_pe_record_id_3", name: "Danladi Garba", category: "premium", description: "54Bank multi_peril_crop_insurance record 3", status: "pending", region: "Nigeria", reference: "54B-MULT-590304", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: multi_peril_crop_insurance");

  // agri_logistics
  await db.insert(schema.agriLogistics).values([
    { tenantId: "tenant-ph-south", recordId: "agri_log_record_id_1", name: "Ibrahim Musa", category: "standard", description: "54Bank agri_logistics record 1", status: "active", region: "Nigeria", reference: "54B-AGRI-930351", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "agri_log_record_id_2", name: "Oando Energy", category: "basic", description: "54Bank agri_logistics record 2", status: "inactive", region: "Nigeria", reference: "54B-AGRI-818992", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "agri_log_record_id_3", name: "Yetunde Olowe", category: "standard", description: "54Bank agri_logistics record 3", status: "completed", region: "Nigeria", reference: "54B-AGRI-987877", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: agri_logistics");

  // cbn_agri_returns
  await db.insert(schema.cbnAgriReturns).values([
    { tenantId: "tenant-abuja-hq", recordId: "cbn_agri_record_id_1", name: "Fatima Hassan", category: "standard", description: "54Bank cbn_agri_returns record 1", status: "pending", region: "Nigeria", reference: "54B-CBN_-827808", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "cbn_agri_record_id_2", name: "Oando Energy", category: "premium", description: "54Bank cbn_agri_returns record 2", status: "rejected", region: "Nigeria", reference: "54B-CBN_-732223", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "cbn_agri_record_id_3", name: "Fatima Hassan", category: "standard", description: "54Bank cbn_agri_returns record 3", status: "pending", region: "Nigeria", reference: "54B-CBN_-219618", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: cbn_agri_returns");

  // animal_id_traceability
  await db.insert(schema.animalIdTraceability).values([
    { tenantId: "tenant-kano-north", recordId: "animal_i_record_id_1", name: "Fatima Hassan", category: "basic", description: "54Bank animal_id_traceability record 1", status: "rejected", region: "Nigeria", reference: "54B-ANIM-960530", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "animal_i_record_id_2", name: "Dangote Industries Ltd", category: "premium", description: "54Bank animal_id_traceability record 2", status: "inactive", region: "Nigeria", reference: "54B-ANIM-568972", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "animal_i_record_id_3", name: "Adewale Ogundimu", category: "basic", description: "54Bank animal_id_traceability record 3", status: "rejected", region: "Nigeria", reference: "54B-ANIM-184365", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: animal_id_traceability");

  // nirsal_agro_geocoop
  await db.insert(schema.nirsalAgroGeocoop).values([
    { tenantId: "tenant-abuja-hq", recordId: "nirsal_a_record_id_1", name: "Godwin Etim", category: "standard", description: "54Bank nirsal_agro_geocoop record 1", status: "completed", region: "Nigeria", reference: "54B-NIRS-422776", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "nirsal_a_record_id_2", name: "Abuja Properties Ltd", category: "premium", description: "54Bank nirsal_agro_geocoop record 2", status: "active", region: "Nigeria", reference: "54B-NIRS-739527", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "nirsal_a_record_id_3", name: "Oluwaseun Ajayi", category: "basic", description: "54Bank nirsal_agro_geocoop record 3", status: "completed", region: "Nigeria", reference: "54B-NIRS-806371", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: nirsal_agro_geocoop");

  // agri_iot_sensor
  await db.insert(schema.agriIotSensor).values([
    { tenantId: "tenant-lagos-main", recordId: "agri_iot_record_id_1", name: "Rashida Bello", category: "basic", description: "54Bank agri_iot_sensor record 1", status: "approved", region: "Nigeria", reference: "54B-AGRI-169832", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "agri_iot_record_id_2", name: "Lagos Agro-Allied Co", category: "standard", description: "54Bank agri_iot_sensor record 2", status: "active", region: "Nigeria", reference: "54B-AGRI-468578", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "agri_iot_record_id_3", name: "Samuel Eze", category: "standard", description: "54Bank agri_iot_sensor record 3", status: "approved", region: "Nigeria", reference: "54B-AGRI-377248", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: agri_iot_sensor");

  // agri_reinsurance
  await db.insert(schema.agriReinsurance).values([
    { tenantId: "tenant-ph-south", recordId: "agri_rei_record_id_1", name: "Ngozi Okafor", category: "premium", description: "54Bank agri_reinsurance record 1", status: "rejected", region: "Nigeria", reference: "54B-AGRI-111911", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "agri_rei_record_id_2", name: "Kano Textiles Ltd", category: "basic", description: "54Bank agri_reinsurance record 2", status: "pending", region: "Nigeria", reference: "54B-AGRI-751167", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "agri_rei_record_id_3", name: "Halima Abdullahi", category: "basic", description: "54Bank agri_reinsurance record 3", status: "completed", region: "Nigeria", reference: "54B-AGRI-690501", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: agri_reinsurance");

  // quality_certification
  await db.insert(schema.qualityCertification).values([
    { tenantId: "tenant-lagos-main", recordId: "quality__record_id_1", name: "Ibrahim Musa", category: "basic", description: "54Bank quality_certification record 1", status: "pending", region: "Nigeria", reference: "54B-QUAL-127842", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "quality__record_id_2", name: "Dangote Industries Ltd", category: "standard", description: "54Bank quality_certification record 2", status: "approved", region: "Nigeria", reference: "54B-QUAL-811245", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "quality__record_id_3", name: "Fatima Hassan", category: "basic", description: "54Bank quality_certification record 3", status: "completed", region: "Nigeria", reference: "54B-QUAL-350108", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: quality_certification");

  // agri_esg_impact
  await db.insert(schema.agriEsgImpact).values([
    { tenantId: "tenant-lagos-main", recordId: "agri_esg_record_id_1", name: "Obinna Chukwu", category: "premium", description: "54Bank agri_esg_impact record 1", status: "inactive", region: "Nigeria", reference: "54B-AGRI-956088", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "agri_esg_record_id_2", name: "Lagos Agro-Allied Co", category: "basic", description: "54Bank agri_esg_impact record 2", status: "active", region: "Nigeria", reference: "54B-AGRI-861152", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "agri_esg_record_id_3", name: "Oluwaseun Ajayi", category: "premium", description: "54Bank agri_esg_impact record 3", status: "completed", region: "Nigeria", reference: "54B-AGRI-316724", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: agri_esg_impact");

  // crossborder_agri_trade
  await db.insert(schema.crossborderAgriTrade).values([
    { tenantId: "tenant-abuja-hq", recordId: "crossbor_record_id_1", name: "Oluwaseun Ajayi", category: "standard", description: "54Bank crossborder_agri_trade record 1", status: "approved", region: "Nigeria", reference: "54B-CROS-122583", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "crossbor_record_id_2", name: "Dangote Industries Ltd", category: "premium", description: "54Bank crossborder_agri_trade record 2", status: "completed", region: "Nigeria", reference: "54B-CROS-742487", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "crossbor_record_id_3", name: "Yetunde Olowe", category: "premium", description: "54Bank crossborder_agri_trade record 3", status: "active", region: "Nigeria", reference: "54B-CROS-805073", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: crossborder_agri_trade");

  // cooperative_meetings
  await db.insert(schema.cooperativeMeetings).values([
    { tenantId: "tenant-kano-north", recordId: "cooperat_record_id_1", name: "Ibrahim Musa", category: "basic", description: "54Bank cooperative_meetings record 1", status: "pending", region: "Nigeria", reference: "54B-COOP-354707", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "cooperat_record_id_2", name: "Kano Textiles Ltd", category: "basic", description: "54Bank cooperative_meetings record 2", status: "approved", region: "Nigeria", reference: "54B-COOP-756704", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "cooperat_record_id_3", name: "Amina Yusuf", category: "standard", description: "54Bank cooperative_meetings record 3", status: "approved", region: "Nigeria", reference: "54B-COOP-383789", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: cooperative_meetings");

  // cooperative_financials
  await db.insert(schema.cooperativeFinancials).values([
    { tenantId: "tenant-lagos-main", recordId: "cooperat_record_id_1", name: "Tunde Bakare", category: "basic", description: "54Bank cooperative_financials record 1", status: "pending", region: "Nigeria", reference: "54B-COOP-304483", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "cooperat_record_id_2", name: "Oando Energy", category: "premium", description: "54Bank cooperative_financials record 2", status: "completed", region: "Nigeria", reference: "54B-COOP-134534", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "cooperat_record_id_3", name: "Samuel Eze", category: "basic", description: "54Bank cooperative_financials record 3", status: "inactive", region: "Nigeria", reference: "54B-COOP-951875", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: cooperative_financials");

  // soil_analysis
  await db.insert(schema.soilAnalysis).values([
    { tenantId: "tenant-ph-south", recordId: "soil_ana_record_id_1", name: "Amina Yusuf", category: "standard", description: "54Bank soil_analysis record 1", status: "completed", region: "Nigeria", reference: "54B-SOIL-432681", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "soil_ana_record_id_2", name: "Oando Energy", category: "standard", description: "54Bank soil_analysis record 2", status: "completed", region: "Nigeria", reference: "54B-SOIL-767671", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "soil_ana_record_id_3", name: "Uchenna Ikenna", category: "basic", description: "54Bank soil_analysis record 3", status: "approved", region: "Nigeria", reference: "54B-SOIL-597956", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: soil_analysis");

  // insurance_portfolio_analytics
  await db.insert(schema.insurancePortfolioAnalytics).values([
    { tenantId: "tenant-ph-south", recordId: "insuranc_record_id_1", name: "Uchenna Ikenna", category: "basic", description: "54Bank insurance_portfolio_analytics record 1", status: "approved", region: "Nigeria", reference: "54B-INSU-185524", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "insuranc_record_id_2", name: "Oando Energy", category: "basic", description: "54Bank insurance_portfolio_analytics record 2", status: "inactive", region: "Nigeria", reference: "54B-INSU-680704", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "insuranc_record_id_3", name: "Amina Yusuf", category: "premium", description: "54Bank insurance_portfolio_analytics record 3", status: "inactive", region: "Nigeria", reference: "54B-INSU-481173", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: insurance_portfolio_analytics");

  // parametric_insurance_iot
  await db.insert(schema.parametricInsuranceIot).values([
    { tenantId: "tenant-ph-south", recordId: "parametr_record_id_1", name: "Oluwaseun Ajayi", category: "premium", description: "54Bank parametric_insurance_iot record 1", status: "completed", region: "Nigeria", reference: "54B-PARA-346537", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "parametr_record_id_2", name: "Oando Energy", category: "standard", description: "54Bank parametric_insurance_iot record 2", status: "active", region: "Nigeria", reference: "54B-PARA-139717", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "parametr_record_id_3", name: "Halima Abdullahi", category: "basic", description: "54Bank parametric_insurance_iot record 3", status: "approved", region: "Nigeria", reference: "54B-PARA-886918", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: parametric_insurance_iot");

  // post_harvest_loss_tracker
  await db.insert(schema.postHarvestLossTracker).values([
    { tenantId: "tenant-abuja-hq", recordId: "post_har_record_id_1", name: "Godwin Etim", category: "standard", description: "54Bank post_harvest_loss_tracker record 1", status: "inactive", region: "Nigeria", reference: "54B-POST-945473", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "post_har_record_id_2", name: "Emeka & Sons Trading", category: "basic", description: "54Bank post_harvest_loss_tracker record 2", status: "completed", region: "Nigeria", reference: "54B-POST-981820", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "post_har_record_id_3", name: "Adewale Ogundimu", category: "standard", description: "54Bank post_harvest_loss_tracker record 3", status: "active", region: "Nigeria", reference: "54B-POST-815588", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: post_harvest_loss_tracker");

  // aggregation_center
  await db.insert(schema.aggregationCenter).values([
    { tenantId: "tenant-abuja-hq", recordId: "aggregat_record_id_1", name: "Kemi Adeyemi", category: "basic", description: "54Bank aggregation_center record 1", status: "rejected", region: "Nigeria", reference: "54B-AGGR-801099", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "aggregat_record_id_2", name: "Oando Energy", category: "basic", description: "54Bank aggregation_center record 2", status: "approved", region: "Nigeria", reference: "54B-AGGR-448830", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "aggregat_record_id_3", name: "Rashida Bello", category: "premium", description: "54Bank aggregation_center record 3", status: "inactive", region: "Nigeria", reference: "54B-AGGR-557088", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: aggregation_center");

  // cbn_agsmeis
  await db.insert(schema.cbnAgsmeis).values([
    { tenantId: "tenant-kano-north", recordId: "cbn_agsm_record_id_1", name: "Samuel Eze", category: "standard", description: "54Bank cbn_agsmeis record 1", status: "inactive", region: "Nigeria", reference: "54B-CBN_-506576", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "cbn_agsm_record_id_2", name: "Lagos Agro-Allied Co", category: "premium", description: "54Bank cbn_agsmeis record 2", status: "active", region: "Nigeria", reference: "54B-CBN_-839276", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "cbn_agsm_record_id_3", name: "Uchenna Ikenna", category: "basic", description: "54Bank cbn_agsmeis record 3", status: "rejected", region: "Nigeria", reference: "54B-CBN_-778094", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: cbn_agsmeis");

  // acgsf_guarantee
  await db.insert(schema.acgsfGuarantee).values([
    { tenantId: "tenant-lagos-main", recordId: "acgsf_gu_record_id_1", name: "Aisha Mohammed", category: "basic", description: "54Bank acgsf_guarantee record 1", status: "pending", region: "Nigeria", reference: "54B-ACGS-245584", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "acgsf_gu_record_id_2", name: "Dangote Industries Ltd", category: "premium", description: "54Bank acgsf_guarantee record 2", status: "completed", region: "Nigeria", reference: "54B-ACGS-851586", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "acgsf_gu_record_id_3", name: "Amina Yusuf", category: "basic", description: "54Bank acgsf_guarantee record 3", status: "active", region: "Nigeria", reference: "54B-ACGS-111073", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: acgsf_guarantee");

  // voice_banking_gateway
  await db.insert(schema.voiceBankingGateway).values([
    { tenantId: "tenant-ph-south", recordId: "voice_ba_record_id_1", name: "Oluwaseun Ajayi", category: "standard", description: "54Bank voice_banking_gateway record 1", status: "pending", channel: "voice_banking_gateway_channel_1", msisdn: "voice_banking_gateway_msisdn_1", sessionId: "voice_ba_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "voice_ba_record_id_2", name: "Kano Textiles Ltd", category: "premium", description: "54Bank voice_banking_gateway record 2", status: "pending", channel: "voice_banking_gateway_channel_2", msisdn: "voice_banking_gateway_msisdn_2", sessionId: "voice_ba_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "voice_ba_record_id_3", name: "Aisha Mohammed", category: "basic", description: "54Bank voice_banking_gateway record 3", status: "inactive", channel: "voice_banking_gateway_channel_3", msisdn: "voice_banking_gateway_msisdn_3", sessionId: "voice_ba_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: voice_banking_gateway");

  // voice_tts_nigerian
  await db.insert(schema.voiceTtsNigerian).values([
    { tenantId: "tenant-lagos-main", recordId: "voice_tt_record_id_1", name: "Rashida Bello", category: "premium", description: "54Bank voice_tts_nigerian record 1", status: "active", channel: "voice_tts_nigerian_channel_1", msisdn: "voice_tts_nigerian_msisdn_1", sessionId: "voice_tt_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "voice_tt_record_id_2", name: "Emeka & Sons Trading", category: "basic", description: "54Bank voice_tts_nigerian record 2", status: "rejected", channel: "voice_tts_nigerian_channel_2", msisdn: "voice_tts_nigerian_msisdn_2", sessionId: "voice_tt_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "voice_tt_record_id_3", name: "Yetunde Olowe", category: "premium", description: "54Bank voice_tts_nigerian record 3", status: "approved", channel: "voice_tts_nigerian_channel_3", msisdn: "voice_tts_nigerian_msisdn_3", sessionId: "voice_tt_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: voice_tts_nigerian");

  // voice_asr_nigerian
  await db.insert(schema.voiceAsrNigerian).values([
    { tenantId: "tenant-kano-north", recordId: "voice_as_record_id_1", name: "Rashida Bello", category: "premium", description: "54Bank voice_asr_nigerian record 1", status: "completed", channel: "voice_asr_nigerian_channel_1", msisdn: "voice_asr_nigerian_msisdn_1", sessionId: "voice_as_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "voice_as_record_id_2", name: "Kano Textiles Ltd", category: "premium", description: "54Bank voice_asr_nigerian record 2", status: "pending", channel: "voice_asr_nigerian_channel_2", msisdn: "voice_asr_nigerian_msisdn_2", sessionId: "voice_as_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "voice_as_record_id_3", name: "Ngozi Okafor", category: "premium", description: "54Bank voice_asr_nigerian record 3", status: "pending", channel: "voice_asr_nigerian_channel_3", msisdn: "voice_asr_nigerian_msisdn_3", sessionId: "voice_as_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: voice_asr_nigerian");

  // voice_nlu_banking
  await db.insert(schema.voiceNluBanking).values([
    { tenantId: "tenant-abuja-hq", recordId: "voice_nl_record_id_1", name: "Folake Adeniyi", category: "premium", description: "54Bank voice_nlu_banking record 1", status: "pending", channel: "voice_nlu_banking_channel_1", msisdn: "voice_nlu_banking_msisdn_1", sessionId: "voice_nl_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "voice_nl_record_id_2", name: "Dangote Industries Ltd", category: "standard", description: "54Bank voice_nlu_banking record 2", status: "completed", channel: "voice_nlu_banking_channel_2", msisdn: "voice_nlu_banking_msisdn_2", sessionId: "voice_nl_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "voice_nl_record_id_3", name: "Yetunde Olowe", category: "standard", description: "54Bank voice_nlu_banking record 3", status: "pending", channel: "voice_nlu_banking_channel_3", msisdn: "voice_nlu_banking_msisdn_3", sessionId: "voice_nl_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: voice_nlu_banking");

  // voice_biometric_auth
  await db.insert(schema.voiceBiometricAuth).values([
    { tenantId: "tenant-ph-south", recordId: "voice_bi_record_id_1", name: "Oluwaseun Ajayi", category: "standard", description: "54Bank voice_biometric_auth record 1", status: "approved", channel: "voice_biometric_auth_channel_1", msisdn: "voice_biometric_auth_msisdn_1", sessionId: "voice_bi_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "voice_bi_record_id_2", name: "Emeka & Sons Trading", category: "standard", description: "54Bank voice_biometric_auth record 2", status: "completed", channel: "voice_biometric_auth_channel_2", msisdn: "voice_biometric_auth_msisdn_2", sessionId: "voice_bi_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "voice_bi_record_id_3", name: "Oluwaseun Ajayi", category: "standard", description: "54Bank voice_biometric_auth record 3", status: "active", channel: "voice_biometric_auth_channel_3", msisdn: "voice_biometric_auth_msisdn_3", sessionId: "voice_bi_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: voice_biometric_auth");

  // voice_ivr_menu
  await db.insert(schema.voiceIvrMenu).values([
    { tenantId: "tenant-abuja-hq", recordId: "voice_iv_record_id_1", name: "Samuel Eze", category: "basic", description: "54Bank voice_ivr_menu record 1", status: "inactive", channel: "voice_ivr_menu_channel_1", msisdn: "voice_ivr_menu_msisdn_1", sessionId: "voice_iv_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "voice_iv_record_id_2", name: "Kano Textiles Ltd", category: "standard", description: "54Bank voice_ivr_menu record 2", status: "inactive", channel: "voice_ivr_menu_channel_2", msisdn: "voice_ivr_menu_msisdn_2", sessionId: "voice_iv_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "voice_iv_record_id_3", name: "Ibrahim Musa", category: "basic", description: "54Bank voice_ivr_menu record 3", status: "active", channel: "voice_ivr_menu_channel_3", msisdn: "voice_ivr_menu_msisdn_3", sessionId: "voice_iv_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: voice_ivr_menu");

  // voice_call_analytics
  await db.insert(schema.voiceCallAnalytics).values([
    { tenantId: "tenant-abuja-hq", recordId: "voice_ca_record_id_1", name: "Chidi Obi", category: "premium", description: "54Bank voice_call_analytics record 1", status: "pending", channel: "voice_call_analytics_channel_1", msisdn: "voice_call_analytics_msisdn_1", sessionId: "voice_ca_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "voice_ca_record_id_2", name: "Abuja Properties Ltd", category: "basic", description: "54Bank voice_call_analytics record 2", status: "active", channel: "voice_call_analytics_channel_2", msisdn: "voice_call_analytics_msisdn_2", sessionId: "voice_ca_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "voice_ca_record_id_3", name: "Aisha Mohammed", category: "basic", description: "54Bank voice_call_analytics record 3", status: "inactive", channel: "voice_call_analytics_channel_3", msisdn: "voice_call_analytics_msisdn_3", sessionId: "voice_ca_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: voice_call_analytics");

  // voice_agent_escalation
  await db.insert(schema.voiceAgentEscalation).values([
    { tenantId: "tenant-ph-south", recordId: "voice_ag_record_id_1", name: "Oluwaseun Ajayi", category: "basic", description: "54Bank voice_agent_escalation record 1", status: "completed", channel: "voice_agent_escalation_channel_1", msisdn: "voice_agent_escalation_msisdn_1", sessionId: "voice_ag_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "voice_ag_record_id_2", name: "Dangote Industries Ltd", category: "standard", description: "54Bank voice_agent_escalation record 2", status: "active", channel: "voice_agent_escalation_channel_2", msisdn: "voice_agent_escalation_msisdn_2", sessionId: "voice_ag_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "voice_ag_record_id_3", name: "Oluwaseun Ajayi", category: "premium", description: "54Bank voice_agent_escalation record 3", status: "active", channel: "voice_agent_escalation_channel_3", msisdn: "voice_agent_escalation_msisdn_3", sessionId: "voice_ag_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: voice_agent_escalation");

  // telegram_bot_gateway
  await db.insert(schema.telegramBotGateway).values([
    { tenantId: "tenant-lagos-main", recordId: "telegram_record_id_1", name: "Tunde Bakare", category: "standard", description: "54Bank telegram_bot_gateway record 1", status: "inactive", channel: "telegram_bot_gateway_channel_1", msisdn: "telegram_bot_gateway_msisdn_1", sessionId: "telegram_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "telegram_record_id_2", name: "Oando Energy", category: "basic", description: "54Bank telegram_bot_gateway record 2", status: "inactive", channel: "telegram_bot_gateway_channel_2", msisdn: "telegram_bot_gateway_msisdn_2", sessionId: "telegram_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "telegram_record_id_3", name: "Uchenna Ikenna", category: "standard", description: "54Bank telegram_bot_gateway record 3", status: "rejected", channel: "telegram_bot_gateway_channel_3", msisdn: "telegram_bot_gateway_msisdn_3", sessionId: "telegram_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: telegram_bot_gateway");

  // telegram_banking_commands
  await db.insert(schema.telegramBankingCommands).values([
    { tenantId: "tenant-kano-north", recordId: "telegram_record_id_1", name: "Godwin Etim", category: "premium", description: "54Bank telegram_banking_commands record 1", status: "rejected", channel: "telegram_banking_commands_channel_1", msisdn: "telegram_banking_commands_msisdn_1", sessionId: "telegram_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "telegram_record_id_2", name: "Oando Energy", category: "basic", description: "54Bank telegram_banking_commands record 2", status: "active", channel: "telegram_banking_commands_channel_2", msisdn: "telegram_banking_commands_msisdn_2", sessionId: "telegram_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "telegram_record_id_3", name: "Ibrahim Musa", category: "standard", description: "54Bank telegram_banking_commands record 3", status: "pending", channel: "telegram_banking_commands_channel_3", msisdn: "telegram_banking_commands_msisdn_3", sessionId: "telegram_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: telegram_banking_commands");

  // telegram_notification
  await db.insert(schema.telegramNotification).values([
    { tenantId: "tenant-ph-south", recordId: "telegram_record_id_1", name: "Godwin Etim", category: "premium", description: "54Bank telegram_notification record 1", status: "approved", channel: "telegram_notification_channel_1", msisdn: "telegram_notification_msisdn_1", sessionId: "telegram_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "telegram_record_id_2", name: "Abuja Properties Ltd", category: "basic", description: "54Bank telegram_notification record 2", status: "inactive", channel: "telegram_notification_channel_2", msisdn: "telegram_notification_msisdn_2", sessionId: "telegram_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "telegram_record_id_3", name: "Adewale Ogundimu", category: "basic", description: "54Bank telegram_notification record 3", status: "completed", channel: "telegram_notification_channel_3", msisdn: "telegram_notification_msisdn_3", sessionId: "telegram_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: telegram_notification");

  // telegram_mini_app
  await db.insert(schema.telegramMiniApp).values([
    { tenantId: "tenant-abuja-hq", recordId: "telegram_record_id_1", name: "Rashida Bello", category: "premium", description: "54Bank telegram_mini_app record 1", status: "active", channel: "telegram_mini_app_channel_1", msisdn: "telegram_mini_app_msisdn_1", sessionId: "telegram_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "telegram_record_id_2", name: "Emeka & Sons Trading", category: "basic", description: "54Bank telegram_mini_app record 2", status: "pending", channel: "telegram_mini_app_channel_2", msisdn: "telegram_mini_app_msisdn_2", sessionId: "telegram_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "telegram_record_id_3", name: "Aisha Mohammed", category: "premium", description: "54Bank telegram_mini_app record 3", status: "completed", channel: "telegram_mini_app_channel_3", msisdn: "telegram_mini_app_msisdn_3", sessionId: "telegram_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: telegram_mini_app");

  // telegram_kyc_bot
  await db.insert(schema.telegramKycBot).values([
    { tenantId: "tenant-ph-south", recordId: "telegram_record_id_1", name: "Samuel Eze", category: "premium", description: "54Bank telegram_kyc_bot record 1", status: "rejected", channel: "telegram_kyc_bot_channel_1", msisdn: "telegram_kyc_bot_msisdn_1", sessionId: "telegram_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "telegram_record_id_2", name: "Kano Textiles Ltd", category: "standard", description: "54Bank telegram_kyc_bot record 2", status: "pending", channel: "telegram_kyc_bot_channel_2", msisdn: "telegram_kyc_bot_msisdn_2", sessionId: "telegram_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "telegram_record_id_3", name: "Ngozi Okafor", category: "premium", description: "54Bank telegram_kyc_bot record 3", status: "completed", channel: "telegram_kyc_bot_channel_3", msisdn: "telegram_kyc_bot_msisdn_3", sessionId: "telegram_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: telegram_kyc_bot");

  // whatsapp_business_gateway
  await db.insert(schema.whatsappBusinessGateway).values([
    { tenantId: "tenant-lagos-main", recordId: "whatsapp_record_id_1", name: "Obinna Chukwu", category: "basic", description: "54Bank whatsapp_business_gateway record 1", status: "inactive", channel: "whatsapp_business_gateway_channel_1", msisdn: "whatsapp_business_gateway_msisdn_1", sessionId: "whatsapp_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "whatsapp_record_id_2", name: "Abuja Properties Ltd", category: "standard", description: "54Bank whatsapp_business_gateway record 2", status: "active", channel: "whatsapp_business_gateway_channel_2", msisdn: "whatsapp_business_gateway_msisdn_2", sessionId: "whatsapp_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "whatsapp_record_id_3", name: "Samuel Eze", category: "basic", description: "54Bank whatsapp_business_gateway record 3", status: "active", channel: "whatsapp_business_gateway_channel_3", msisdn: "whatsapp_business_gateway_msisdn_3", sessionId: "whatsapp_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: whatsapp_business_gateway");

  // whatsapp_banking_flows
  await db.insert(schema.whatsappBankingFlows).values([
    { tenantId: "tenant-lagos-main", recordId: "whatsapp_record_id_1", name: "Godwin Etim", category: "premium", description: "54Bank whatsapp_banking_flows record 1", status: "active", channel: "whatsapp_banking_flows_channel_1", msisdn: "whatsapp_banking_flows_msisdn_1", sessionId: "whatsapp_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "whatsapp_record_id_2", name: "Dangote Industries Ltd", category: "standard", description: "54Bank whatsapp_banking_flows record 2", status: "rejected", channel: "whatsapp_banking_flows_channel_2", msisdn: "whatsapp_banking_flows_msisdn_2", sessionId: "whatsapp_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "whatsapp_record_id_3", name: "Yetunde Olowe", category: "premium", description: "54Bank whatsapp_banking_flows record 3", status: "rejected", channel: "whatsapp_banking_flows_channel_3", msisdn: "whatsapp_banking_flows_msisdn_3", sessionId: "whatsapp_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: whatsapp_banking_flows");

  // whatsapp_payment_integration
  await db.insert(schema.whatsappPaymentIntegration).values([
    { tenantId: "tenant-ph-south", recordId: "whatsapp_record_id_1", name: "Rashida Bello", category: "basic", description: "54Bank whatsapp_payment_integration record 1", status: "pending", channel: "whatsapp_payment_integration_channel_1", msisdn: "whatsapp_payment_integration_msisdn_1", sessionId: "whatsapp_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "whatsapp_record_id_2", name: "Oando Energy", category: "standard", description: "54Bank whatsapp_payment_integration record 2", status: "rejected", channel: "whatsapp_payment_integration_channel_2", msisdn: "whatsapp_payment_integration_msisdn_2", sessionId: "whatsapp_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "whatsapp_record_id_3", name: "Tunde Bakare", category: "standard", description: "54Bank whatsapp_payment_integration record 3", status: "active", channel: "whatsapp_payment_integration_channel_3", msisdn: "whatsapp_payment_integration_msisdn_3", sessionId: "whatsapp_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: whatsapp_payment_integration");

  // whatsapp_notification
  await db.insert(schema.whatsappNotification).values([
    { tenantId: "tenant-lagos-main", recordId: "whatsapp_record_id_1", name: "Rashida Bello", category: "premium", description: "54Bank whatsapp_notification record 1", status: "rejected", channel: "whatsapp_notification_channel_1", msisdn: "whatsapp_notification_msisdn_1", sessionId: "whatsapp_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "whatsapp_record_id_2", name: "Lagos Agro-Allied Co", category: "standard", description: "54Bank whatsapp_notification record 2", status: "active", channel: "whatsapp_notification_channel_2", msisdn: "whatsapp_notification_msisdn_2", sessionId: "whatsapp_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "whatsapp_record_id_3", name: "Obinna Chukwu", category: "basic", description: "54Bank whatsapp_notification record 3", status: "active", channel: "whatsapp_notification_channel_3", msisdn: "whatsapp_notification_msisdn_3", sessionId: "whatsapp_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: whatsapp_notification");

  // whatsapp_document_service
  await db.insert(schema.whatsappDocumentService).values([
    { tenantId: "tenant-ph-south", recordId: "whatsapp_record_id_1", name: "Obinna Chukwu", category: "standard", description: "54Bank whatsapp_document_service record 1", status: "completed", channel: "whatsapp_document_service_channel_1", msisdn: "whatsapp_document_service_msisdn_1", sessionId: "whatsapp_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "whatsapp_record_id_2", name: "Dangote Industries Ltd", category: "standard", description: "54Bank whatsapp_document_service record 2", status: "completed", channel: "whatsapp_document_service_channel_2", msisdn: "whatsapp_document_service_msisdn_2", sessionId: "whatsapp_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "whatsapp_record_id_3", name: "Ngozi Okafor", category: "premium", description: "54Bank whatsapp_document_service record 3", status: "approved", channel: "whatsapp_document_service_channel_3", msisdn: "whatsapp_document_service_msisdn_3", sessionId: "whatsapp_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: whatsapp_document_service");

  // ussd_banking_gateway
  await db.insert(schema.ussdBankingGateway).values([
    { tenantId: "tenant-ph-south", recordId: "ussd_ban_record_id_1", name: "Rashida Bello", category: "premium", description: "54Bank ussd_banking_gateway record 1", status: "pending", channel: "ussd_banking_gateway_channel_1", msisdn: "ussd_banking_gateway_msisdn_1", sessionId: "ussd_ban_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "ussd_ban_record_id_2", name: "Kano Textiles Ltd", category: "standard", description: "54Bank ussd_banking_gateway record 2", status: "active", channel: "ussd_banking_gateway_channel_2", msisdn: "ussd_banking_gateway_msisdn_2", sessionId: "ussd_ban_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "ussd_ban_record_id_3", name: "Ngozi Okafor", category: "basic", description: "54Bank ussd_banking_gateway record 3", status: "pending", channel: "ussd_banking_gateway_channel_3", msisdn: "ussd_banking_gateway_msisdn_3", sessionId: "ussd_ban_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: ussd_banking_gateway");

  // ussd_transaction_engine
  await db.insert(schema.ussdTransactionEngine).values([
    { tenantId: "tenant-ph-south", recordId: "ussd_tra_record_id_1", name: "Amina Yusuf", category: "basic", description: "54Bank ussd_transaction_engine record 1", status: "approved", channel: "ussd_transaction_engine_channel_1", msisdn: "ussd_transaction_engine_msisdn_1", sessionId: "ussd_tra_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "ussd_tra_record_id_2", name: "Kano Textiles Ltd", category: "standard", description: "54Bank ussd_transaction_engine record 2", status: "completed", channel: "ussd_transaction_engine_channel_2", msisdn: "ussd_transaction_engine_msisdn_2", sessionId: "ussd_tra_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "ussd_tra_record_id_3", name: "Halima Abdullahi", category: "premium", description: "54Bank ussd_transaction_engine record 3", status: "active", channel: "ussd_transaction_engine_channel_3", msisdn: "ussd_transaction_engine_msisdn_3", sessionId: "ussd_tra_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: ussd_transaction_engine");

  // ussd_multilingual
  await db.insert(schema.ussdMultilingual).values([
    { tenantId: "tenant-kano-north", recordId: "ussd_mul_record_id_1", name: "Oluwaseun Ajayi", category: "premium", description: "54Bank ussd_multilingual record 1", status: "inactive", channel: "ussd_multilingual_channel_1", msisdn: "ussd_multilingual_msisdn_1", sessionId: "ussd_mul_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "ussd_mul_record_id_2", name: "Dangote Industries Ltd", category: "standard", description: "54Bank ussd_multilingual record 2", status: "inactive", channel: "ussd_multilingual_channel_2", msisdn: "ussd_multilingual_msisdn_2", sessionId: "ussd_mul_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-ph-south", recordId: "ussd_mul_record_id_3", name: "Uchenna Ikenna", category: "standard", description: "54Bank ussd_multilingual record 3", status: "pending", channel: "ussd_multilingual_channel_3", msisdn: "ussd_multilingual_msisdn_3", sessionId: "ussd_mul_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: ussd_multilingual");

  // ussd_sim_toolkit
  await db.insert(schema.ussdSimToolkit).values([
    { tenantId: "tenant-ph-south", recordId: "ussd_sim_record_id_1", name: "Amina Yusuf", category: "standard", description: "54Bank ussd_sim_toolkit record 1", status: "pending", channel: "ussd_sim_toolkit_channel_1", msisdn: "ussd_sim_toolkit_msisdn_1", sessionId: "ussd_sim_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "ussd_sim_record_id_2", name: "Kano Textiles Ltd", category: "standard", description: "54Bank ussd_sim_toolkit record 2", status: "active", channel: "ussd_sim_toolkit_channel_2", msisdn: "ussd_sim_toolkit_msisdn_2", sessionId: "ussd_sim_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "ussd_sim_record_id_3", name: "Samuel Eze", category: "premium", description: "54Bank ussd_sim_toolkit record 3", status: "completed", channel: "ussd_sim_toolkit_channel_3", msisdn: "ussd_sim_toolkit_msisdn_3", sessionId: "ussd_sim_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: ussd_sim_toolkit");

  // sms_banking_gateway
  await db.insert(schema.smsBankingGateway).values([
    { tenantId: "tenant-ph-south", recordId: "sms_bank_record_id_1", name: "Yetunde Olowe", category: "basic", description: "54Bank sms_banking_gateway record 1", status: "pending", channel: "sms_banking_gateway_channel_1", msisdn: "sms_banking_gateway_msisdn_1", sessionId: "sms_bank_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "sms_bank_record_id_2", name: "Kano Textiles Ltd", category: "premium", description: "54Bank sms_banking_gateway record 2", status: "approved", channel: "sms_banking_gateway_channel_2", msisdn: "sms_banking_gateway_msisdn_2", sessionId: "sms_bank_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "sms_bank_record_id_3", name: "Samuel Eze", category: "basic", description: "54Bank sms_banking_gateway record 3", status: "rejected", channel: "sms_banking_gateway_channel_3", msisdn: "sms_banking_gateway_msisdn_3", sessionId: "sms_bank_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: sms_banking_gateway");

  // sms_otp_service
  await db.insert(schema.smsOtpService).values([
    { tenantId: "tenant-ph-south", recordId: "sms_otp__record_id_1", name: "Ibrahim Musa", category: "basic", description: "54Bank sms_otp_service record 1", status: "approved", channel: "sms_otp_service_channel_1", msisdn: "sms_otp_service_msisdn_1", sessionId: "sms_otp__session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-lagos-main", recordId: "sms_otp__record_id_2", name: "Dangote Industries Ltd", category: "premium", description: "54Bank sms_otp_service record 2", status: "completed", channel: "sms_otp_service_channel_2", msisdn: "sms_otp_service_msisdn_2", sessionId: "sms_otp__session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "sms_otp__record_id_3", name: "Samuel Eze", category: "standard", description: "54Bank sms_otp_service record 3", status: "pending", channel: "sms_otp_service_channel_3", msisdn: "sms_otp_service_msisdn_3", sessionId: "sms_otp__session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: sms_otp_service");

  // sms_alert_notification
  await db.insert(schema.smsAlertNotification).values([
    { tenantId: "tenant-abuja-hq", recordId: "sms_aler_record_id_1", name: "Fatima Hassan", category: "standard", description: "54Bank sms_alert_notification record 1", status: "inactive", channel: "sms_alert_notification_channel_1", msisdn: "sms_alert_notification_msisdn_1", sessionId: "sms_aler_session_id_1", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-abuja-hq", recordId: "sms_aler_record_id_2", name: "Abuja Properties Ltd", category: "premium", description: "54Bank sms_alert_notification record 2", status: "rejected", channel: "sms_alert_notification_channel_2", msisdn: "sms_alert_notification_msisdn_2", sessionId: "sms_aler_session_id_2", metadata: {"region": "west_africa", "currency": "NGN"} },
    { tenantId: "tenant-kano-north", recordId: "sms_aler_record_id_3", name: "Fatima Hassan", category: "basic", description: "54Bank sms_alert_notification record 3", status: "approved", channel: "sms_alert_notification_channel_3", msisdn: "sms_alert_notification_msisdn_3", sessionId: "sms_aler_session_id_3", metadata: {"region": "west_africa", "currency": "NGN"} },
  ]).onConflictDoNothing();
  console.log("  seeded: sms_alert_notification");

  // ─── KPI PERSONNEL FRAMEWORK ──────────────────────────────────────────────
  await db.insert(schema.kpiRoles).values([
    { roleKey: "ceo", title: "Chief Executive Officer", department: "Executive", level: 1, reportsTo: null, fixedRatio: 60, variableRatio: 40, description: "Strategic oversight" },
    { roleKey: "coo", title: "Chief Operating Officer", department: "Operations", level: 2, reportsTo: "ceo", fixedRatio: 70, variableRatio: 30, description: "Operations throughput" },
    { roleKey: "cro", title: "Chief Risk Officer", department: "Risk", level: 2, reportsTo: "ceo", fixedRatio: 75, variableRatio: 25, description: "AML/CFT compliance" },
    { roleKey: "cto", title: "Chief Technology Officer", department: "Technology", level: 2, reportsTo: "ceo", fixedRatio: 70, variableRatio: 30, description: "Platform availability" },
    { roleKey: "cso", title: "Chief Security Officer", department: "Security", level: 2, reportsTo: "ceo", fixedRatio: 75, variableRatio: 25, description: "Cyber security" },
    { roleKey: "treasury", title: "Treasury Manager", department: "Treasury", level: 3, reportsTo: "ceo", fixedRatio: 70, variableRatio: 30, description: "Liquidity management" },
    { roleKey: "credit", title: "Head of Credit", department: "Lending", level: 3, reportsTo: "ceo", fixedRatio: 65, variableRatio: 35, description: "Portfolio quality" },
    { roleKey: "head_teller", title: "Head Teller", department: "Operations", level: 3, reportsTo: "coo", fixedRatio: 60, variableRatio: 40, description: "Transaction speed" },
    { roleKey: "compliance", title: "Compliance Officer", department: "Risk", level: 3, reportsTo: "cro", fixedRatio: 80, variableRatio: 20, description: "Regulatory filings" },
    { roleKey: "customer_service", title: "Customer Service Manager", department: "Service", level: 3, reportsTo: "ceo", fixedRatio: 65, variableRatio: 35, description: "Complaint resolution" },
    { roleKey: "internal_audit", title: "Internal Auditor", department: "Audit", level: 3, reportsTo: "cro", fixedRatio: 80, variableRatio: 20, description: "Maker-checker compliance" },
  ]).onConflictDoNothing();
  console.log("  seeded: kpi_roles");

  await db.insert(schema.kpiBranches).values([
    { branchId: "BR-001", name: "Lagos Island Main", state: "Lagos", lga: "Lagos Island", latitude: 6.4541, longitude: 3.4082, revenueNgn: 850000000, transactionsDaily: 2400, customers: 15200, nplPct: 2.1, depositsNgn: 12500000000, status: "green" },
    { branchId: "BR-002", name: "Victoria Island", state: "Lagos", lga: "Eti-Osa", latitude: 6.4281, longitude: 3.4219, revenueNgn: 1200000000, transactionsDaily: 3100, customers: 18500, nplPct: 1.8, depositsNgn: 18000000000, status: "green" },
    { branchId: "BR-005", name: "Abuja Central", state: "FCT", lga: "Municipal", latitude: 9.0579, longitude: 7.4951, revenueNgn: 780000000, transactionsDaily: 2000, customers: 11000, nplPct: 2.8, depositsNgn: 10500000000, status: "green" },
  ]).onConflictDoNothing();
  console.log("  seeded: kpi_branches");

  console.log("Done! Seeded 275 tables.");
  await client.end();
}

seed().catch((e) => { console.error("Seed failed:", e); process.exit(1); });
