/**
 * Drizzle ORM Relations — 54Bank Platform
 *
 * Defines all entity relationships across the platform schema.
 * These power the Drizzle relational query API:
 *   db.query.customers.findMany({ with: { cards: true, transfers: true } })
 *
 * Relationship taxonomy:
 *   one()  → belongs-to (many-to-one)
 *   many() → has-many (one-to-many)
 */
import { relations } from "drizzle-orm";
import {
  users,
  tenants,
  tenantFeatureFlags,
  customers,
  customerCards,
  customerCardEvents,
  customerSavedBillers,
  customerBillPayments,
  customerTransfers,
  customerApprovals,
  customerStatementExports,
  customerStatements,
  customerNotifications,
  customerSessionPreferences,
  accounts,
  transactions,
  loans,
  loanRepayments,
  kycVerifications,
  amlAlerts,
  auditEntries,
  exportJobs,
  workflowCases,
  billingAccounts,
  billingRateCards,
  billingRateCardLines,
  billingUsageEvents,
  billingRatedEvents,
  billingAccrualSnapshots,
  billingContractOverrides,
  billingDiscountRules,
  billingRevenueShareRules,
  billingInvoices,
  billingInvoiceLines,
  billingInvoiceApprovals,
  escrowAccounts,
  escrowParties,
  escrowTransactions,
  escrowMilestones,
  escrowDisputes,
  escrowDocuments,
  escrowFees,
  escrowInterestAccruals,
  escrowAuditLog,
  daprPublishedEvents,
  daprStateOperations,
  daprServiceInvocations,
  daprSubscriptions,
  temporalWorkflowExecutions,
  temporalActivityLog,
  temporalSagaCompensations,
  fluvioTopics,
  fluvioEventLog,
  fluvioEventOutbox,
  fluvioConsumerGroups,
  redisRateLimitLog,
  openappsecWafEvents,
  openappsecLearningData,
} from "./schema";

// ── Tenants ──────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  featureFlags: many(tenantFeatureFlags),
  customers: many(customers),
  billingAccounts: many(billingAccounts),
  accounts: many(accounts),
  loans: many(loans),
  kycVerifications: many(kycVerifications),
  amlAlerts: many(amlAlerts),
  daprPublishedEvents: many(daprPublishedEvents),
  fluvioEventLog: many(fluvioEventLog),
  temporalWorkflowExecutions: many(temporalWorkflowExecutions),
}));

export const tenantFeatureFlagsRelations = relations(tenantFeatureFlags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantFeatureFlags.tenantId],
    references: [tenants.tenantId],
  }),
}));

// ── Customers ────────────────────────────────────────────────────────────────

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.tenantId],
  }),
  cards: many(customerCards),
  cardEvents: many(customerCardEvents),
  savedBillers: many(customerSavedBillers),
  billPayments: many(customerBillPayments),
  transfers: many(customerTransfers),
  approvals: many(customerApprovals),
  statementExports: many(customerStatementExports),
  statements: many(customerStatements),
  notifications: many(customerNotifications),
  sessionPreferences: many(customerSessionPreferences),
  accounts: many(accounts),
  loans: many(loans),
  kycVerifications: many(kycVerifications),
  amlAlerts: many(amlAlerts),
}));

export const customerCardsRelations = relations(customerCards, ({ one, many }) => ({
  customer: one(customers, {
    fields: [customerCards.customerId],
    references: [customers.customerId],
  }),
  events: many(customerCardEvents),
}));

export const customerCardEventsRelations = relations(customerCardEvents, ({ one }) => ({
  card: one(customerCards, {
    fields: [customerCardEvents.cardId],
    references: [customerCards.cardId],
  }),
  customer: one(customers, {
    fields: [customerCardEvents.customerId],
    references: [customers.customerId],
  }),
}));

export const customerSavedBillersRelations = relations(customerSavedBillers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [customerSavedBillers.customerId],
    references: [customers.customerId],
  }),
  payments: many(customerBillPayments),
}));

export const customerBillPaymentsRelations = relations(customerBillPayments, ({ one }) => ({
  customer: one(customers, {
    fields: [customerBillPayments.customerId],
    references: [customers.customerId],
  }),
}));

export const customerTransfersRelations = relations(customerTransfers, ({ one }) => ({
  customer: one(customers, {
    fields: [customerTransfers.customerId],
    references: [customers.customerId],
  }),
}));

export const customerApprovalsRelations = relations(customerApprovals, ({ one }) => ({
  customer: one(customers, {
    fields: [customerApprovals.customerId],
    references: [customers.customerId],
  }),
}));

export const customerStatementExportsRelations = relations(customerStatementExports, ({ one }) => ({
  customer: one(customers, {
    fields: [customerStatementExports.customerId],
    references: [customers.customerId],
  }),
  exportJob: one(exportJobs, {
    fields: [customerStatementExports.exportJobId],
    references: [exportJobs.exportJobId],
  }),
}));

export const customerStatementsRelations = relations(customerStatements, ({ one }) => ({
  customer: one(customers, {
    fields: [customerStatements.customerId],
    references: [customers.customerId],
  }),
}));

export const customerNotificationsRelations = relations(customerNotifications, ({ one }) => ({
  customer: one(customers, {
    fields: [customerNotifications.customerId],
    references: [customers.customerId],
  }),
}));

export const customerSessionPreferencesRelations = relations(customerSessionPreferences, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customerSessionPreferences.tenantId],
    references: [tenants.tenantId],
  }),
}));

// ── Accounts & Transactions ───────────────────────────────────────────────────

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  customer: one(customers, {
    fields: [accounts.customerId],
    references: [customers.customerId],
  }),
  tenant: one(tenants, {
    fields: [accounts.tenantId],
    references: [tenants.tenantId],
  }),
  transactions: many(transactions),
  loans: many(loans),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.accountId],
  }),
  tenant: one(tenants, {
    fields: [transactions.tenantId],
    references: [tenants.tenantId],
  }),
}));

// ── Loans ────────────────────────────────────────────────────────────────────

export const loansRelations = relations(loans, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loans.customerId],
    references: [customers.customerId],
  }),
  tenant: one(tenants, {
    fields: [loans.tenantId],
    references: [tenants.tenantId],
  }),
  repayments: many(loanRepayments),
}));

export const loanRepaymentsRelations = relations(loanRepayments, ({ one }) => ({
  loan: one(loans, {
    fields: [loanRepayments.loanId],
    references: [loans.loanId],
  }),
}));

// ── KYC / AML ────────────────────────────────────────────────────────────────

export const kycVerificationsRelations = relations(kycVerifications, ({ one }) => ({
  customer: one(customers, {
    fields: [kycVerifications.customerId],
    references: [customers.customerId],
  }),
  tenant: one(tenants, {
    fields: [kycVerifications.tenantId],
    references: [tenants.tenantId],
  }),
}));

export const amlAlertsRelations = relations(amlAlerts, ({ one }) => ({
  customer: one(customers, {
    fields: [amlAlerts.customerId],
    references: [customers.customerId],
  }),
  tenant: one(tenants, {
    fields: [amlAlerts.tenantId],
    references: [tenants.tenantId],
  }),
}));

// ── Audit & Workflows ────────────────────────────────────────────────────────

export const auditEntriesRelations = relations(auditEntries, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditEntries.tenantId],
    references: [tenants.tenantId],
  }),
}));

export const customerStatementExportsJobRelations = relations(exportJobs, ({ many }) => ({
  statementExports: many(customerStatementExports),
}));

// ── Billing ───────────────────────────────────────────────────────────────────

export const billingAccountsRelations = relations(billingAccounts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [billingAccounts.tenantId],
    references: [tenants.tenantId],
  }),
  rateCards: many(billingRateCards),
  usageEvents: many(billingUsageEvents),
  accrualSnapshots: many(billingAccrualSnapshots),
  contractOverrides: many(billingContractOverrides),
  discountRules: many(billingDiscountRules),
  revenueShareRules: many(billingRevenueShareRules),
  invoices: many(billingInvoices),
}));

export const billingRateCardsRelations = relations(billingRateCards, ({ one, many }) => ({
  billingAccount: one(billingAccounts, {
    fields: [billingRateCards.billingAccountId],
    references: [billingAccounts.billingAccountId],
  }),
  lines: many(billingRateCardLines),
  ratedEvents: many(billingRatedEvents),
}));

export const billingRateCardLinesRelations = relations(billingRateCardLines, ({ one }) => ({
  rateCard: one(billingRateCards, {
    fields: [billingRateCardLines.rateCardId],
    references: [billingRateCards.rateCardId],
  }),
}));

export const billingUsageEventsRelations = relations(billingUsageEvents, ({ one, many }) => ({
  billingAccount: one(billingAccounts, {
    fields: [billingUsageEvents.billingAccountId],
    references: [billingAccounts.billingAccountId],
  }),
  ratedEvents: many(billingRatedEvents),
}));

export const billingRatedEventsRelations = relations(billingRatedEvents, ({ one }) => ({
  usageEvent: one(billingUsageEvents, {
    fields: [billingRatedEvents.usageEventId],
    references: [billingUsageEvents.usageEventId],
  }),
  rateCard: one(billingRateCards, {
    fields: [billingRatedEvents.rateCardId],
    references: [billingRateCards.rateCardId],
  }),
}));

export const billingInvoicesRelations = relations(billingInvoices, ({ one, many }) => ({
  billingAccount: one(billingAccounts, {
    fields: [billingInvoices.billingAccountId],
    references: [billingAccounts.billingAccountId],
  }),
  tenant: one(tenants, {
    fields: [billingInvoices.tenantId],
    references: [tenants.tenantId],
  }),
  lines: many(billingInvoiceLines),
  approvals: many(billingInvoiceApprovals),
}));

export const billingInvoiceLinesRelations = relations(billingInvoiceLines, ({ one }) => ({
  invoice: one(billingInvoices, {
    fields: [billingInvoiceLines.billingInvoiceId],
    references: [billingInvoices.billingInvoiceId],
  }),
}));

export const billingInvoiceApprovalsRelations = relations(billingInvoiceApprovals, ({ one }) => ({
  invoice: one(billingInvoices, {
    fields: [billingInvoiceApprovals.billingInvoiceId],
    references: [billingInvoices.billingInvoiceId],
  }),
}));

// ── Escrow ────────────────────────────────────────────────────────────────────

export const escrowAccountsRelations = relations(escrowAccounts, ({ many }) => ({
  parties: many(escrowParties),
  transactions: many(escrowTransactions),
  milestones: many(escrowMilestones),
  disputes: many(escrowDisputes),
  documents: many(escrowDocuments),
  fees: many(escrowFees),
  interestAccruals: many(escrowInterestAccruals),
  auditLog: many(escrowAuditLog),
}));

export const escrowPartiesRelations = relations(escrowParties, ({ one }) => ({
  escrowAccount: one(escrowAccounts, {
    fields: [escrowParties.escrowId],
    references: [escrowAccounts.escrowId],
  }),
}));

export const escrowTransactionsRelations = relations(escrowTransactions, ({ one }) => ({
  escrowAccount: one(escrowAccounts, {
    fields: [escrowTransactions.escrowId],
    references: [escrowAccounts.escrowId],
  }),
}));

export const escrowMilestonesRelations = relations(escrowMilestones, ({ one }) => ({
  escrowAccount: one(escrowAccounts, {
    fields: [escrowMilestones.escrowId],
    references: [escrowAccounts.escrowId],
  }),
}));

export const escrowDisputesRelations = relations(escrowDisputes, ({ one }) => ({
  escrowAccount: one(escrowAccounts, {
    fields: [escrowDisputes.escrowId],
    references: [escrowAccounts.escrowId],
  }),
}));

export const escrowDocumentsRelations = relations(escrowDocuments, ({ one }) => ({
  escrowAccount: one(escrowAccounts, {
    fields: [escrowDocuments.escrowId],
    references: [escrowAccounts.escrowId],
  }),
}));

export const escrowFeesRelations = relations(escrowFees, ({ one }) => ({
  escrowAccount: one(escrowAccounts, {
    fields: [escrowFees.escrowId],
    references: [escrowAccounts.escrowId],
  }),
}));

export const escrowInterestAccrualsRelations = relations(escrowInterestAccruals, ({ one }) => ({
  escrowAccount: one(escrowAccounts, {
    fields: [escrowInterestAccruals.escrowId],
    references: [escrowAccounts.escrowId],
  }),
}));

export const escrowAuditLogRelations = relations(escrowAuditLog, ({ one }) => ({
  escrowAccount: one(escrowAccounts, {
    fields: [escrowAuditLog.escrowId],
    references: [escrowAccounts.escrowId],
  }),
}));

// ── Middleware: Dapr ─────────────────────────────────────────────────────────

export const daprPublishedEventsRelations = relations(daprPublishedEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [daprPublishedEvents.tenantId],
    references: [tenants.tenantId],
  }),
}));

export const daprSubscriptionsRelations = relations(daprSubscriptions, ({ many }) => ({
  publishedEvents: many(daprPublishedEvents),
}));

// ── Middleware: Temporal ─────────────────────────────────────────────────────

export const temporalWorkflowExecutionsRelations = relations(temporalWorkflowExecutions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [temporalWorkflowExecutions.tenantId],
    references: [tenants.tenantId],
  }),
  activityLog: many(temporalActivityLog),
  sagaCompensations: many(temporalSagaCompensations),
}));

export const temporalActivityLogRelations = relations(temporalActivityLog, ({ one }) => ({
  workflow: one(temporalWorkflowExecutions, {
    fields: [temporalActivityLog.workflowId],
    references: [temporalWorkflowExecutions.workflowId],
  }),
}));

export const temporalSagaCompensationsRelations = relations(temporalSagaCompensations, ({ one }) => ({
  workflow: one(temporalWorkflowExecutions, {
    fields: [temporalSagaCompensations.workflowId],
    references: [temporalWorkflowExecutions.workflowId],
  }),
}));

// ── Middleware: Fluvio ───────────────────────────────────────────────────────

export const fluvioTopicsRelations = relations(fluvioTopics, ({ many }) => ({
  eventLog: many(fluvioEventLog),
  consumerGroups: many(fluvioConsumerGroups),
}));

export const fluvioEventLogRelations = relations(fluvioEventLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [fluvioEventLog.tenantId],
    references: [tenants.tenantId],
  }),
}));

export const fluvioEventOutboxRelations = relations(fluvioEventOutbox, ({ one }) => ({
  tenant: one(tenants, {
    fields: [fluvioEventOutbox.tenantId],
    references: [tenants.tenantId],
  }),
}));
