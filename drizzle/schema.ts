import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  index,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenantId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 191 }).notNull(),
  onboardingStatus: text("onboardingStatus").notNull(),
  segment: text("segment").notNull(),
  region: varchar("region", { length: 96 }).notNull(),
  enabledModules: jsonb("enabledModules").$type<string[]>().notNull(),
  whiteLabel: jsonb("whiteLabel")
    .$type<{
      displayName: string;
      legalEntity: string;
      supportEmail: string;
      primaryColor: string;
      accentColor: string;
      logoUrl: string;
      loginHeadline: string;
      customDomain?: string;
    }>()
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const tenantFeatureFlags = pgTable("tenantFeatureFlags", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  featureKey: varchar("featureKey", { length: 96 }).notNull(),
  label: varchar("label", { length: 191 }).notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  enabled: integer("enabled").default(0).notNull(),
  rolloutStage: text("rolloutStage").notNull(),
  adminManaged: integer("adminManaged").default(1).notNull(),
  dependsOn: jsonb("dependsOn").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  tenantFeatureLookupIdx: uniqueIndex("tenant_feature_lookup_idx").on(table.tenantId, table.featureKey),
  tenantFeatureCategoryIdx: index("tenant_feature_category_idx").on(table.tenantId, table.category, table.enabled),
}));

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  customerId: varchar("customerId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  segment: varchar("segment", { length: 96 }).notNull(),
  tier: varchar("tier", { length: 64 }).notNull(),
  location: varchar("location", { length: 128 }).notNull(),
  relationshipManager: varchar("relationshipManager", { length: 128 }).notNull(),
  risk: varchar("risk", { length: 64 }).notNull(),
  status: text("status").notNull(),
  bvn: varchar("bvn", { length: 32 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  balance: doublePrecision("balance").default(0).notNull(),
  lastTouchpointLabel: varchar("lastTouchpointLabel", { length: 128 }).notNull(),
  lastTouchpointAt: timestamp("lastTouchpointAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  customerTenantStatusIdx: index("customer_tenant_status_idx").on(table.tenantId, table.status, table.segment),
  customerManagerTouchpointIdx: index("customer_manager_touchpoint_idx").on(table.relationshipManager, table.lastTouchpointAt),
  customerBvnIdx: uniqueIndex("customer_bvn_idx").on(table.bvn),
}));

export const customerCards = pgTable("customerCards", {
  id: serial("id").primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  cardType: text("cardType").notNull(),
  brand: text("brand").notNull(),
  lastFour: varchar("lastFour", { length: 4 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 16 }).notNull(),
  cardHolder: varchar("cardHolder", { length: 191 }).notNull(),
  balance: doublePrecision("balance").default(0).notNull(),
  isLocked: integer("isLocked").default(0).notNull(),
  controls: jsonb("controls").$type<{ online: boolean; atm: boolean; international: boolean }>().notNull(),
  spendingLimits: jsonb("spendingLimits").$type<{ daily: number; atm: number; online: number }>().notNull(),
  colorTone: text("colorTone").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerCardEvents = pgTable("customerCardEvents", {
  id: serial("id").primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  severity: text("severity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerSavedBillers = pgTable("customerSavedBillers", {
  id: serial("id").primaryKey(),
  billerRecordId: varchar("billerRecordId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  category: text("category").notNull(),
  provider: varchar("provider", { length: 191 }).notNull(),
  billerId: varchar("billerId", { length: 96 }).notNull(),
  customerReference: varchar("customerReference", { length: 128 }).notNull(),
  nickname: varchar("nickname", { length: 128 }).notNull(),
  lastAmount: doublePrecision("lastAmount").default(0).notNull(),
  verifiedName: varchar("verifiedName", { length: 191 }),
  lastPaidAt: timestamp("lastPaidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerBillPayments = pgTable("customerBillPayments", {
  id: serial("id").primaryKey(),
  paymentId: varchar("paymentId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  category: text("category").notNull(),
  provider: varchar("provider", { length: 191 }).notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  status: text("status").notNull(),
  paidAt: timestamp("paidAt").defaultNow().notNull(),
  reference: varchar("reference", { length: 128 }).notNull(),
  billerId: varchar("billerId", { length: 96 }),
  customerReference: varchar("customerReference", { length: 128 }),
  customerName: varchar("customerName", { length: 191 }),
  scheduledFor: timestamp("scheduledFor"),
  evidenceStatus: text("evidenceStatus"),
  channel: text("channel"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerTransfers = pgTable("customerTransfers", {
  id: serial("id").primaryKey(),
  transferId: varchar("transferId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  beneficiaryId: varchar("beneficiaryId", { length: 64 }),
  beneficiaryName: varchar("beneficiaryName", { length: 191 }).notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  narration: text("narration"),
  transferType: text("transferType").notNull(),
  status: text("status").notNull(),
  bankCode: varchar("bankCode", { length: 32 }),
  bankName: varchar("bankName", { length: 96 }),
  accountNumber: varchar("accountNumber", { length: 32 }),
  accountName: varchar("accountName", { length: 191 }),
  workflowId: varchar("workflowId", { length: 64 }),
  otpReference: varchar("otpReference", { length: 64 }),
  otpIssuedAt: timestamp("otpIssuedAt"),
  confirmedAt: timestamp("confirmedAt"),
  approvalState: text("approvalState"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  transferCustomerStatusIdx: index("transfer_customer_status_idx").on(table.customerId, table.status, table.createdAt),
  transferApprovalIdx: index("transfer_approval_idx").on(table.customerId, table.approvalState, table.updatedAt),
  transferOtpIdx: index("transfer_otp_idx").on(table.otpReference, table.status),
}));

export const customerApprovals = pgTable("customerApprovals", {
  id: serial("id").primaryKey(),
  approvalId: varchar("approvalId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  entityType: text("entityType").notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  state: text("state").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  requestedByRole: varchar("requestedByRole", { length: 64 }).notNull(),
  requestedById: varchar("requestedById", { length: 96 }).notNull(),
  approvalRole: varchar("approvalRole", { length: 64 }).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolutionNote: text("resolutionNote"),
}, (table) => ({
  approvalCustomerStateIdx: index("approval_customer_state_idx").on(table.customerId, table.state, table.requestedAt),
  approvalRoleStateIdx: index("approval_role_state_idx").on(table.approvalRole, table.state, table.requestedAt),
}));

export const customerStatementExports = pgTable("customerStatementExports", {
  id: serial("id").primaryKey(),
  exportRequestId: varchar("exportRequestId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  exportJobId: varchar("exportJobId", { length: 64 }).notNull(),
  format: text("format").notNull(),
  rowCount: integer("rowCount").default(0).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerStatements = pgTable("customerStatements", {
  id: serial("id").primaryKey(),
  statementId: varchar("statementId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  direction: text("direction").notNull(),
  statementType: text("statementType").notNull(),
  status: text("status").notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  reference: varchar("reference", { length: 128 }),
  category: varchar("category", { length: 96 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  statementCustomerOccurredIdx: index("statement_customer_occurred_idx").on(table.customerId, table.occurredAt),
  statementCustomerTypeIdx: index("statement_customer_type_idx").on(table.customerId, table.statementType, table.status),
}));

export const customerNotifications = pgTable("customerNotifications", {
  id: serial("id").primaryKey(),
  notificationId: varchar("notificationId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  message: text("message").notNull(),
  notificationType: text("notificationType").notNull(),
  isRead: integer("isRead").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 191 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  notificationCustomerReadIdx: index("notification_customer_read_idx").on(table.customerId, table.isRead, table.createdAt),
}));

export const customerSessionPreferences = pgTable("customerSessionPreferences", {
  id: serial("id").primaryKey(),
  actorId: varchar("actorId", { length: 96 }).notNull(),
  actorRole: varchar("actorRole", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  activeCustomerId: varchar("activeCustomerId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  sessionActorLookupIdx: uniqueIndex("session_actor_lookup_idx").on(table.actorId, table.actorRole, table.tenantId),
}));

export const workflowCases = pgTable("workflowCases", {
  id: serial("id").primaryKey(),
  workflowId: varchar("workflowId", { length: 64 }).notNull().unique(),
  customer: varchar("customer", { length: 191 }).notNull(),
  product: varchar("product", { length: 128 }).notNull(),
  stage: varchar("stage", { length: 128 }).notNull(),
  status: varchar("status", { length: 64 }).notNull(),
  channel: varchar("channel", { length: 96 }).notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  nextAction: text("nextAction").notNull(),
  slaHours: integer("slaHours").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  workflowStageStatusIdx: index("workflow_stage_status_idx").on(table.stage, table.status, table.updatedAt),
  workflowProductStatusIdx: index("workflow_product_status_idx").on(table.product, table.status, table.createdAt),
}));

export const operatorActions = pgTable("operatorActions", {
  id: serial("id").primaryKey(),
  actionId: varchar("actionId", { length: 64 }).notNull().unique(),
  domainKey: varchar("domainKey", { length: 96 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  owner: varchar("owner", { length: 128 }).notNull(),
  dueAt: timestamp("dueAt").notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  status: text("status").notNull(),
  roles: jsonb("roles").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  operatorDomainStatusIdx: index("operator_domain_status_idx").on(table.domainKey, table.status, table.dueAt),
  operatorRouteStatusIdx: index("operator_route_status_idx").on(table.route, table.status, table.dueAt),
}));

export const auditEntries = pgTable("auditEntries", {
  id: serial("id").primaryKey(),
  auditId: varchar("auditId", { length: 64 }).notNull().unique(),
  timestampAt: timestamp("timestampAt").defaultNow().notNull(),
  actorRole: varchar("actorRole", { length: 64 }).notNull(),
  actorId: varchar("actorId", { length: 96 }).notNull(),
  entityType: varchar("entityType", { length: 96 }).notNull(),
  entityId: varchar("entityId", { length: 96 }).notNull(),
  action: varchar("action", { length: 96 }).notNull(),
  outcome: text("outcome").notNull(),
  severity: text("severity").notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  middleware: jsonb("middleware").$type<string[]>().notNull(),
  detail: text("detail").notNull(),
}, (table) => ({
  auditRouteTimestampIdx: index("audit_route_timestamp_idx").on(table.route, table.timestampAt),
  auditSeverityTimestampIdx: index("audit_severity_timestamp_idx").on(table.severity, table.timestampAt),
}));

export const exportJobs = pgTable("exportJobs", {
  id: serial("id").primaryKey(),
  exportJobId: varchar("exportJobId", { length: 64 }).notNull().unique(),
  domainKey: varchar("domainKey", { length: 96 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  format: text("format").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  requestedByRole: varchar("requestedByRole", { length: 64 }).notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  rowCount: integer("rowCount").default(0).notNull(),
  approvalState: text("approvalState").notNull(),
  approvalSignature: varchar("approvalSignature", { length: 191 }).notNull(),
  downloadUrl: varchar("downloadUrl", { length: 255 }).notNull(),
  retainedUntil: timestamp("retainedUntil"),
  reportVersion: varchar("reportVersion", { length: 96 }),
  approvalChain: jsonb("approvalChain").$type<string[]>().notNull(),
  signedBy: jsonb("signedBy").$type<string[]>().notNull(),
}, (table) => ({
  exportDomainApprovalIdx: index("export_domain_approval_idx").on(table.domainKey, table.approvalState, table.createdAt),
  exportRouteStatusIdx: index("export_route_status_idx").on(table.route, table.status, table.createdAt),
}));

export const billingAccounts = pgTable("billingAccounts", {
  id: serial("id").primaryKey(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  accountName: varchar("accountName", { length: 191 }).notNull(),
  billingModel: text("billingModel").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: text("status").notNull(),
  contractStartAt: timestamp("contractStartAt").notNull(),
  contractEndAt: timestamp("contractEndAt"),
  defaultRateCardId: varchar("defaultRateCardId", { length: 64 }).notNull(),
  minimumCommitAmount: doublePrecision("minimumCommitAmount").default(0).notNull(),
  defaultBillingPeriodType: text("defaultBillingPeriodType").default("monthly").notNull(),
  invoiceDueDays: integer("invoiceDueDays").default(14).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingAccountTenantIdx: index("billing_account_tenant_idx").on(table.tenantId, table.status),
}));

export const billingRateCards = pgTable("billingRateCards", {
  id: serial("id").primaryKey(),
  rateCardId: varchar("rateCardId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }),
  name: varchar("name", { length: 191 }).notNull(),
  version: integer("version").default(1).notNull(),
  status: text("status").notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  pricingCurrency: varchar("pricingCurrency", { length: 3 }).notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  approvalState: text("approvalState").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingRateCardLookupIdx: index("billing_rate_card_lookup_idx").on(table.billingAccountId, table.status, table.effectiveFrom),
}));

export const billingRateCardLines = pgTable("billingRateCardLines", {
  id: serial("id").primaryKey(),
  rateCardLineId: varchar("rateCardLineId", { length: 64 }).notNull().unique(),
  rateCardId: varchar("rateCardId", { length: 64 }).notNull(),
  meterKey: varchar("meterKey", { length: 96 }).notNull(),
  productKey: varchar("productKey", { length: 96 }).notNull(),
  chargeType: text("chargeType").notNull(),
  unitPrice: doublePrecision("unitPrice").default(0).notNull(),
  includedUnits: integer("includedUnits").default(0).notNull(),
  tierStart: integer("tierStart"),
  tierEnd: integer("tierEnd"),
  minimumCharge: doublePrecision("minimumCharge"),
  maximumCharge: doublePrecision("maximumCharge"),
  pricingFormula: jsonb("pricingFormula").$type<Record<string, unknown>>(),
  settlementLedgerCode: varchar("settlementLedgerCode", { length: 96 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingRateCardLineLookupIdx: index("billing_rate_card_line_lookup_idx").on(table.rateCardId, table.meterKey, table.productKey),
}));

export const billingUsageEvents = pgTable("billingUsageEvents", {
  id: serial("id").primaryKey(),
  usageEventId: varchar("usageEventId", { length: 64 }).notNull().unique(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  sourceService: varchar("sourceService", { length: 96 }).notNull(),
  sourceEventType: varchar("sourceEventType", { length: 96 }).notNull(),
  meterKey: varchar("meterKey", { length: 96 }).notNull(),
  productKey: varchar("productKey", { length: 96 }).notNull(),
  quantity: integer("quantity").default(0).notNull(),
  unitAmount: doublePrecision("unitAmount"),
  currency: varchar("currency", { length: 3 }).notNull(),
  eventTimestamp: timestamp("eventTimestamp").notNull(),
  ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),
  correlationId: varchar("correlationId", { length: 128 }),
  actorId: varchar("actorId", { length: 96 }),
  resourceId: varchar("resourceId", { length: 96 }),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  billingUsageTenantIdx: index("billing_usage_tenant_idx").on(table.tenantId, table.eventTimestamp),
  billingUsageMeterIdx: index("billing_usage_meter_idx").on(table.meterKey, table.productKey, table.eventTimestamp),
  billingUsageIdempotencyIdx: uniqueIndex("billing_usage_idempotency_idx").on(table.idempotencyKey),
}));

export const billingRatedEvents = pgTable("billingRatedEvents", {
  id: serial("id").primaryKey(),
  ratedEventId: varchar("ratedEventId", { length: 64 }).notNull().unique(),
  usageEventId: varchar("usageEventId", { length: 64 }).notNull(),
  rateCardId: varchar("rateCardId", { length: 64 }).notNull(),
  rateCardLineId: varchar("rateCardLineId", { length: 64 }).notNull(),
  billingPeriodKey: varchar("billingPeriodKey", { length: 32 }).notNull(),
  quantityRated: integer("quantityRated").default(0).notNull(),
  billableUnits: doublePrecision("billableUnits").default(0).notNull(),
  amountAccrued: doublePrecision("amountAccrued").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  ratingExplanation: jsonb("ratingExplanation").$type<Record<string, unknown>>().notNull(),
  ratedAt: timestamp("ratedAt").defaultNow().notNull(),
}, (table) => ({
  billingRatedEventLookupIdx: index("billing_rated_event_lookup_idx").on(table.billingPeriodKey, table.rateCardId, table.ratedAt),
}));

export const billingAccrualSnapshots = pgTable("billingAccrualSnapshots", {
  id: serial("id").primaryKey(),
  accrualSnapshotId: varchar("accrualSnapshotId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  billingPeriodKey: varchar("billingPeriodKey", { length: 32 }).notNull(),
  meterKey: varchar("meterKey", { length: 96 }).notNull(),
  productKey: varchar("productKey", { length: 96 }).notNull(),
  ratedEventCount: integer("ratedEventCount").default(0).notNull(),
  usageQuantity: integer("usageQuantity").default(0).notNull(),
  accruedAmount: doublePrecision("accruedAmount").default(0).notNull(),
  unratedEventCount: integer("unratedEventCount").default(0).notNull(),
  lastUsageAt: timestamp("lastUsageAt"),
  lastRatedAt: timestamp("lastRatedAt"),
  snapshotStatus: text("snapshotStatus").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingAccrualTenantIdx: index("billing_accrual_tenant_idx").on(table.tenantId, table.billingPeriodKey, table.accruedAmount),
  billingAccrualMeterIdx: index("billing_accrual_meter_idx").on(table.meterKey, table.productKey, table.billingPeriodKey),
}));

export const billingContractOverrides = pgTable("billingContractOverrides", {
  id: serial("id").primaryKey(),
  contractOverrideId: varchar("contractOverrideId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  overrideType: text("overrideType").notNull(),
  meterKey: varchar("meterKey", { length: 96 }),
  productKey: varchar("productKey", { length: 96 }),
  valueNumber: doublePrecision("valueNumber"),
  valueText: varchar("valueText", { length: 96 }),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  status: text("status").notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingContractOverrideLookupIdx: index("billing_contract_override_lookup_idx").on(table.billingAccountId, table.overrideType, table.status, table.effectiveFrom),
}));

export const billingDiscountRules = pgTable("billingDiscountRules", {
  id: serial("id").primaryKey(),
  discountRuleId: varchar("discountRuleId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  discountType: text("discountType").notNull(),
  meterKey: varchar("meterKey", { length: 96 }),
  productKey: varchar("productKey", { length: 96 }),
  percentage: doublePrecision("percentage"),
  fixedAmount: doublePrecision("fixedAmount"),
  thresholdAmount: doublePrecision("thresholdAmount"),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  status: text("status").notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingDiscountRuleLookupIdx: index("billing_discount_rule_lookup_idx").on(table.billingAccountId, table.status, table.effectiveFrom),
}));

export const billingRevenueShareRules = pgTable("billingRevenueShareRules", {
  id: serial("id").primaryKey(),
  revenueShareRuleId: varchar("revenueShareRuleId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  target: text("target").notNull(),
  percentage: doublePrecision("percentage").default(0).notNull(),
  beneficiaryName: varchar("beneficiaryName", { length: 191 }).notNull(),
  settlementLedgerCode: varchar("settlementLedgerCode", { length: 96 }),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  status: text("status").notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingRevenueShareLookupIdx: index("billing_revenue_share_lookup_idx").on(table.billingAccountId, table.status, table.effectiveFrom),
}));

export const billingInvoices = pgTable("billingInvoices", {
  id: serial("id").primaryKey(),
  billingInvoiceId: varchar("billingInvoiceId", { length: 64 }).notNull().unique(),
  invoiceNumber: varchar("invoiceNumber", { length: 96 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  billingPeriodKey: varchar("billingPeriodKey", { length: 32 }).notNull(),
  billingPeriodType: text("billingPeriodType").notNull(),
  periodStartAt: timestamp("periodStartAt").notNull(),
  periodEndAt: timestamp("periodEndAt").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  subtotalAmount: doublePrecision("subtotalAmount").default(0).notNull(),
  discountAmount: doublePrecision("discountAmount").default(0).notNull(),
  revenueShareAmount: doublePrecision("revenueShareAmount").default(0).notNull(),
  minimumCommitAdjustment: doublePrecision("minimumCommitAdjustment").default(0).notNull(),
  taxAmount: doublePrecision("taxAmount").default(0).notNull(),
  totalAmount: doublePrecision("totalAmount").default(0).notNull(),
  status: text("status").notNull(),
  approvalStatus: text("approvalStatus").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  dueAt: timestamp("dueAt").notNull(),
  approvalStepCount: integer("approvalStepCount").default(0).notNull(),
  issuedAt: timestamp("issuedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingInvoiceLookupIdx: index("billing_invoice_lookup_idx").on(table.billingAccountId, table.billingPeriodKey, table.status),
}));

export const billingInvoiceLines = pgTable("billingInvoiceLines", {
  id: serial("id").primaryKey(),
  billingInvoiceLineId: varchar("billingInvoiceLineId", { length: 96 }).notNull().unique(),
  billingInvoiceId: varchar("billingInvoiceId", { length: 64 }).notNull(),
  lineType: text("lineType").notNull(),
  meterKey: varchar("meterKey", { length: 96 }),
  productKey: varchar("productKey", { length: 96 }),
  description: varchar("description", { length: 191 }).notNull(),
  quantity: doublePrecision("quantity").default(0).notNull(),
  unitPrice: doublePrecision("unitPrice").default(0).notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  billingInvoiceLineLookupIdx: index("billing_invoice_line_lookup_idx").on(table.billingInvoiceId, table.lineType),
}));

export const billingInvoiceApprovals = pgTable("billingInvoiceApprovals", {
  id: serial("id").primaryKey(),
  billingInvoiceApprovalId: varchar("billingInvoiceApprovalId", { length: 96 }).notNull().unique(),
  billingInvoiceId: varchar("billingInvoiceId", { length: 64 }).notNull(),
  stageKey: varchar("stageKey", { length: 96 }).notNull(),
  actorRole: text("actorRole").notNull(),
  status: text("status").notNull(),
  actedAt: timestamp("actedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingInvoiceApprovalLookupIdx: index("billing_invoice_approval_lookup_idx").on(table.billingInvoiceId, table.status, table.actorRole),
}));

export const partnerOnboardingRecords = pgTable("partnerOnboardingRecords", {
  id: serial("id").primaryKey(),
  partnerId: varchar("partnerId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  partnerName: varchar("partnerName", { length: 191 }).notNull(),
  legalEntity: varchar("legalEntity", { length: 191 }).notNull(),
  partnerType: text("partnerType").notNull(),
  region: varchar("region", { length: 96 }).notNull(),
  stage: text("stage").notNull(),
  requestedModules: jsonb("requestedModules").$type<string[]>().notNull(),
  primaryContact: jsonb("primaryContact")
    .$type<{ name: string; role: string; email: string; phone: string }>()
    .notNull(),
  operationsContact: jsonb("operationsContact")
    .$type<{ name: string; role: string; email: string; phone: string }>()
    .notNull(),
  commercial: jsonb("commercial")
    .$type<{
      plan: "starter" | "growth" | "enterprise";
      billingModel: string;
      revenueSharePct: number;
      settlementBank: string;
      settlementAccountName: string;
      settlementAccountNumber: string;
      settlementFrequency: "daily" | "weekly" | "monthly";
      goLiveTarget?: string;
    }>()
    .notNull(),
  compliance: jsonb("compliance")
    .$type<{
      kybStatus: "not_started" | "in_review" | "approved" | "rejected";
      requiredDocumentCount: number;
      submittedDocumentCount: number;
      riskRating: "low" | "medium" | "high";
      notes?: string;
      lastReviewedAt?: string;
    }>()
    .notNull(),
  branding: jsonb("branding")
    .$type<{
      displayName: string;
      supportEmail: string;
      primaryColor: string;
      accentColor: string;
      logoUrl: string;
      loginHeadline: string;
      customDomain?: string;
    }>()
    .notNull(),
  checklist: jsonb("checklist")
    .$type<Array<{ key: string; label: string; owner: "partner" | "compliance" | "operations"; completed: boolean }>>()
    .notNull(),
  blockers: jsonb("blockers").$type<string[]>().notNull(),
  readinessScore: integer("readinessScore").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  submittedAt: timestamp("submittedAt"),
  launchedAt: timestamp("launchedAt"),
  lastSubmittedBy: varchar("lastSubmittedBy", { length: 96 }),
}, (table) => ({
  partnerTenantStageIdx: index("partner_tenant_stage_idx").on(table.tenantId, table.stage, table.updatedAt),
  partnerReadinessIdx: index("partner_readiness_idx").on(table.stage, table.readinessScore),
}));

export const partnerApprovalRecords = pgTable("partnerApprovalRecords", {
  id: serial("id").primaryKey(),
  approvalId: varchar("approvalId", { length: 64 }).notNull().unique(),
  partnerId: varchar("partnerId", { length: 64 }).notNull(),
  stage: text("stage").notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  state: text("state").notNull(),
  requiredRole: text("requiredRole").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  requestedById: varchar("requestedById", { length: 96 }).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolutionNote: text("resolutionNote"),
}, (table) => ({
  partnerApprovalStateIdx: index("partner_approval_state_idx").on(table.partnerId, table.state, table.requestedAt),
  partnerApprovalRoleIdx: index("partner_approval_role_idx").on(table.requiredRole, table.state, table.requestedAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
export type TenantFeatureFlag = typeof tenantFeatureFlags.$inferSelect;
export type InsertTenantFeatureFlag = typeof tenantFeatureFlags.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type CustomerCard = typeof customerCards.$inferSelect;
export type InsertCustomerCard = typeof customerCards.$inferInsert;
export type CustomerCardEvent = typeof customerCardEvents.$inferSelect;
export type InsertCustomerCardEvent = typeof customerCardEvents.$inferInsert;
export type CustomerSavedBiller = typeof customerSavedBillers.$inferSelect;
export type InsertCustomerSavedBiller = typeof customerSavedBillers.$inferInsert;
export type CustomerBillPayment = typeof customerBillPayments.$inferSelect;
export type InsertCustomerBillPayment = typeof customerBillPayments.$inferInsert;
export type CustomerTransfer = typeof customerTransfers.$inferSelect;
export type InsertCustomerTransfer = typeof customerTransfers.$inferInsert;
export type CustomerApproval = typeof customerApprovals.$inferSelect;
export type InsertCustomerApproval = typeof customerApprovals.$inferInsert;
export type CustomerStatementExport = typeof customerStatementExports.$inferSelect;
export type InsertCustomerStatementExport = typeof customerStatementExports.$inferInsert;
export type CustomerStatement = typeof customerStatements.$inferSelect;
export type InsertCustomerStatement = typeof customerStatements.$inferInsert;
export type CustomerNotification = typeof customerNotifications.$inferSelect;
export type InsertCustomerNotification = typeof customerNotifications.$inferInsert;
export type WorkflowCase = typeof workflowCases.$inferSelect;
export type InsertWorkflowCase = typeof workflowCases.$inferInsert;
export type OperatorAction = typeof operatorActions.$inferSelect;
export type InsertOperatorAction = typeof operatorActions.$inferInsert;
export type AuditEntry = typeof auditEntries.$inferSelect;
export type InsertAuditEntry = typeof auditEntries.$inferInsert;
export type ExportJob = typeof exportJobs.$inferSelect;
export type InsertExportJob = typeof exportJobs.$inferInsert;
export type BillingAccount = typeof billingAccounts.$inferSelect;
export type InsertBillingAccount = typeof billingAccounts.$inferInsert;
export type BillingRateCard = typeof billingRateCards.$inferSelect;
export type InsertBillingRateCard = typeof billingRateCards.$inferInsert;
export type BillingRateCardLine = typeof billingRateCardLines.$inferSelect;
export type InsertBillingRateCardLine = typeof billingRateCardLines.$inferInsert;
export type BillingUsageEvent = typeof billingUsageEvents.$inferSelect;
export type InsertBillingUsageEvent = typeof billingUsageEvents.$inferInsert;
export type BillingRatedEvent = typeof billingRatedEvents.$inferSelect;
export type InsertBillingRatedEvent = typeof billingRatedEvents.$inferInsert;
export type BillingAccrualSnapshot = typeof billingAccrualSnapshots.$inferSelect;
export type InsertBillingAccrualSnapshot = typeof billingAccrualSnapshots.$inferInsert;
export type BillingContractOverride = typeof billingContractOverrides.$inferSelect;
export type InsertBillingContractOverride = typeof billingContractOverrides.$inferInsert;
export type BillingDiscountRule = typeof billingDiscountRules.$inferSelect;
export type InsertBillingDiscountRule = typeof billingDiscountRules.$inferInsert;
export type BillingRevenueShareRule = typeof billingRevenueShareRules.$inferSelect;
export type InsertBillingRevenueShareRule = typeof billingRevenueShareRules.$inferInsert;
export type BillingInvoice = typeof billingInvoices.$inferSelect;
export type InsertBillingInvoice = typeof billingInvoices.$inferInsert;
export type BillingInvoiceLine = typeof billingInvoiceLines.$inferSelect;
export type InsertBillingInvoiceLine = typeof billingInvoiceLines.$inferInsert;
export type BillingInvoiceApproval = typeof billingInvoiceApprovals.$inferSelect;
export type InsertBillingInvoiceApproval = typeof billingInvoiceApprovals.$inferInsert;
export type PartnerOnboardingRecord = typeof partnerOnboardingRecords.$inferSelect;
export type InsertPartnerOnboardingRecord = typeof partnerOnboardingRecords.$inferInsert;
export type PartnerApprovalRecord = typeof partnerApprovalRecords.$inferSelect;
export type InsertPartnerApprovalRecord = typeof partnerApprovalRecords.$inferInsert;

// ── Agriculture Banking ──

export const farmers = pgTable("farmers", {
  id: serial("id").primaryKey(),
  farmerId: varchar("farmerId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  bvn: varchar("bvn", { length: 11 }).notNull(),
  phone: varchar("phone", { length: 15 }).notNull(),
  region: varchar("region", { length: 100 }).notNull(),
  localGovernment: varchar("localGovernment", { length: 100 }).notNull(),
  farmSizeHectares: doublePrecision("farmSizeHectares").notNull(),
  primaryCrop: varchar("primaryCrop", { length: 100 }).notNull(),
  secondaryCrops: jsonb("secondaryCrops").$type<string[]>().notNull(),
  cooperativeId: varchar("cooperativeId", { length: 64 }),
  cooperativeName: varchar("cooperativeName", { length: 200 }),
  bankAccountNumber: varchar("bankAccountNumber", { length: 20 }),
  riskScore: doublePrecision("riskScore").notNull(),
  riskTier: varchar("riskTier", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  geoCoordinates: jsonb("geoCoordinates").$type<{ latitude: number; longitude: number }>(),
  registrationChannel: varchar("registrationChannel", { length: 50 }).notNull().default("platform"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("farmers_tenant_idx").on(table.tenantId),
  index("farmers_region_idx").on(table.region),
]);

export const agriLoans = pgTable("agriLoans", {
  id: serial("id").primaryKey(),
  loanId: varchar("loanId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  farmerId: varchar("farmerId", { length: 32 }).notNull(),
  loanType: varchar("loanType", { length: 50 }).notNull(),
  productCode: varchar("productCode", { length: 50 }).notNull(),
  principalAmount: doublePrecision("principalAmount").notNull(),
  interestRateBps: integer("interestRateBps").notNull(),
  tenorMonths: integer("tenorMonths").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  purpose: text("purpose").notNull(),
  collateralType: varchar("collateralType", { length: 100 }).notNull(),
  collateralValue: doublePrecision("collateralValue").notNull(),
  cropCycle: varchar("cropCycle", { length: 50 }).notNull(),
  expectedHarvestDate: varchar("expectedHarvestDate", { length: 20 }).notNull(),
  disbursementDate: varchar("disbursementDate", { length: 30 }),
  maturityDate: varchar("maturityDate", { length: 30 }),
  outstandingBalance: doublePrecision("outstandingBalance").notNull(),
  totalRepaid: doublePrecision("totalRepaid").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("pending_approval"),
  approvalStatus: varchar("approvalStatus", { length: 30 }).notNull().default("pending"),
  riskGrade: varchar("riskGrade", { length: 5 }).notNull(),
  repaymentSchedule: jsonb("repaymentSchedule").$type<object[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("agriLoans_tenant_idx").on(table.tenantId),
  index("agriLoans_farmer_idx").on(table.farmerId),
]);

export const cropInsurancePolicies = pgTable("cropInsurancePolicies", {
  id: serial("id").primaryKey(),
  policyId: varchar("policyId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  farmerId: varchar("farmerId", { length: 32 }).notNull(),
  policyType: varchar("policyType", { length: 50 }).notNull(),
  cropCovered: varchar("cropCovered", { length: 100 }).notNull(),
  coverageAreaHectares: doublePrecision("coverageAreaHectares").notNull(),
  sumInsured: doublePrecision("sumInsured").notNull(),
  premiumAmount: doublePrecision("premiumAmount").notNull(),
  premiumFrequency: varchar("premiumFrequency", { length: 20 }).notNull().default("annual"),
  policyStart: varchar("policyStart", { length: 20 }).notNull(),
  policyEnd: varchar("policyEnd", { length: 20 }).notNull(),
  weatherTrigger: jsonb("weatherTrigger").$type<object>(),
  claims: jsonb("claims").$type<object[]>().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  underwriter: varchar("underwriter", { length: 200 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("cropIns_tenant_idx").on(table.tenantId),
  index("cropIns_farmer_idx").on(table.farmerId),
]);

export const valueChainContracts = pgTable("valueChainContracts", {
  id: serial("id").primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  contractType: varchar("contractType", { length: 50 }).notNull(),
  buyerName: varchar("buyerName", { length: 200 }).notNull(),
  buyerId: varchar("buyerId", { length: 64 }).notNull(),
  sellerFarmerId: varchar("sellerFarmerId", { length: 32 }).notNull(),
  commodity: varchar("commodity", { length: 100 }).notNull(),
  quantityTonnes: doublePrecision("quantityTonnes").notNull(),
  pricePerTonne: doublePrecision("pricePerTonne").notNull(),
  totalValue: doublePrecision("totalValue").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  deliveryLocation: varchar("deliveryLocation", { length: 200 }).notNull(),
  deliveryDeadline: varchar("deliveryDeadline", { length: 20 }).notNull(),
  warehouseReceiptId: varchar("warehouseReceiptId", { length: 32 }),
  qualityGrade: varchar("qualityGrade", { length: 20 }).notNull().default("Grade A"),
  milestones: jsonb("milestones").$type<object[]>().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("vcc_tenant_idx").on(table.tenantId),
  index("vcc_seller_idx").on(table.sellerFarmerId),
]);

// ── Teller Operations ──

export const tellerSessions = pgTable("tellerSessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  tellerId: varchar("tellerId", { length: 64 }).notNull(),
  tellerName: varchar("tellerName", { length: 200 }).notNull(),
  branchCode: varchar("branchCode", { length: 20 }).notNull(),
  branchName: varchar("branchName", { length: 200 }).notNull(),
  windowNumber: integer("windowNumber").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  openedAt: varchar("openedAt", { length: 30 }).notNull(),
  closedAt: varchar("closedAt", { length: 30 }),
  openingBalance: doublePrecision("openingBalance").notNull(),
  currentBalance: doublePrecision("currentBalance").notNull(),
  transactionCount: integer("transactionCount").notNull().default(0),
  cashDrawer: jsonb("cashDrawer").$type<object>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("teller_tenant_idx").on(table.tenantId),
  index("teller_branch_idx").on(table.branchCode),
]);

export const tellerTransactions = pgTable("tellerTransactions", {
  id: serial("id").primaryKey(),
  txnId: varchar("txnId", { length: 32 }).notNull().unique(),
  sessionId: varchar("sessionId", { length: 32 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  txnType: varchar("txnType", { length: 30 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  reference: varchar("reference", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  processedAt: varchar("processedAt", { length: 30 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("ttxn_session_idx").on(table.sessionId),
  index("ttxn_tenant_idx").on(table.tenantId),
]);

export const vaultOperations = pgTable("vaultOperations", {
  id: serial("id").primaryKey(),
  operationId: varchar("operationId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  operationType: varchar("operationType", { length: 30 }).notNull(),
  fromLocation: varchar("fromLocation", { length: 100 }).notNull(),
  toLocation: varchar("toLocation", { length: 100 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  authorizedBy: varchar("authorizedBy", { length: 100 }).notNull(),
  dualControlBy: varchar("dualControlBy", { length: 100 }),
  status: varchar("status", { length: 30 }).notNull().default("completed"),
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("vault_tenant_idx").on(table.tenantId),
]);

// ── Islamic Banking ──

export const murabahaContracts = pgTable("murabahaContracts", {
  id: serial("id").primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  assetDescription: text("assetDescription").notNull(),
  assetCategory: varchar("assetCategory", { length: 50 }).notNull(),
  costPrice: doublePrecision("costPrice").notNull(),
  profitMarginPct: doublePrecision("profitMarginPct").notNull(),
  sellingPrice: doublePrecision("sellingPrice").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  tenorMonths: integer("tenorMonths").notNull(),
  instalmentAmount: doublePrecision("instalmentAmount").notNull(),
  totalPaid: doublePrecision("totalPaid").notNull().default(0),
  outstandingBalance: doublePrecision("outstandingBalance").notNull(),
  disbursementDate: varchar("disbursementDate", { length: 30 }),
  maturityDate: varchar("maturityDate", { length: 30 }),
  status: varchar("status", { length: 30 }).notNull().default("pending_sharia_review"),
  shariaCompliance: varchar("shariaCompliance", { length: 30 }).notNull(),
  shariaBoardReference: text("shariaBoardReference"),
  instalmentSchedule: jsonb("instalmentSchedule").$type<object[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("murabaha_tenant_idx").on(table.tenantId),
  index("murabaha_customer_idx").on(table.customerId),
]);

export const ijaraContracts = pgTable("ijaraContracts", {
  id: serial("id").primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  assetDescription: text("assetDescription").notNull(),
  assetCategory: varchar("assetCategory", { length: 50 }).notNull(),
  assetValue: doublePrecision("assetValue").notNull(),
  rentalAmount: doublePrecision("rentalAmount").notNull(),
  rentalFrequency: varchar("rentalFrequency", { length: 20 }).notNull().default("monthly"),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  leaseStart: varchar("leaseStart", { length: 20 }).notNull(),
  leaseEnd: varchar("leaseEnd", { length: 20 }).notNull(),
  tenorMonths: integer("tenorMonths").notNull(),
  residualValue: doublePrecision("residualValue").notNull(),
  purchaseOption: integer("purchaseOption").notNull().default(1),
  purchasePrice: doublePrecision("purchasePrice"),
  totalRentPaid: doublePrecision("totalRentPaid").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  shariaCompliance: varchar("shariaCompliance", { length: 30 }).notNull(),
  maintenanceResponsibility: varchar("maintenanceResponsibility", { length: 20 }).notNull().default("lessor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("ijara_tenant_idx").on(table.tenantId),
  index("ijara_customer_idx").on(table.customerId),
]);

export const mudarabahContracts = pgTable("mudarabahContracts", {
  id: serial("id").primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  investorId: varchar("investorId", { length: 64 }).notNull(),
  investorName: varchar("investorName", { length: 200 }).notNull(),
  fundManagerId: varchar("fundManagerId", { length: 64 }).notNull(),
  investmentPurpose: text("investmentPurpose").notNull(),
  capitalAmount: doublePrecision("capitalAmount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  profitSharingRatioInvestor: doublePrecision("profitSharingRatioInvestor").notNull(),
  profitSharingRatioManager: doublePrecision("profitSharingRatioManager").notNull(),
  investmentPeriodMonths: integer("investmentPeriodMonths").notNull(),
  startDate: varchar("startDate", { length: 20 }).notNull(),
  maturityDate: varchar("maturityDate", { length: 20 }).notNull(),
  realizedProfit: doublePrecision("realizedProfit").notNull().default(0),
  realizedLoss: doublePrecision("realizedLoss").notNull().default(0),
  distributions: jsonb("distributions").$type<object[]>().notNull(),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  shariaCompliance: varchar("shariaCompliance", { length: 30 }).notNull(),
  riskCategory: varchar("riskCategory", { length: 30 }).notNull().default("moderate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("mudarabah_tenant_idx").on(table.tenantId),
  index("mudarabah_investor_idx").on(table.investorId),
]);

// ── Trade Finance ──

export const lettersOfCredit = pgTable("lettersOfCredit", {
  id: serial("id").primaryKey(),
  lcId: varchar("lcId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  lcType: varchar("lcType", { length: 30 }).notNull().default("irrevocable"),
  applicantId: varchar("applicantId", { length: 64 }).notNull(),
  applicantName: varchar("applicantName", { length: 200 }).notNull(),
  beneficiaryName: varchar("beneficiaryName", { length: 200 }).notNull(),
  beneficiaryBank: varchar("beneficiaryBank", { length: 200 }),
  beneficiaryCountry: varchar("beneficiaryCountry", { length: 100 }),
  issuingBank: varchar("issuingBank", { length: 200 }).notNull().default("54Bank"),
  advisingBank: varchar("advisingBank", { length: 200 }),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  commodity: varchar("commodity", { length: 200 }),
  incoterm: varchar("incoterm", { length: 10 }),
  portOfLoading: varchar("portOfLoading", { length: 200 }),
  portOfDischarge: varchar("portOfDischarge", { length: 200 }),
  latestShipDate: varchar("latestShipDate", { length: 20 }),
  expiryDate: varchar("expiryDate", { length: 20 }).notNull(),
  documentsRequired: jsonb("documentsRequired").$type<string[]>().notNull(),
  amendments: jsonb("amendments").$type<object[]>().notNull(),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("lc_tenant_idx").on(table.tenantId),
  index("lc_applicant_idx").on(table.applicantId),
]);

export const warehouseReceipts = pgTable("warehouseReceipts", {
  id: serial("id").primaryKey(),
  receiptId: varchar("receiptId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  depositorId: varchar("depositorId", { length: 64 }).notNull(),
  depositorName: varchar("depositorName", { length: 200 }).notNull(),
  warehouseId: varchar("warehouseId", { length: 64 }).notNull(),
  warehouseName: varchar("warehouseName", { length: 200 }),
  location: varchar("location", { length: 200 }).notNull(),
  commodity: varchar("commodity", { length: 100 }).notNull(),
  quantity: doublePrecision("quantity").notNull(),
  quantityUnit: varchar("quantityUnit", { length: 20 }).notNull().default("tonnes"),
  qualityGrade: varchar("qualityGrade", { length: 20 }).notNull().default("Grade A"),
  storageStartDate: varchar("storageStartDate", { length: 20 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 20 }),
  marketValue: doublePrecision("marketValue").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  pledgedAsCollateral: integer("pledgedAsCollateral").notNull().default(0),
  collateralLoanId: varchar("collateralLoanId", { length: 32 }),
  insurancePolicyId: varchar("insurancePolicyId", { length: 32 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("whr_tenant_idx").on(table.tenantId),
  index("whr_depositor_idx").on(table.depositorId),
]);

export const bankGuarantees = pgTable("bankGuarantees", {
  id: serial("id").primaryKey(),
  guaranteeId: varchar("guaranteeId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  guaranteeType: varchar("guaranteeType", { length: 30 }).notNull().default("performance"),
  applicantId: varchar("applicantId", { length: 64 }).notNull(),
  applicantName: varchar("applicantName", { length: 200 }).notNull(),
  beneficiaryName: varchar("beneficiaryName", { length: 200 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  purpose: text("purpose").notNull(),
  effectiveDate: varchar("effectiveDate", { length: 20 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 20 }).notNull(),
  claimDeadline: varchar("claimDeadline", { length: 20 }),
  commissionRate: doublePrecision("commissionRate").notNull(),
  commissionAmount: doublePrecision("commissionAmount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("bg_tenant_idx").on(table.tenantId),
  index("bg_applicant_idx").on(table.applicantId),
]);

// ── Type Exports (Banking Verticals) ──

export type Farmer = typeof farmers.$inferSelect;
export type InsertFarmer = typeof farmers.$inferInsert;
export type AgriLoan = typeof agriLoans.$inferSelect;
export type InsertAgriLoan = typeof agriLoans.$inferInsert;
export type CropInsurancePolicy = typeof cropInsurancePolicies.$inferSelect;
export type InsertCropInsurancePolicy = typeof cropInsurancePolicies.$inferInsert;
export type ValueChainContract = typeof valueChainContracts.$inferSelect;
export type InsertValueChainContract = typeof valueChainContracts.$inferInsert;
export type TellerSession = typeof tellerSessions.$inferSelect;
export type InsertTellerSession = typeof tellerSessions.$inferInsert;
export type TellerTransaction = typeof tellerTransactions.$inferSelect;
export type InsertTellerTransaction = typeof tellerTransactions.$inferInsert;
export type VaultOperation = typeof vaultOperations.$inferSelect;
export type InsertVaultOperation = typeof vaultOperations.$inferInsert;
export type MurabahaContract = typeof murabahaContracts.$inferSelect;
export type InsertMurabahaContract = typeof murabahaContracts.$inferInsert;
export type IjaraContract = typeof ijaraContracts.$inferSelect;
export type InsertIjaraContract = typeof ijaraContracts.$inferInsert;
export type MudarabahContract = typeof mudarabahContracts.$inferSelect;
export type InsertMudarabahContract = typeof mudarabahContracts.$inferInsert;
export type LetterOfCredit = typeof lettersOfCredit.$inferSelect;
export type InsertLetterOfCredit = typeof lettersOfCredit.$inferInsert;
export type WarehouseReceipt = typeof warehouseReceipts.$inferSelect;
export type InsertWarehouseReceipt = typeof warehouseReceipts.$inferInsert;
export type BankGuarantee = typeof bankGuarantees.$inferSelect;
export type InsertBankGuarantee = typeof bankGuarantees.$inferInsert;

// ── Mortgage Servicing ──────────────────────────────────────────────────────

export const mortgageApplications = pgTable("mortgageApplications", {
  id: serial("id").primaryKey(),
  mortgageId: varchar("mortgageId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  applicantId: varchar("applicantId", { length: 64 }).notNull(),
  applicantName: varchar("applicantName", { length: 255 }).notNull(),
  propertyValue: doublePrecision("propertyValue").notNull(),
  loanAmount: doublePrecision("loanAmount").notNull(),
  downPayment: doublePrecision("downPayment").notNull(),
  interestRatePct: doublePrecision("interestRatePct").notNull(),
  tenorMonths: integer("tenorMonths").notNull(),
  mortgageType: varchar("mortgageType", { length: 32 }).notNull(),
  emi: doublePrecision("emi").notNull(),
  ltvPct: doublePrecision("ltvPct").notNull(),
  ltvGrade: varchar("ltvGrade", { length: 2 }).notNull(),
  dtiRatio: doublePrecision("dtiRatio").notNull(),
  propertyAddress: text("propertyAddress"),
  propertyType: varchar("propertyType", { length: 32 }),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  disbursedAt: timestamp("disbursedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_mortgage_tenant").on(table.tenantId),
  index("idx_mortgage_applicant").on(table.applicantId),
  index("idx_mortgage_status").on(table.status),
]);

// ── Education Loans ─────────────────────────────────────────────────────────

export const educationLoans = pgTable("educationLoans", {
  id: serial("id").primaryKey(),
  loanId: varchar("loanId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  studentId: varchar("studentId", { length: 64 }),
  studentName: varchar("studentName", { length: 255 }).notNull(),
  institutionName: varchar("institutionName", { length: 255 }).notNull(),
  programName: varchar("programName", { length: 255 }),
  loanAmount: doublePrecision("loanAmount").notNull(),
  interestRate: doublePrecision("interestRate").notNull(),
  tenorMonths: integer("tenorMonths").notNull(),
  graceMonths: integer("graceMonths").notNull(),
  emi: doublePrecision("emi").notNull(),
  totalDisbursed: doublePrecision("totalDisbursed").default(0),
  totalRepaid: doublePrecision("totalRepaid").default(0),
  outstandingBalance: doublePrecision("outstandingBalance").notNull(),
  cosignerName: varchar("cosignerName", { length: 255 }),
  cosignerType: varchar("cosignerType", { length: 32 }),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_edloan_tenant").on(table.tenantId),
  index("idx_edloan_student").on(table.studentId),
]);

// ── Esusu Groups ────────────────────────────────────────────────────────────

export const esusuGroups = pgTable("esusuGroups", {
  id: serial("id").primaryKey(),
  groupId: varchar("groupId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  organiserId: varchar("organiserId", { length: 64 }).notNull(),
  organiserName: varchar("organiserName", { length: 255 }).notNull(),
  contributionAmount: doublePrecision("contributionAmount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  frequency: varchar("frequency", { length: 16 }).notNull(),
  maxMembers: integer("maxMembers").notNull(),
  currentCycle: integer("currentCycle").default(0),
  totalCycles: integer("totalCycles").default(0),
  status: varchar("status", { length: 32 }).notNull().default("forming"),
  startDate: timestamp("startDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_esusu_tenant").on(table.tenantId),
  index("idx_esusu_organiser").on(table.organiserId),
]);

// ── Virtual Accounts ────────────────────────────────────────────────────────

export const virtualAccounts = pgTable("virtualAccounts", {
  id: serial("id").primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  van: varchar("van", { length: 20 }).notNull().unique(),
  parentAccountId: varchar("parentAccountId", { length: 64 }),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  ownerName: varchar("ownerName", { length: 255 }).notNull(),
  ownerType: varchar("ownerType", { length: 32 }).notNull(),
  purpose: text("purpose"),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  balance: doublePrecision("balance").default(0),
  availableBalance: doublePrecision("availableBalance").default(0),
  holdAmount: doublePrecision("holdAmount").default(0),
  dailyLimit: doublePrecision("dailyLimit"),
  monthlyLimit: doublePrecision("monthlyLimit"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_van_tenant").on(table.tenantId),
  index("idx_van_owner").on(table.ownerId),
  uniqueIndex("idx_van_number").on(table.van),
]);

// ── Agent Banking ───────────────────────────────────────────────────────────

export const agentBankingAgents = pgTable("agentBankingAgents", {
  id: serial("id").primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  agentCode: varchar("agentCode", { length: 20 }).notNull().unique(),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  ownerName: varchar("ownerName", { length: 255 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  bvn: varchar("bvn", { length: 11 }),
  lga: varchar("lga", { length: 128 }),
  state: varchar("state", { length: 64 }),
  agentType: varchar("agentType", { length: 20 }).notNull(),
  superAgentId: varchar("superAgentId", { length: 64 }),
  floatBalance: doublePrecision("floatBalance").default(0),
  commissionEarned: doublePrecision("commissionEarned").default(0),
  transactionCount: integer("transactionCount").default(0),
  kycStatus: varchar("kycStatus", { length: 16 }).default("pending"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_tenant").on(table.tenantId),
  index("idx_agent_code").on(table.agentCode),
]);

// ── Group Lending ───────────────────────────────────────────────────────────

export const lendingGroups = pgTable("lendingGroups", {
  id: serial("id").primaryKey(),
  groupId: varchar("groupId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  purpose: text("purpose"),
  groupLeaderId: varchar("groupLeaderId", { length: 64 }).notNull(),
  groupLeaderName: varchar("groupLeaderName", { length: 255 }),
  maxMembers: integer("maxMembers").notNull(),
  liabilityType: varchar("liabilityType", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("forming"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_lgroup_tenant").on(table.tenantId),
  index("idx_lgroup_leader").on(table.groupLeaderId),
]);

// ── Identity & Channels ─────────────────────────────────────────────────────

export const identityProfiles = pgTable("identityProfiles", {
  id: serial("id").primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  bvn: varchar("bvn", { length: 11 }),
  nin: varchar("nin", { length: 11 }),
  mfaEnabled: integer("mfaEnabled").default(0),
  mfaMethods: jsonb("mfaMethods"),
  activeChannels: jsonb("activeChannels"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  lastLoginAt: timestamp("lastLoginAt"),
  failedAttempts: integer("failedAttempts").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_identity_tenant").on(table.tenantId),
  index("idx_identity_customer").on(table.customerId),
]);

// ── Dispute Management ──────────────────────────────────────────────────────

export const disputeCases = pgTable("disputeCases", {
  id: serial("id").primaryKey(),
  disputeId: varchar("disputeId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  customerId: varchar("customerId", { length: 64 }),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  description: text("description"),
  transactionId: varchar("transactionId", { length: 64 }),
  transactionAmount: doublePrecision("transactionAmount"),
  disputedAmount: doublePrecision("disputedAmount"),
  channel: varchar("channel", { length: 16 }),
  priority: varchar("priority", { length: 16 }).default("medium"),
  status: varchar("status", { length: 32 }).notNull().default("filed"),
  slaDeadline: timestamp("slaDeadline"),
  assignedTo: varchar("assignedTo", { length: 64 }),
  resolution: varchar("resolution", { length: 32 }),
  resolutionAmount: doublePrecision("resolutionAmount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_dispute_tenant").on(table.tenantId),
  index("idx_dispute_customer").on(table.customerId),
  index("idx_dispute_status").on(table.status),
]);

// ── Ledger Reconciliation ───────────────────────────────────────────────────

export const reconciliationRuns = pgTable("reconciliationRuns", {
  id: serial("id").primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  runType: varchar("runType", { length: 16 }).notNull(),
  scope: varchar("scope", { length: 32 }).notNull(),
  status: varchar("status", { length: 48 }).notNull(),
  totalEntriesChecked: integer("totalEntriesChecked").default(0),
  matches: integer("matches").default(0),
  discrepancies: integer("discrepancies").default(0),
  autoRepaired: integer("autoRepaired").default(0),
  manualTriage: integer("manualTriage").default(0),
  durationMs: integer("durationMs"),
  startTime: timestamp("startTime"),
  endTime: timestamp("endTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_recon_tenant").on(table.tenantId),
  index("idx_recon_status").on(table.status),
]);

// ── ERPNext Sync ────────────────────────────────────────────────────────────

export const erpnextSyncJobs = pgTable("erpnextSyncJobs", {
  id: serial("id").primaryKey(),
  jobId: varchar("jobId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  syncType: varchar("syncType", { length: 32 }).notNull(),
  direction: varchar("direction", { length: 16 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  recordsProcessed: integer("recordsProcessed").default(0),
  recordsFailed: integer("recordsFailed").default(0),
  recordsSkipped: integer("recordsSkipped").default(0),
  retryCount: integer("retryCount").default(0),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_erpnext_tenant").on(table.tenantId),
  index("idx_erpnext_status").on(table.status),
]);

// ── Regulatory Reporting ────────────────────────────────────────────────────

export const regulatoryReports = pgTable("regulatoryReports", {
  id: serial("id").primaryKey(),
  reportId: varchar("reportId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  reportType: varchar("reportType", { length: 48 }).notNull(),
  period: varchar("period", { length: 10 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("generated"),
  submittedTo: varchar("submittedTo", { length: 16 }),
  submittedAt: timestamp("submittedAt"),
  data: jsonb("data"),
  summary: jsonb("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_regrep_tenant").on(table.tenantId),
  index("idx_regrep_type").on(table.reportType),
]);

// ── New Type Exports ────────────────────────────────────────────────────────

export type MortgageApplication = typeof mortgageApplications.$inferSelect;
export type InsertMortgageApplication = typeof mortgageApplications.$inferInsert;
export type EducationLoan = typeof educationLoans.$inferSelect;
export type InsertEducationLoan = typeof educationLoans.$inferInsert;
export type EsusuGroup = typeof esusuGroups.$inferSelect;
export type InsertEsusuGroup = typeof esusuGroups.$inferInsert;
export type VirtualAccount = typeof virtualAccounts.$inferSelect;
export type InsertVirtualAccount = typeof virtualAccounts.$inferInsert;
export type AgentBankingAgent = typeof agentBankingAgents.$inferSelect;
export type InsertAgentBankingAgent = typeof agentBankingAgents.$inferInsert;
export type LendingGroup = typeof lendingGroups.$inferSelect;
export type InsertLendingGroup = typeof lendingGroups.$inferInsert;
export type IdentityProfile = typeof identityProfiles.$inferSelect;
export type InsertIdentityProfile = typeof identityProfiles.$inferInsert;
export type DisputeCase = typeof disputeCases.$inferSelect;
export type InsertDisputeCase = typeof disputeCases.$inferInsert;
export type ReconciliationRun = typeof reconciliationRuns.$inferSelect;
export type InsertReconciliationRun = typeof reconciliationRuns.$inferInsert;
export type ErpnextSyncJob = typeof erpnextSyncJobs.$inferSelect;
export type InsertErpnextSyncJob = typeof erpnextSyncJobs.$inferInsert;
export type RegulatoryReport = typeof regulatoryReports.$inferSelect;
export type InsertRegulatoryReport = typeof regulatoryReports.$inferInsert;

// ────────────────────────────────────────────────────────────────
// Core Banking Tables — accounts, transactions, GL, loans, etc.
// ────────────────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  accountName: varchar("accountName", { length: 191 }).notNull(),
  accountType: text("accountType").notNull(), // savings, current, fixed_deposit, loan, gl
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  balance: doublePrecision("balance").default(0).notNull(),
  availableBalance: doublePrecision("availableBalance").default(0).notNull(),
  ledgerBalance: doublePrecision("ledgerBalance").default(0).notNull(),
  status: text("status").notNull().default("active"), // active, dormant, frozen, closed
  branchCode: varchar("branchCode", { length: 16 }).notNull(),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  lastTransactionAt: timestamp("lastTransactionAt"),
  version: integer("version").default(1).notNull(),
  tigerbeetleAccountId: varchar("tigerbeetleAccountId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  accountCustomerIdx: index("account_customer_idx").on(table.customerId, table.status),
  accountTenantIdx: index("account_tenant_idx").on(table.tenantId, table.accountType, table.status),
  accountBranchIdx: index("account_branch_idx").on(table.branchCode, table.status),
}));

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transactionId", { length: 64 }).notNull().unique(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  type: text("type").notNull(), // credit, debit
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  narration: text("narration").notNull(),
  reference: varchar("reference", { length: 128 }).notNull().unique(),
  channel: text("channel").notNull(), // mobile, web, ussd, pos, atm, branch
  counterpartyAccountId: varchar("counterpartyAccountId", { length: 64 }),
  counterpartyName: varchar("counterpartyName", { length: 191 }),
  balanceAfter: doublePrecision("balanceAfter").notNull(),
  status: text("status").notNull().default("completed"), // pending, completed, failed, reversed
  valueDate: timestamp("valueDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  txnAccountDateIdx: index("txn_account_date_idx").on(table.accountId, table.createdAt),
  txnReferenceIdx: uniqueIndex("txn_reference_idx").on(table.reference),
  txnTenantDateIdx: index("txn_tenant_date_idx").on(table.tenantId, table.createdAt),
}));

export const journalEntries = pgTable("journalEntries", {
  id: serial("id").primaryKey(),
  entryId: varchar("entryId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  glAccountCode: varchar("glAccountCode", { length: 32 }).notNull(),
  type: text("type").notNull(), // debit, credit
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  narration: text("narration").notNull(),
  transactionRef: varchar("transactionRef", { length: 128 }).notNull(),
  batchId: varchar("batchId", { length: 64 }),
  reversalOf: varchar("reversalOf", { length: 64 }),
  postingDate: timestamp("postingDate").defaultNow().notNull(),
  valueDate: timestamp("valueDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  jeAccountIdx: index("je_account_idx").on(table.accountId, table.createdAt),
  jeGlCodeIdx: index("je_gl_code_idx").on(table.glAccountCode, table.postingDate),
  jeBatchIdx: index("je_batch_idx").on(table.batchId),
}));

export const glAccounts = pgTable("glAccounts", {
  id: serial("id").primaryKey(),
  glAccountCode: varchar("glAccountCode", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  category: text("category").notNull(), // asset, liability, equity, income, expense
  subcategory: text("subcategory").notNull(),
  parentCode: varchar("parentCode", { length: 32 }),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  balance: doublePrecision("balance").default(0).notNull(),
  status: text("status").notNull().default("active"),
  isControlAccount: integer("isControlAccount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  glCategoryIdx: index("gl_category_idx").on(table.tenantId, table.category),
}));

export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  loanId: varchar("loanId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  loanType: text("loanType").notNull(), // term, overdraft, mortgage, agri, sme
  principalAmount: doublePrecision("principalAmount").notNull(),
  outstandingBalance: doublePrecision("outstandingBalance").notNull(),
  interestRate: doublePrecision("interestRate").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  tenor: integer("tenor").notNull(),
  tenorUnit: text("tenorUnit").notNull().default("months"),
  disbursementDate: timestamp("disbursementDate"),
  maturityDate: timestamp("maturityDate"),
  nextPaymentDate: timestamp("nextPaymentDate"),
  nextPaymentAmount: doublePrecision("nextPaymentAmount"),
  status: text("status").notNull().default("pending"), // pending, active, overdue, default, closed, written_off
  classificationIFRS9: text("classificationIFRS9").default("stage1"), // stage1, stage2, stage3
  collateralValue: doublePrecision("collateralValue"),
  approvedBy: varchar("approvedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  loanCustomerIdx: index("loan_customer_idx").on(table.customerId, table.status),
  loanPaymentIdx: index("loan_payment_idx").on(table.nextPaymentDate, table.status),
  loanTenantIdx: index("loan_tenant_idx").on(table.tenantId, table.loanType, table.status),
}));

export const loanRepayments = pgTable("loanRepayments", {
  id: serial("id").primaryKey(),
  repaymentId: varchar("repaymentId", { length: 64 }).notNull().unique(),
  loanId: varchar("loanId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  principalPortion: doublePrecision("principalPortion").notNull(),
  interestPortion: doublePrecision("interestPortion").notNull(),
  penaltyPortion: doublePrecision("penaltyPortion").default(0).notNull(),
  totalAmount: doublePrecision("totalAmount").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidDate: timestamp("paidDate"),
  status: text("status").notNull().default("scheduled"), // scheduled, paid, overdue, partial, waived
  transactionRef: varchar("transactionRef", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  repaymentLoanIdx: index("repayment_loan_idx").on(table.loanId, table.dueDate),
}));

export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  transferId: varchar("transferId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  sourceAccountId: varchar("sourceAccountId", { length: 64 }).notNull(),
  destinationAccountId: varchar("destinationAccountId", { length: 64 }),
  destinationBank: varchar("destinationBank", { length: 64 }),
  destinationAccountNumber: varchar("destinationAccountNumber", { length: 32 }),
  beneficiaryName: varchar("beneficiaryName", { length: 191 }),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  channel: text("channel").notNull(), // nip, rtgs, internal, mojaloop, swift
  narration: text("narration").notNull(),
  nipSessionId: varchar("nipSessionId", { length: 64 }),
  mojaloopTransferId: varchar("mojaloopTransferId", { length: 64 }),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed, reversed
  failureReason: text("failureReason"),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).unique(),
  transferDate: timestamp("transferDate").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  transferDateIdx: index("transfer_date_idx").on(table.transferDate, table.status),
  transferSourceIdx: index("transfer_source_idx").on(table.sourceAccountId, table.createdAt),
  transferIdempotencyIdx: uniqueIndex("transfer_idempotency_idx").on(table.idempotencyKey),
}));

export const settlements = pgTable("settlements", {
  id: serial("id").primaryKey(),
  settlementId: varchar("settlementId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  windowId: varchar("windowId", { length: 64 }).notNull(),
  model: text("model").notNull(), // dns, rtgs, cross_border
  corridor: varchar("corridor", { length: 64 }),
  totalDebits: doublePrecision("totalDebits").notNull(),
  totalCredits: doublePrecision("totalCredits").notNull(),
  netPosition: doublePrecision("netPosition").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  participantCount: integer("participantCount").notNull(),
  transferCount: integer("transferCount").notNull(),
  status: text("status").notNull().default("open"), // open, closed, settling, settled, disputed
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  settledAt: timestamp("settledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  settlementDateIdx: index("settlement_date_idx").on(table.openedAt, table.status),
}));

export const amlAlerts = pgTable("amlAlerts", {
  id: serial("id").primaryKey(),
  alertId: varchar("alertId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  entityType: text("entityType").notNull(), // customer, account, transaction
  entityId: varchar("entityId", { length: 64 }).notNull(),
  ruleId: varchar("ruleId", { length: 64 }).notNull(),
  ruleName: varchar("ruleName", { length: 191 }).notNull(),
  riskScore: doublePrecision("riskScore").notNull(),
  severity: text("severity").notNull(), // low, medium, high, critical
  status: text("status").notNull().default("pending"), // pending, investigating, escalated, closed_false_positive, closed_str_filed
  assignedTo: varchar("assignedTo", { length: 128 }),
  notes: text("notes"),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  amlPendingRiskIdx: index("aml_pending_risk_idx").on(table.status, table.riskScore),
  amlCustomerIdx: index("aml_customer_idx").on(table.customerId, table.detectedAt),
}));

export const kycVerifications = pgTable("kycVerifications", {
  id: serial("id").primaryKey(),
  verificationId: varchar("verificationId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  verificationType: text("verificationType").notNull(), // bvn, nin, passport, utility_bill, cac
  documentReference: varchar("documentReference", { length: 128 }),
  provider: varchar("provider", { length: 64 }).notNull(), // nibss, nimc, smile_id, youverify
  providerResponse: jsonb("providerResponse"),
  matchScore: doublePrecision("matchScore"),
  status: text("status").notNull().default("pending"), // pending, verified, failed, expired
  verifiedAt: timestamp("verifiedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  kycCustomerIdx: index("kyc_customer_idx").on(table.customerId, table.verifiedAt),
}));

export const fxTrades = pgTable("fxTrades", {
  id: serial("id").primaryKey(),
  tradeId: varchar("tradeId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  buyCurrency: varchar("buyCurrency", { length: 3 }).notNull(),
  sellCurrency: varchar("sellCurrency", { length: 3 }).notNull(),
  buyAmount: doublePrecision("buyAmount").notNull(),
  sellAmount: doublePrecision("sellAmount").notNull(),
  exchangeRate: doublePrecision("exchangeRate").notNull(),
  tradeType: text("tradeType").notNull(), // spot, forward, swap
  counterparty: varchar("counterparty", { length: 128 }),
  valueDate: timestamp("valueDate").notNull(),
  status: text("status").notNull().default("pending"), // pending, confirmed, settled, cancelled
  traderId: varchar("traderId", { length: 128 }),
  approvedBy: varchar("approvedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  fxValueDateIdx: index("fx_value_date_idx").on(table.valueDate, table.status),
}));

export const nostroAccounts = pgTable("nostroAccounts", {
  id: serial("id").primaryKey(),
  nostroId: varchar("nostroId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  correspondentBank: varchar("correspondentBank", { length: 191 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  accountNumber: varchar("accountNumber", { length: 64 }).notNull(),
  swiftCode: varchar("swiftCode", { length: 11 }).notNull(),
  balance: doublePrecision("balance").default(0).notNull(),
  lastReconciledAt: timestamp("lastReconciledAt"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const auditTrail = pgTable("auditTrail", {
  id: serial("id").primaryKey(),
  auditId: varchar("auditId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  entityType: text("entityType").notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  action: text("action").notNull(), // create, update, delete, approve, reject, login, logout
  actorId: varchar("actorId", { length: 128 }).notNull(),
  actorRole: varchar("actorRole", { length: 64 }).notNull(),
  changes: jsonb("changes"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  auditEntityIdx: index("audit_entity_idx").on(table.entityType, table.entityId, table.createdAt),
  auditActorIdx: index("audit_actor_idx").on(table.actorId, table.createdAt),
  auditTenantIdx: index("audit_tenant_idx").on(table.tenantId, table.createdAt),
}));

export const swiftMessages = pgTable("swiftMessages", {
  id: serial("id").primaryKey(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  messageType: varchar("messageType", { length: 8 }).notNull(), // MT103, MT202, MT940, MT950
  direction: text("direction").notNull(), // inbound, outbound
  senderBic: varchar("senderBic", { length: 11 }).notNull(),
  receiverBic: varchar("receiverBic", { length: 11 }).notNull(),
  amount: doublePrecision("amount"),
  currency: varchar("currency", { length: 3 }),
  valueDate: timestamp("valueDate"),
  rawMessage: text("rawMessage").notNull(),
  status: text("status").notNull().default("received"), // received, parsed, processed, failed, acknowledged
  relatedTransferId: varchar("relatedTransferId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  swiftTypeIdx: index("swift_type_idx").on(table.messageType, table.createdAt),
}));

export const nipTransactions = pgTable("nipTransactions", {
  id: serial("id").primaryKey(),
  nipId: varchar("nipId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  direction: text("direction").notNull(), // inbound, outbound
  sourceBank: varchar("sourceBank", { length: 8 }).notNull(),
  destinationBank: varchar("destinationBank", { length: 8 }).notNull(),
  sourceAccount: varchar("sourceAccount", { length: 20 }).notNull(),
  destinationAccount: varchar("destinationAccount", { length: 20 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  narration: text("narration").notNull(),
  responseCode: varchar("responseCode", { length: 4 }),
  status: text("status").notNull().default("pending"), // pending, successful, failed, reversed
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  nipSessionIdx: uniqueIndex("nip_session_idx").on(table.sessionId),
  nipDateIdx: index("nip_date_idx").on(table.createdAt, table.status),
}));

export const cardTransactions = pgTable("cardTransactions", {
  id: serial("id").primaryKey(),
  cardTxnId: varchar("cardTxnId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  merchantName: varchar("merchantName", { length: 191 }),
  merchantCategory: varchar("merchantCategory", { length: 8 }),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  type: text("type").notNull(), // purchase, withdrawal, refund, reversal
  channel: text("channel").notNull(), // pos, atm, ecommerce, contactless
  authorizationCode: varchar("authorizationCode", { length: 12 }),
  stan: varchar("stan", { length: 12 }),
  rrn: varchar("rrn", { length: 24 }),
  status: text("status").notNull().default("approved"), // approved, declined, reversed, disputed
  declineReason: text("declineReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  cardTxnCardIdx: index("card_txn_card_idx").on(table.cardId, table.createdAt),
  cardTxnAccountIdx: index("card_txn_account_idx").on(table.accountId, table.createdAt),
}));

export const trialBalances = pgTable("trialBalances", {
  id: serial("id").primaryKey(),
  trialBalanceId: varchar("trialBalanceId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  glAccountCode: varchar("glAccountCode", { length: 32 }).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  openingBalance: doublePrecision("openingBalance").notNull(),
  totalDebits: doublePrecision("totalDebits").notNull(),
  totalCredits: doublePrecision("totalCredits").notNull(),
  closingBalance: doublePrecision("closingBalance").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  status: text("status").notNull().default("draft"), // draft, finalized, audited
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tbPeriodIdx: index("tb_period_idx").on(table.tenantId, table.periodEnd, table.glAccountCode),
}));

// Type exports for new tables
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;
export type GLAccount = typeof glAccounts.$inferSelect;
export type InsertGLAccount = typeof glAccounts.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type InsertLoan = typeof loans.$inferInsert;
export type LoanRepayment = typeof loanRepayments.$inferSelect;
export type InsertLoanRepayment = typeof loanRepayments.$inferInsert;
export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = typeof transfers.$inferInsert;
export type Settlement = typeof settlements.$inferSelect;
export type InsertSettlement = typeof settlements.$inferInsert;
export type AMLAlert = typeof amlAlerts.$inferSelect;
export type InsertAMLAlert = typeof amlAlerts.$inferInsert;
export type KYCVerification = typeof kycVerifications.$inferSelect;
export type InsertKYCVerification = typeof kycVerifications.$inferInsert;
export type FXTrade = typeof fxTrades.$inferSelect;
export type InsertFXTrade = typeof fxTrades.$inferInsert;
export type NostroAccount = typeof nostroAccounts.$inferSelect;
export type InsertNostroAccount = typeof nostroAccounts.$inferInsert;
export type AuditTrailEntry = typeof auditTrail.$inferSelect;
export type InsertAuditTrailEntry = typeof auditTrail.$inferInsert;
export type SwiftMessage = typeof swiftMessages.$inferSelect;
export type InsertSwiftMessage = typeof swiftMessages.$inferInsert;
export type NIPTransaction = typeof nipTransactions.$inferSelect;
export type InsertNIPTransaction = typeof nipTransactions.$inferInsert;
export type CardTransaction = typeof cardTransactions.$inferSelect;
export type InsertCardTransaction = typeof cardTransactions.$inferInsert;
export type TrialBalance = typeof trialBalances.$inferSelect;
export type InsertTrialBalance = typeof trialBalances.$inferInsert;

// ========================================================================
// KYC/KYB Enhanced Suite — 15 new tables for 22 enhancements (5 phases)
// ========================================================================

export const kycTiers = pgTable("kyc_tiers", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id", { length: 64 }).notNull(),
  customerName: text("customer_name").notNull(),
  currentTier: integer("current_tier").notNull().default(1),
  dailyLimitNGN: doublePrecision("daily_limit_ngn").notNull().default(300000),
  dailyUsedNGN: doublePrecision("daily_used_ngn").notNull().default(0),
  evaluationScore: doublePrecision("evaluation_score"),
  riskFlags: jsonb("risk_flags"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("kyc_tiers_customer_idx").on(table.customerId),
  index("kyc_tiers_status_idx").on(table.status),
]);

export const kycTierHistory = pgTable("kyc_tier_history", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id", { length: 64 }).notNull(),
  previousTier: integer("previous_tier").notNull(),
  newTier: integer("new_tier").notNull(),
  reason: text("reason"),
  changedBy: varchar("changed_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("kyc_tier_history_customer_idx").on(table.customerId),
]);

export const sanctionsScreenings = pgTable("sanctions_screenings", {
  id: serial("id").primaryKey(),
  entityName: text("entity_name").notNull(),
  entityType: varchar("entity_type", { length: 32 }).notNull().default("individual"),
  listsChecked: jsonb("lists_checked"),
  matchFound: integer("match_found").notNull().default(0),
  highestScore: doublePrecision("highest_score"),
  matchDetails: jsonb("match_details"),
  status: varchar("status", { length: 32 }).notNull().default("clear"),
  screenedBy: varchar("screened_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("sanctions_entity_idx").on(table.entityName),
  index("sanctions_status_idx").on(table.status),
]);

export const transactionMonitoringRules = pgTable("transaction_monitoring_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  scenarioCode: varchar("scenario_code", { length: 32 }),
  description: text("description"),
  riskScoreImpact: integer("risk_score_impact").notNull().default(10),
  enabled: integer("enabled").notNull().default(1),
  cbnPrescribed: integer("cbn_prescribed").notNull().default(0),
  thresholdConfig: jsonb("threshold_config"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactionAlerts = pgTable("transaction_alerts", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id"),
  customerId: varchar("customer_id", { length: 64 }).notNull(),
  alertType: varchar("alert_type", { length: 64 }).notNull(),
  severity: varchar("severity", { length: 16 }).notNull().default("medium"),
  amountNGN: doublePrecision("amount_ngn"),
  description: text("description"),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  assignedTo: varchar("assigned_to", { length: 64 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("txn_alerts_customer_idx").on(table.customerId),
  index("txn_alerts_status_idx").on(table.status),
  index("txn_alerts_severity_idx").on(table.severity),
]);

export const uboGraphNodes = pgTable("ubo_graph_nodes", {
  id: serial("id").primaryKey(),
  entityName: text("entity_name").notNull(),
  entityType: varchar("entity_type", { length: 32 }).notNull(),
  nationality: varchar("nationality", { length: 64 }),
  riskLevel: varchar("risk_level", { length: 16 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const uboGraphEdges = pgTable("ubo_graph_edges", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  targetId: integer("target_id").notNull(),
  relationship: varchar("relationship", { length: 64 }).notNull(),
  ownershipPct: doublePrecision("ownership_pct"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const riskScores = pgTable("risk_scores", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id", { length: 64 }).notNull(),
  staticScore: doublePrecision("static_score").notNull().default(0),
  dynamicScore: doublePrecision("dynamic_score").notNull().default(0),
  totalScore: doublePrecision("total_score").notNull().default(0),
  riskTier: varchar("risk_tier", { length: 16 }).notNull().default("low"),
  factors: jsonb("factors"),
  lastCalculatedAt: timestamp("last_calculated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("risk_scores_customer_idx").on(table.customerId),
  index("risk_scores_tier_idx").on(table.riskTier),
]);

export const agentKycCaptures = pgTable("agent_kyc_captures", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id", { length: 64 }).notNull(),
  agentName: text("agent_name"),
  customerId: varchar("customer_id", { length: 64 }),
  customerName: text("customer_name"),
  lga: varchar("lga", { length: 128 }),
  state: varchar("state", { length: 64 }),
  offlineCapture: integer("offline_capture").notNull().default(0),
  qualityScore: doublePrecision("quality_score"),
  gpsLat: doublePrecision("gps_lat"),
  gpsLng: doublePrecision("gps_lng"),
  syncedAt: timestamp("synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("agent_captures_agent_idx").on(table.agentId),
  index("agent_captures_lga_idx").on(table.lga),
]);

export const adverseMediaHits = pgTable("adverse_media_hits", {
  id: serial("id").primaryKey(),
  entityName: text("entity_name").notNull(),
  source: varchar("source", { length: 128 }).notNull(),
  headline: text("headline"),
  riskImpact: varchar("risk_impact", { length: 16 }).notNull().default("medium"),
  sentiment: doublePrecision("sentiment"),
  url: text("url"),
  detectedAt: timestamp("detected_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
}, (table) => [
  index("adverse_media_entity_idx").on(table.entityName),
  index("adverse_media_status_idx").on(table.status),
]);

export const corporateMonitoringEvents = pgTable("corporate_monitoring_events", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  description: text("description"),
  riskImpact: varchar("risk_impact", { length: 16 }).notNull().default("medium"),
  sourceSystem: varchar("source_system", { length: 64 }),
  detectedAt: timestamp("detected_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
}, (table) => [
  index("corp_monitoring_company_idx").on(table.companyId),
]);

export const kycDataQualityMetrics = pgTable("kyc_data_quality_metrics", {
  id: serial("id").primaryKey(),
  totalCustomers: integer("total_customers").notNull(),
  kycComplete: integer("kyc_complete").notNull(),
  kycCompletePct: doublePrecision("kyc_complete_pct"),
  expiredDocuments: integer("expired_documents").notNull().default(0),
  duplicateBVN: integer("duplicate_bvn").notNull().default(0),
  missingNIN: integer("missing_nin").notNull().default(0),
  snapshotDate: timestamp("snapshot_date").defaultNow(),
});

export const efassReturns = pgTable("efass_returns", {
  id: serial("id").primaryKey(),
  period: varchar("period", { length: 16 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  tier1Count: integer("tier1_count").notNull().default(0),
  tier2Count: integer("tier2_count").notNull().default(0),
  tier3Count: integer("tier3_count").notNull().default(0),
  totalCustomers: integer("total_customers").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nfiuFilings = pgTable("nfiu_filings", {
  id: serial("id").primaryKey(),
  reportType: varchar("report_type", { length: 8 }).notNull(),
  customerId: varchar("customer_id", { length: 64 }).notNull(),
  customerName: text("customer_name"),
  amountNGN: doublePrecision("amount_ngn").notNull(),
  transactionType: varchar("transaction_type", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("pending_review"),
  cbnReference: varchar("cbn_reference", { length: 64 }),
  slaDeadline: timestamp("sla_deadline"),
  filedAt: timestamp("filed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("nfiu_filings_customer_idx").on(table.customerId),
  index("nfiu_filings_status_idx").on(table.status),
]);

export const bureauChecks = pgTable("bureau_checks", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id", { length: 64 }).notNull(),
  bureau: varchar("bureau", { length: 32 }).notNull(),
  creditScore: integer("credit_score"),
  riskGrade: varchar("risk_grade", { length: 8 }),
  activeLoans: integer("active_loans").notNull().default(0),
  defaultHistory: integer("default_history").notNull().default(0),
  checkedAt: timestamp("checked_at").defaultNow(),
}, (table) => [
  index("bureau_checks_customer_idx").on(table.customerId),
]);

// Type exports for KYC/KYB Enhanced Suite
export type KYCTier = typeof kycTiers.$inferSelect;
export type InsertKYCTier = typeof kycTiers.$inferInsert;
export type SanctionsScreening = typeof sanctionsScreenings.$inferSelect;
export type InsertSanctionsScreening = typeof sanctionsScreenings.$inferInsert;
export type TransactionMonitoringRule = typeof transactionMonitoringRules.$inferSelect;
export type InsertTransactionMonitoringRule = typeof transactionMonitoringRules.$inferInsert;
export type TransactionAlert = typeof transactionAlerts.$inferSelect;
export type InsertTransactionAlert = typeof transactionAlerts.$inferInsert;
export type UBOGraphNode = typeof uboGraphNodes.$inferSelect;
export type InsertUBOGraphNode = typeof uboGraphNodes.$inferInsert;
export type RiskScore = typeof riskScores.$inferSelect;
export type InsertRiskScore = typeof riskScores.$inferInsert;
export type AgentKycCapture = typeof agentKycCaptures.$inferSelect;
export type InsertAgentKycCapture = typeof agentKycCaptures.$inferInsert;
export type AdverseMediaHit = typeof adverseMediaHits.$inferSelect;
export type InsertAdverseMediaHit = typeof adverseMediaHits.$inferInsert;
export type NFIUFiling = typeof nfiuFilings.$inferSelect;
export type InsertNFIUFiling = typeof nfiuFilings.$inferInsert;
export type BureauCheck = typeof bureauChecks.$inferSelect;
export type InsertBureauCheck = typeof bureauChecks.$inferInsert;
export type EFASSReturn = typeof efassReturns.$inferSelect;
export type InsertEFASSReturn = typeof efassReturns.$inferInsert;

// ─── Escrow Account Management ──────────────────────────────────────────────

export const escrowAccounts = pgTable("escrow_accounts", {
  id: serial("id").primaryKey(),
  escrowId: varchar("escrowId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  escrowType: varchar("escrowType", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("NGN"),
  condition: text("condition"),
  expiresAt: timestamp("expiresAt"),
  interestRate: doublePrecision("interestRate").default(0),
  accruedInterest: doublePrecision("accruedInterest").default(0),
  setupFee: doublePrecision("setupFee").default(0),
  holdingFeeAnnual: doublePrecision("holdingFeeAnnual").default(0),
  totalFeesCharged: doublePrecision("totalFeesCharged").default(0),
  tigerBeetleTxId: varchar("tigerBeetleTxId", { length: 64 }),
  kafkaEventId: varchar("kafkaEventId", { length: 64 }),
  temporalWorkflowId: varchar("temporalWorkflowId", { length: 128 }),
  approvedBy: varchar("approvedBy", { length: 128 }),
  releasedAt: timestamp("releasedAt"),
  cancelledAt: timestamp("cancelledAt"),
  disputeReason: text("disputeReason"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("escrow_accounts_tenant_idx").on(table.tenantId),
  index("escrow_accounts_status_idx").on(table.status),
  index("escrow_accounts_type_idx").on(table.escrowType),
]);

export const escrowParties = pgTable("escrow_parties", {
  id: serial("id").primaryKey(),
  escrowId: varchar("escrowId", { length: 32 }).notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  accountId: varchar("accountId", { length: 64 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  kycStatus: varchar("kycStatus", { length: 32 }).default("pending"),
  kybStatus: varchar("kybStatus", { length: 32 }).default("pending"),
  sharePercent: doublePrecision("sharePercent").default(0),
  signedAt: timestamp("signedAt"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("escrow_parties_escrow_idx").on(table.escrowId),
  index("escrow_parties_role_idx").on(table.role),
]);

export const escrowTransactions = pgTable("escrow_transactions", {
  id: serial("id").primaryKey(),
  txId: varchar("txId", { length: 32 }).notNull().unique(),
  escrowId: varchar("escrowId", { length: 32 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("NGN"),
  fromAccount: varchar("fromAccount", { length: 64 }),
  toAccount: varchar("toAccount", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull(),
  ledgerRef: varchar("ledgerRef", { length: 64 }),
  milestoneId: varchar("milestoneId", { length: 32 }),
  narration: text("narration"),
  fxRate: doublePrecision("fxRate"),
  fxSourceCurrency: varchar("fxSourceCurrency", { length: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("escrow_txn_escrow_idx").on(table.escrowId),
  index("escrow_txn_type_idx").on(table.type),
]);

export const escrowMilestones = pgTable("escrow_milestones", {
  id: serial("id").primaryKey(),
  milestoneId: varchar("milestoneId", { length: 32 }).notNull().unique(),
  escrowId: varchar("escrowId", { length: 32 }).notNull(),
  description: text("description").notNull(),
  releaseAmount: doublePrecision("releaseAmount"),
  releasePercent: doublePrecision("releasePercent"),
  dueDate: timestamp("dueDate"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  verifiedBy: varchar("verifiedBy", { length: 128 }),
  verifiedAt: timestamp("verifiedAt"),
  evidenceDocId: varchar("evidenceDocId", { length: 64 }),
  sequenceOrder: integer("sequenceOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("escrow_milestones_escrow_idx").on(table.escrowId),
]);

export const escrowDisputes = pgTable("escrow_disputes", {
  id: serial("id").primaryKey(),
  disputeId: varchar("disputeId", { length: 32 }).notNull().unique(),
  escrowId: varchar("escrowId", { length: 32 }).notNull(),
  raisedBy: varchar("raisedBy", { length: 256 }).notNull(),
  raisedByPartyId: integer("raisedByPartyId"),
  reason: text("reason").notNull(),
  category: varchar("category", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("under_review"),
  resolution: text("resolution"),
  arbitratorName: varchar("arbitratorName", { length: 256 }),
  arbitratorDecision: text("arbitratorDecision"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("escrow_disputes_escrow_idx").on(table.escrowId),
  index("escrow_disputes_status_idx").on(table.status),
]);

export const escrowDocuments = pgTable("escrow_documents", {
  id: serial("id").primaryKey(),
  documentId: varchar("documentId", { length: 32 }).notNull().unique(),
  escrowId: varchar("escrowId", { length: 32 }).notNull(),
  documentType: varchar("documentType", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileSize: integer("fileSize"),
  mimeType: varchar("mimeType", { length: 128 }),
  storageUrl: text("storageUrl"),
  uploadedBy: varchar("uploadedBy", { length: 256 }),
  verifiedBy: varchar("verifiedBy", { length: 256 }),
  verifiedAt: timestamp("verifiedAt"),
  status: varchar("status", { length: 32 }).default("uploaded"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("escrow_documents_escrow_idx").on(table.escrowId),
]);

export const escrowFees = pgTable("escrow_fees", {
  id: serial("id").primaryKey(),
  feeId: varchar("feeId", { length: 32 }).notNull().unique(),
  escrowId: varchar("escrowId", { length: 32 }).notNull(),
  feeType: varchar("feeType", { length: 32 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("NGN"),
  chargedAt: timestamp("chargedAt").defaultNow().notNull(),
  status: varchar("status", { length: 32 }).default("charged"),
  ledgerRef: varchar("ledgerRef", { length: 64 }),
  narration: text("narration"),
}, (table) => [
  index("escrow_fees_escrow_idx").on(table.escrowId),
]);

export const escrowInterestAccruals = pgTable("escrow_interest_accruals", {
  id: serial("id").primaryKey(),
  accrualId: varchar("accrualId", { length: 32 }).notNull().unique(),
  escrowId: varchar("escrowId", { length: 32 }).notNull(),
  principalAmount: doublePrecision("principalAmount").notNull(),
  rate: doublePrecision("rate").notNull(),
  accrualPeriodStart: timestamp("accrualPeriodStart").notNull(),
  accrualPeriodEnd: timestamp("accrualPeriodEnd").notNull(),
  daysInPeriod: integer("daysInPeriod").notNull(),
  interestAmount: doublePrecision("interestAmount").notNull(),
  cumulativeInterest: doublePrecision("cumulativeInterest").notNull(),
  status: varchar("status", { length: 32 }).default("accrued"),
  ledgerRef: varchar("ledgerRef", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("escrow_interest_escrow_idx").on(table.escrowId),
]);

export const escrowRegulatoryReports = pgTable("escrow_regulatory_reports", {
  id: serial("id").primaryKey(),
  reportId: varchar("reportId", { length: 32 }).notNull().unique(),
  reportType: varchar("reportType", { length: 64 }).notNull(),
  reportingPeriodStart: timestamp("reportingPeriodStart").notNull(),
  reportingPeriodEnd: timestamp("reportingPeriodEnd").notNull(),
  totalEscrowAccounts: integer("totalEscrowAccounts"),
  totalHeldValue: doublePrecision("totalHeldValue"),
  totalReleasedValue: doublePrecision("totalReleasedValue"),
  totalDisputedValue: doublePrecision("totalDisputedValue"),
  totalInterestAccrued: doublePrecision("totalInterestAccrued"),
  filedAt: timestamp("filedAt"),
  filingReference: varchar("filingReference", { length: 128 }),
  status: varchar("status", { length: 32 }).default("draft"),
  reportData: jsonb("reportData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("escrow_regulatory_status_idx").on(table.status),
]);

export const escrowAuditLog = pgTable("escrow_audit_log", {
  id: serial("id").primaryKey(),
  auditId: varchar("auditId", { length: 32 }).notNull().unique(),
  escrowId: varchar("escrowId", { length: 32 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  actor: varchar("actor", { length: 256 }).notNull(),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  kafkaTopic: varchar("kafkaTopic", { length: 128 }),
  kafkaOffset: varchar("kafkaOffset", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("escrow_audit_escrow_idx").on(table.escrowId),
  index("escrow_audit_action_idx").on(table.action),
]);

// Escrow type exports
export type EscrowAccount = typeof escrowAccounts.$inferSelect;
export type InsertEscrowAccount = typeof escrowAccounts.$inferInsert;
export type EscrowParty = typeof escrowParties.$inferSelect;
export type InsertEscrowParty = typeof escrowParties.$inferInsert;
export type EscrowTransaction = typeof escrowTransactions.$inferSelect;
export type InsertEscrowTransaction = typeof escrowTransactions.$inferInsert;
export type EscrowMilestone = typeof escrowMilestones.$inferSelect;
export type InsertEscrowMilestone = typeof escrowMilestones.$inferInsert;
export type EscrowDispute = typeof escrowDisputes.$inferSelect;
export type InsertEscrowDispute = typeof escrowDisputes.$inferInsert;
export type EscrowDocument = typeof escrowDocuments.$inferSelect;
export type InsertEscrowDocument = typeof escrowDocuments.$inferInsert;
export type EscrowFee = typeof escrowFees.$inferSelect;
export type InsertEscrowFee = typeof escrowFees.$inferInsert;
export type EscrowInterestAccrual = typeof escrowInterestAccruals.$inferSelect;
export type InsertEscrowInterestAccrual = typeof escrowInterestAccruals.$inferInsert;
export type EscrowRegulatoryReport = typeof escrowRegulatoryReports.$inferSelect;
export type InsertEscrowRegulatoryReport = typeof escrowRegulatoryReports.$inferInsert;
export type EscrowAuditLogEntry = typeof escrowAuditLog.$inferSelect;
export type InsertEscrowAuditLogEntry = typeof escrowAuditLog.$inferInsert;

// ─── Security Enhancement Tables ─────────────────────────────────────────────

export const scratchCards = pgTable("scratch_cards", {
  id: serial("id").primaryKey(),
  cardId: text("card_id").notNull(),
  batchId: text("batch_id").notNull(),
  serialNumber: text("serial_number").notNull(),
  cardType: text("card_type").notNull(), // transaction_pin, grid_challenge, activation, prepaid_value
  pinHash: text("pin_hash"),
  pinLength: integer("pin_length"),
  status: text("status").notNull().default("generated"),
  maxAttempts: integer("max_attempts").default(3),
  usedAttempts: integer("used_attempts").default(0),
  value: real("value"),
  currency: text("currency"),
  issuedTo: text("issued_to"),
  customerId: text("customer_id"),
  branchCode: text("branch_code"),
  expiresAt: timestamp("expires_at"),
  activatedAt: timestamp("activated_at"),
  usedAt: timestamp("used_at"),
  revokedAt: timestamp("revoked_at"),
  revokeReason: text("revoke_reason"),
  tamperDetected: boolean("tamper_detected").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  serialIdx: index("scratch_cards_serial_idx").on(table.serialNumber),
  batchIdx: index("scratch_cards_batch_idx").on(table.batchId),
  statusIdx: index("scratch_cards_status_idx").on(table.status),
}));

export const cardBatches = pgTable("card_batches", {
  id: serial("id").primaryKey(),
  batchId: text("batch_id").notNull(),
  batchSize: integer("batch_size").notNull(),
  cardType: text("card_type").notNull(),
  generatedBy: text("generated_by"),
  status: text("status").notNull().default("generating"),
  cardsIssued: integer("cards_issued").default(0),
  cardsUsed: integer("cards_used").default(0),
  cardsRevoked: integer("cards_revoked").default(0),
  branchCode: text("branch_code"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pinVerifications = pgTable("pin_verifications", {
  id: serial("id").primaryKey(),
  verificationId: text("verification_id").notNull(),
  cardId: text("card_id").notNull(),
  serialNumber: text("serial_number").notNull(),
  customerId: text("customer_id").notNull(),
  transactionId: text("transaction_id"),
  channel: text("channel"),
  result: text("result").notNull(),
  ipAddress: text("ip_address"),
  deviceId: text("device_id"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  customerIdx: index("pin_verifications_customer_idx").on(table.customerId),
  resultIdx: index("pin_verifications_result_idx").on(table.result),
}));

export const gridCards = pgTable("grid_cards", {
  id: serial("id").primaryKey(),
  gridCardId: text("grid_card_id").notNull(),
  customerId: text("customer_id").notNull(),
  cardSerial: text("card_serial").notNull(),
  gridSize: text("grid_size").notNull(),
  gridValuesEncrypted: text("grid_values_encrypted"),
  status: text("status").notNull().default("active"),
  usageCount: integer("usage_count").default(0),
  branchCode: text("branch_code"),
  issuedAt: timestamp("issued_at"),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cryptoKeys = pgTable("crypto_keys", {
  id: serial("id").primaryKey(),
  keyId: text("key_id").notNull(),
  name: text("name").notNull(),
  keyType: text("key_type").notNull(),
  algorithm: text("algorithm").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status").notNull().default("generated"),
  keySizeBits: integer("key_size_bits"),
  rotationPeriodDays: integer("rotation_period_days"),
  hsmSlot: text("hsm_slot"),
  custodian1: text("custodian_1"),
  custodian2: text("custodian_2"),
  usageCount: bigint("usage_count", { mode: "number" }).default(0),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  rotatedAt: timestamp("rotated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mfaEnrollments = pgTable("mfa_enrollments", {
  id: serial("id").primaryKey(),
  enrollmentId: text("enrollment_id").notNull(),
  customerId: text("customer_id").notNull(),
  methods: text("methods").notNull(), // JSON array of methods
  primaryMethod: text("primary_method"),
  backupMethod: text("backup_method"),
  status: text("status").notNull().default("enrolled"),
  riskLevel: text("risk_level"),
  channel: text("channel"),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  lastVerified: timestamp("last_verified"),
});

export const mfaPolicies = pgTable("mfa_policies", {
  id: serial("id").primaryKey(),
  policyId: text("policy_id").notNull(),
  name: text("name").notNull(),
  transactionType: text("transaction_type"),
  amountThresholdNgn: real("amount_threshold_ngn").default(0),
  requiredFactors: integer("required_factors").default(1),
  allowedMethods: text("allowed_methods"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const otpRecords = pgTable("otp_records", {
  id: serial("id").primaryKey(),
  otpId: text("otp_id").notNull(),
  policyId: text("policy_id"),
  customerId: text("customer_id").notNull(),
  channel: text("channel"),
  purpose: text("purpose"),
  otpHash: text("otp_hash"),
  status: text("status").notNull(),
  attempts: integer("attempts").default(0),
  deliveredVia: text("delivered_via"),
  expiresAt: timestamp("expires_at"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessionRecords = pgTable("session_records", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  customerId: text("customer_id").notNull(),
  channel: text("channel"),
  deviceFingerprint: text("device_fingerprint"),
  ipAddress: text("ip_address"),
  geoLocation: text("geo_location"),
  status: text("status").notNull(),
  mfaLevel: text("mfa_level"),
  riskScore: real("risk_score"),
  lastActivity: timestamp("last_activity"),
  expiresAt: timestamp("expires_at"),
  terminatedReason: text("terminated_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  apiKeyId: text("api_key_id").notNull(),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix"),
  tenantId: text("tenant_id"),
  scopes: text("scopes"),
  rateLimit: integer("rate_limit"),
  status: text("status").notNull().default("active"),
  ipWhitelist: text("ip_whitelist"),
  usageCount: bigint("usage_count", { mode: "number" }).default(0),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  subType: text("sub_type"),
  actor: text("actor"),
  channel: text("channel"),
  ipAddress: text("ip_address"),
  geoLocation: text("geo_location"),
  details: text("details"),
  riskScore: real("risk_score"),
  severity: text("severity"),
  hashChain: text("hash_chain"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  eventTypeIdx: index("security_events_event_type_idx").on(table.eventType),
  severityIdx: index("security_events_severity_idx").on(table.severity),
}));

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  certId: text("cert_id").notNull(),
  commonName: text("common_name").notNull(),
  certType: text("cert_type").notNull(),
  algorithm: text("algorithm"),
  issuer: text("issuer"),
  serialNumber: text("serial_number"),
  status: text("status").notNull().default("active"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  renewalDays: integer("renewal_days"),
  lastRenewed: timestamp("last_renewed"),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Security type exports
export type ScratchCard = typeof scratchCards.$inferSelect;
export type InsertScratchCard = typeof scratchCards.$inferInsert;
export type CardBatch = typeof cardBatches.$inferSelect;
export type InsertCardBatch = typeof cardBatches.$inferInsert;
export type PinVerification = typeof pinVerifications.$inferSelect;
export type InsertPinVerification = typeof pinVerifications.$inferInsert;
export type GridCard = typeof gridCards.$inferSelect;
export type InsertGridCard = typeof gridCards.$inferInsert;
export type CryptoKey = typeof cryptoKeys.$inferSelect;
export type InsertCryptoKey = typeof cryptoKeys.$inferInsert;
export type MFAEnrollment = typeof mfaEnrollments.$inferSelect;
export type InsertMFAEnrollment = typeof mfaEnrollments.$inferInsert;
export type MFAPolicy = typeof mfaPolicies.$inferSelect;
export type InsertMFAPolicy = typeof mfaPolicies.$inferInsert;
export type OTPRecord = typeof otpRecords.$inferSelect;
export type InsertOTPRecord = typeof otpRecords.$inferInsert;
export type SessionRecord = typeof sessionRecords.$inferSelect;
export type InsertSessionRecord = typeof sessionRecords.$inferInsert;
export type APIKeyRecord = typeof apiKeys.$inferSelect;
export type InsertAPIKeyRecord = typeof apiKeys.$inferInsert;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type InsertSecurityEvent = typeof securityEvents.$inferInsert;
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = typeof certificates.$inferInsert;

// ─── Platform Security Hardening Tables ────────────────────────────────
export const jwtValidations = pgTable("jwt_validations", {
  id: serial("id").primaryKey(),
  tokenType: varchar("token_type", { length: 50 }).notNull(),
  issuer: text("issuer").notNull(),
  audience: varchar("audience", { length: 100 }),
  algorithm: varchar("algorithm", { length: 20 }),
  validations24h: bigint("validations_24h", { mode: "number" }).default(0),
  rejections24h: integer("rejections_24h").default(0),
  avgLatencyMs: real("avg_latency_ms"),
  cacheHitRate: real("cache_hit_rate"),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("jwt_validations_status_idx").on(table.status)]);

export const routeSchemas = pgTable("route_schemas", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  schemaName: varchar("schema_name", { length: 100 }),
  validationCount: integer("validation_count").default(0),
  passRate: real("pass_rate"),
  failedRequests: integer("failed_requests").default(0),
  status: varchar("status", { length: 30 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("route_schemas_status_idx").on(table.status)]);

export const sqlQueries = pgTable("sql_queries", {
  id: serial("id").primaryKey(),
  originalQuery: text("original_query").notNull(),
  parameterized: boolean("parameterized").default(false),
  parameterCount: integer("parameter_count").default(0),
  executionCount: bigint("execution_count", { mode: "number" }).default(0),
  avgLatencyMs: real("avg_latency_ms"),
  injectionAttempts: integer("injection_attempts").default(0),
  blocked: integer("blocked").default(0),
  status: varchar("status", { length: 30 }).default("safe"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("sql_queries_status_idx").on(table.status)]);

export const vaultSecrets = pgTable("vault_secrets", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  engine: varchar("engine", { length: 30 }).notNull(),
  version: integer("version").default(1),
  rotationDays: integer("rotation_days"),
  lastRotated: timestamp("last_rotated"),
  nextRotation: timestamp("next_rotation"),
  accessCount: bigint("access_count", { mode: "number" }).default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("vault_secrets_status_idx").on(table.status)]);

export const pinHashes = pgTable("pin_hashes", {
  id: serial("id").primaryKey(),
  algorithm: varchar("algorithm", { length: 30 }).notNull(),
  memoryCost: integer("memory_cost"),
  timeCost: integer("time_cost"),
  parallelism: integer("parallelism"),
  saltLength: integer("salt_length"),
  hashLength: integer("hash_length"),
  activeHashes: bigint("active_hashes", { mode: "number" }).default(0),
  migratedFromBcrypt: integer("migrated_from_bcrypt").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("pin_hashes_status_idx").on(table.status)]);

export const dockerHardeningChecks = pgTable("docker_hardening_checks", {
  id: serial("id").primaryKey(),
  checkName: varchar("check_name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }),
  cisBenchmark: varchar("cis_benchmark", { length: 20 }),
  passingContainers: integer("passing_containers").default(0),
  failingContainers: integer("failing_containers").default(0),
  totalContainers: integer("total_containers").default(0),
  severity: varchar("severity", { length: 20 }),
  status: varchar("status", { length: 30 }).default("unknown"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("docker_hardening_status_idx").on(table.status)]);

export const pkceFlows = pgTable("pkce_flows", {
  id: serial("id").primaryKey(),
  clientId: varchar("client_id", { length: 100 }).notNull(),
  grantType: varchar("grant_type", { length: 50 }),
  codeChallengeMethod: varchar("code_challenge_method", { length: 10 }),
  redirectUri: text("redirect_uri"),
  scopes: jsonb("scopes"),
  tokenLifetime: integer("token_lifetime"),
  refreshLifetime: integer("refresh_lifetime"),
  activeFlows: bigint("active_flows", { mode: "number" }).default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("pkce_flows_status_idx").on(table.status)]);

export const tokenFamilies = pgTable("token_families", {
  id: serial("id").primaryKey(),
  familyId: varchar("family_id", { length: 50 }).notNull(),
  userId: varchar("user_id", { length: 50 }),
  clientId: varchar("client_id", { length: 100 }),
  generation: integer("generation").default(0),
  maxGenerations: integer("max_generations").default(100),
  replayDetected: boolean("replay_detected").default(false),
  revokedDescendants: integer("revoked_descendants").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("token_families_status_idx").on(table.status)]);

export const mtlsNodes = pgTable("mtls_nodes", {
  id: serial("id").primaryKey(),
  serviceName: varchar("service_name", { length: 100 }).notNull(),
  spiffeId: text("spiffe_id"),
  certSerial: varchar("cert_serial", { length: 50 }),
  certExpiry: timestamp("cert_expiry"),
  issuer: varchar("issuer", { length: 100 }),
  peerConnections: integer("peer_connections").default(0),
  handshakes24h: bigint("handshakes_24h", { mode: "number" }).default(0),
  failedHandshakes: integer("failed_handshakes").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("mtls_nodes_status_idx").on(table.status)]);

export const bodyLimitRules = pgTable("body_limit_rules", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  method: varchar("method", { length: 10 }),
  maxBodyBytes: bigint("max_body_bytes", { mode: "number" }),
  contentTypes: jsonb("content_types"),
  enforced: boolean("enforced").default(true),
  violations24h: integer("violations_24h").default(0),
  blocked24h: integer("blocked_24h").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("body_limit_rules_status_idx").on(table.status)]);

export const kmsKeys = pgTable("kms_keys", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 20 }).notNull(),
  keyId: text("key_id").notNull(),
  algorithm: varchar("algorithm", { length: 30 }),
  usage: varchar("usage", { length: 30 }),
  state: varchar("state", { length: 20 }),
  rotationEnabled: boolean("rotation_enabled").default(true),
  encryptionOps24h: bigint("encryption_ops_24h", { mode: "number" }).default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("kms_keys_status_idx").on(table.status)]);

export const tlsConfigs = pgTable("tls_configs", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 200 }).notNull(),
  protocol: varchar("protocol", { length: 20 }),
  cipherSuites: jsonb("cipher_suites"),
  certExpiry: timestamp("cert_expiry"),
  ocspStapling: boolean("ocsp_stapling").default(true),
  hstsPreload: boolean("hsts_preload").default(true),
  handshakes24h: bigint("handshakes_24h", { mode: "number" }).default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("tls_configs_status_idx").on(table.status)]);

export const correlationRules = pgTable("correlation_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  mitreIds: jsonb("mitre_ids"),
  killChainPhase: varchar("kill_chain_phase", { length: 50 }),
  triggerEvents: jsonb("trigger_events"),
  correlationWindow: varchar("correlation_window", { length: 20 }),
  triggered24h: integer("triggered_24h").default(0),
  truePositives: integer("true_positives").default(0),
  falsePositives: integer("false_positives").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("correlation_rules_status_idx").on(table.status)]);

export const pciScans = pgTable("pci_scans", {
  id: serial("id").primaryKey(),
  requirement: text("requirement").notNull(),
  totalControls: integer("total_controls").default(0),
  passing: integer("passing").default(0),
  failing: integer("failing").default(0),
  findings: jsonb("findings"),
  lastScan: timestamp("last_scan"),
  scanDuration: varchar("scan_duration", { length: 20 }),
  status: varchar("status", { length: 30 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("pci_scans_status_idx").on(table.status)]);

export const apiKeyPolicies = pgTable("api_key_policies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  prefix: varchar("prefix", { length: 20 }),
  requiredScopes: jsonb("required_scopes"),
  ipWhitelist: jsonb("ip_whitelist"),
  rateLimit: integer("rate_limit"),
  rotationWarningDays: integer("rotation_warning_days"),
  activeKeys: integer("active_keys").default(0),
  violations24h: integer("violations_24h").default(0),
  status: varchar("status", { length: 30 }).default("enforced"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("api_key_policies_status_idx").on(table.status)]);

export const pathValidationRules = pgTable("path_validation_rules", {
  id: serial("id").primaryKey(),
  pattern: varchar("pattern", { length: 100 }).notNull(),
  regex: text("regex"),
  blocked24h: integer("blocked_24h").default(0),
  passed24h: bigint("passed_24h", { mode: "number" }).default(0),
  commonViolations: jsonb("common_violations"),
  status: varchar("status", { length: 30 }).default("enforced"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("path_validation_rules_status_idx").on(table.status)]);

export const keyRotationSchedules = pgTable("key_rotation_schedules", {
  id: serial("id").primaryKey(),
  keyId: varchar("key_id", { length: 100 }).notNull(),
  algorithm: varchar("algorithm", { length: 30 }),
  rotationInterval: varchar("rotation_interval", { length: 20 }),
  gracePeriod: varchar("grace_period", { length: 20 }),
  activeVersion: integer("active_version").default(1),
  previousVersion: integer("previous_version"),
  nextRotation: timestamp("next_rotation"),
  rotationsCompleted: integer("rotations_completed").default(0),
  failedRotations: integer("failed_rotations").default(0),
  status: varchar("status", { length: 30 }).default("scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("key_rotation_schedules_status_idx").on(table.status)]);

export const networkPolicies = pgTable("network_policies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  namespace: varchar("namespace", { length: 100 }),
  podSelector: text("pod_selector"),
  ingressRules: jsonb("ingress_rules"),
  egressRules: jsonb("egress_rules"),
  appliedPods: integer("applied_pods").default(0),
  deniedConnections24h: integer("denied_connections_24h").default(0),
  status: varchar("status", { length: 30 }).default("enforced"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("network_policies_status_idx").on(table.status)]);

export const vaultEngines = pgTable("vault_engines", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  engineType: varchar("engine_type", { length: 30 }),
  description: text("description"),
  leases: integer("leases").default(0),
  maxTTL: varchar("max_ttl", { length: 20 }),
  defaultTTL: varchar("default_ttl", { length: 20 }),
  rotationsCompleted: integer("rotations_completed").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("vault_engines_status_idx").on(table.status)]);

export const anomalyModels = pgTable("anomaly_models", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  modelType: varchar("model_type", { length: 50 }),
  features: jsonb("features"),
  accuracy: real("accuracy"),
  precision: real("precision"),
  recall: real("recall"),
  f1Score: real("f1_score"),
  trainingSize: bigint("training_size", { mode: "number" }),
  anomalies24h: integer("anomalies_24h").default(0),
  truePositives: integer("true_positives").default(0),
  status: varchar("status", { length: 30 }).default("production"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("anomaly_models_status_idx").on(table.status)]);

export const ndprRecords = pgTable("ndpr_records", {
  id: serial("id").primaryKey(),
  recordType: varchar("record_type", { length: 50 }).notNull(),
  subject: varchar("subject", { length: 100 }),
  requestType: varchar("request_type", { length: 50 }),
  responseTimeDays: integer("response_time_days"),
  slaDeadlineDays: integer("sla_deadline_days"),
  dataCategories: jsonb("data_categories"),
  dpo: varchar("dpo", { length: 100 }),
  status: varchar("status", { length: 30 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("ndpr_records_status_idx").on(table.status)]);

export const outputEncodingRules = pgTable("output_encoding_rules", {
  id: serial("id").primaryKey(),
  context: varchar("context", { length: 50 }).notNull(),
  encoder: varchar("encoder", { length: 100 }),
  charsEncoded: jsonb("chars_encoded"),
  applied24h: bigint("applied_24h", { mode: "number" }).default(0),
  xssBlocked: integer("xss_blocked").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("output_encoding_rules_status_idx").on(table.status)]);

export const imageScans = pgTable("image_scans", {
  id: serial("id").primaryKey(),
  imageName: text("image_name").notNull(),
  registry: varchar("registry", { length: 100 }),
  baseImage: varchar("base_image", { length: 100 }),
  totalVulns: integer("total_vulns").default(0),
  critical: integer("critical").default(0),
  high: integer("high").default(0),
  medium: integer("medium").default(0),
  low: integer("low").default(0),
  sbomArtifacts: integer("sbom_artifacts").default(0),
  lastScanned: timestamp("last_scanned"),
  status: varchar("status", { length: 30 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("image_scans_status_idx").on(table.status)]);

export const wafRules = pgTable("waf_rules", {
  id: serial("id").primaryKey(),
  ruleId: varchar("rule_id", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }),
  category: varchar("category", { length: 50 }),
  severity: varchar("severity", { length: 20 }),
  paranoia: integer("paranoia").default(1),
  matched24h: integer("matched_24h").default(0),
  blocked24h: integer("blocked_24h").default(0),
  falsePositives: integer("false_positives").default(0),
  status: varchar("status", { length: 30 }).default("enforced"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("waf_rules_status_idx").on(table.status)]);

export const ddosRules = pgTable("ddos_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  layer: varchar("layer", { length: 5 }),
  threshold: varchar("threshold", { length: 50 }),
  action: varchar("action", { length: 20 }),
  mitigated24h: integer("mitigated_24h").default(0),
  falsePositives: integer("false_positives").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("ddos_rules_status_idx").on(table.status)]);

export const ipRules = pgTable("ip_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  cidr: varchar("cidr", { length: 50 }),
  ruleType: varchar("rule_type", { length: 20 }),
  appliesTo: varchar("applies_to", { length: 50 }),
  hits24h: integer("hits_24h").default(0),
  blocked24h: integer("blocked_24h").default(0),
  geoCountry: varchar("geo_country", { length: 10 }),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("ip_rules_status_idx").on(table.status)]);

export const siemPipelines = pgTable("siem_pipelines", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  format: varchar("format", { length: 30 }),
  destination: text("destination"),
  eventsExported24h: bigint("events_exported_24h", { mode: "number" }).default(0),
  avgLatencyMs: real("avg_latency_ms"),
  errorRate: real("error_rate"),
  batchSize: integer("batch_size"),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("siem_pipelines_status_idx").on(table.status)]);

export const cbnComplianceChecks = pgTable("cbn_compliance_checks", {
  id: serial("id").primaryKey(),
  circular: varchar("circular", { length: 100 }).notNull(),
  title: text("title"),
  category: varchar("category", { length: 50 }),
  totalControls: integer("total_controls").default(0),
  passing: integer("passing").default(0),
  failing: integer("failing").default(0),
  complianceScore: real("compliance_score"),
  lastAssessed: timestamp("last_assessed"),
  nextAssessment: timestamp("next_assessment"),
  status: varchar("status", { length: 30 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("cbn_compliance_checks_status_idx").on(table.status)]);

export const egressPolicies = pgTable("egress_policies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  domains: jsonb("domains"),
  ports: jsonb("ports"),
  protocol: varchar("protocol", { length: 20 }),
  allowed: boolean("allowed").default(false),
  requests24h: bigint("requests_24h", { mode: "number" }).default(0),
  blocked24h: integer("blocked_24h").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("egress_policies_status_idx").on(table.status)]);

export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  severity: varchar("severity", { length: 20 }),
  category: varchar("category", { length: 50 }),
  affectedSystems: jsonb("affected_systems"),
  containmentActions: jsonb("containment_actions"),
  escalationLevel: integer("escalation_level").default(1),
  assignee: varchar("assignee", { length: 100 }),
  detectedAt: timestamp("detected_at"),
  containedAt: timestamp("contained_at"),
  ttdMinutes: integer("ttd_minutes"),
  ttcMinutes: integer("ttc_minutes"),
  status: varchar("status", { length: 30 }).default("open"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("incidents_status_idx").on(table.status)]);

export const immutableAuditBlocks = pgTable("immutable_audit_blocks", {
  id: serial("id").primaryKey(),
  blockNumber: bigint("block_number", { mode: "number" }).notNull(),
  previousHash: varchar("previous_hash", { length: 64 }),
  merkleRoot: varchar("merkle_root", { length: 64 }),
  transactions: integer("transactions").default(0),
  validator: varchar("validator", { length: 50 }),
  anchoredToChain: varchar("anchored_to_chain", { length: 50 }),
  anchorTxHash: text("anchor_tx_hash"),
  verified: boolean("verified").default(false),
  status: varchar("status", { length: 30 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("immutable_audit_blocks_status_idx").on(table.status)]);

export const soc2Evidence = pgTable("soc2_evidence", {
  id: serial("id").primaryKey(),
  controlId: varchar("control_id", { length: 20 }).notNull(),
  category: varchar("category", { length: 50 }),
  title: text("title"),
  evidenceType: varchar("evidence_type", { length: 50 }),
  result: varchar("result", { length: 20 }),
  period: varchar("period", { length: 20 }),
  artifacts: jsonb("artifacts"),
  auditor: varchar("auditor", { length: 100 }),
  status: varchar("status", { length: 30 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("soc2_evidence_status_idx").on(table.status)]);

export const pentestScans = pgTable("pentest_scans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  scope: varchar("scope", { length: 50 }),
  scanType: varchar("scan_type", { length: 30 }),
  target: text("target"),
  totalFindings: integer("total_findings").default(0),
  critical: integer("critical").default(0),
  high: integer("high").default(0),
  medium: integer("medium").default(0),
  low: integer("low").default(0),
  remediated: integer("remediated").default(0),
  vendor: varchar("vendor", { length: 100 }),
  status: varchar("status", { length: 30 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("pentest_scans_status_idx").on(table.status)]);

export const sriHashes = pgTable("sri_hashes", {
  id: serial("id").primaryKey(),
  resource: text("resource").notNull(),
  algorithm: varchar("algorithm", { length: 10 }),
  hash: text("hash"),
  lastVerified: timestamp("last_verified"),
  violations: integer("violations").default(0),
  cdnProvider: varchar("cdn_provider", { length: 50 }),
  status: varchar("status", { length: 30 }).default("valid"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("sri_hashes_status_idx").on(table.status)]);

export const cspPolicies = pgTable("csp_policies", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 200 }).notNull(),
  directives: jsonb("directives"),
  reportUri: text("report_uri"),
  violations24h: integer("violations_24h").default(0),
  uniqueSources: integer("unique_sources").default(0),
  status: varchar("status", { length: 30 }).default("enforce"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("csp_policies_status_idx").on(table.status)]);

export const framePolicies = pgTable("frame_policies", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 200 }).notNull(),
  frameAncestors: varchar("frame_ancestors", { length: 100 }),
  xFrameOptions: varchar("x_frame_options", { length: 20 }),
  frameDetection: varchar("frame_detection", { length: 30 }),
  violations24h: integer("violations_24h").default(0),
  uniqueFramers: integer("unique_framers").default(0),
  status: varchar("status", { length: 30 }).default("enforced"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("frame_policies_status_idx").on(table.status)]);

export const deviceProfiles = pgTable("device_profiles", {
  id: serial("id").primaryKey(),
  fingerprintHash: varchar("fingerprint_hash", { length: 64 }),
  userId: varchar("user_id", { length: 50 }),
  deviceType: varchar("device_type", { length: 20 }),
  browser: varchar("browser", { length: 50 }),
  os: varchar("os", { length: 50 }),
  screenRes: varchar("screen_res", { length: 20 }),
  timezone: varchar("timezone", { length: 50 }),
  trustScore: integer("trust_score").default(0),
  sessionsCount: integer("sessions_count").default(0),
  status: varchar("status", { length: 30 }).default("trusted"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("device_profiles_status_idx").on(table.status)]);

// Type exports for Platform Security Hardening
export type JwtValidation = typeof jwtValidations.$inferSelect;
export type InsertJwtValidation = typeof jwtValidations.$inferInsert;
export type RouteSchema = typeof routeSchemas.$inferSelect;
export type InsertRouteSchema = typeof routeSchemas.$inferInsert;
export type SqlQuery = typeof sqlQueries.$inferSelect;
export type InsertSqlQuery = typeof sqlQueries.$inferInsert;
export type VaultSecret = typeof vaultSecrets.$inferSelect;
export type InsertVaultSecret = typeof vaultSecrets.$inferInsert;
export type PinHash = typeof pinHashes.$inferSelect;
export type InsertPinHash = typeof pinHashes.$inferInsert;
export type DockerHardeningCheck = typeof dockerHardeningChecks.$inferSelect;
export type InsertDockerHardeningCheck = typeof dockerHardeningChecks.$inferInsert;
export type PkceFlow = typeof pkceFlows.$inferSelect;
export type InsertPkceFlow = typeof pkceFlows.$inferInsert;
export type TokenFamily = typeof tokenFamilies.$inferSelect;
export type InsertTokenFamily = typeof tokenFamilies.$inferInsert;
export type MtlsNode = typeof mtlsNodes.$inferSelect;
export type InsertMtlsNode = typeof mtlsNodes.$inferInsert;
export type BodyLimitRule = typeof bodyLimitRules.$inferSelect;
export type InsertBodyLimitRule = typeof bodyLimitRules.$inferInsert;
export type KmsKey = typeof kmsKeys.$inferSelect;
export type InsertKmsKey = typeof kmsKeys.$inferInsert;
export type TlsConfig = typeof tlsConfigs.$inferSelect;
export type InsertTlsConfig = typeof tlsConfigs.$inferInsert;
export type CorrelationRule = typeof correlationRules.$inferSelect;
export type InsertCorrelationRule = typeof correlationRules.$inferInsert;
export type PciScan = typeof pciScans.$inferSelect;
export type InsertPciScan = typeof pciScans.$inferInsert;
export type ApiKeyPolicy = typeof apiKeyPolicies.$inferSelect;
export type InsertApiKeyPolicy = typeof apiKeyPolicies.$inferInsert;
export type PathValidationRule = typeof pathValidationRules.$inferSelect;
export type InsertPathValidationRule = typeof pathValidationRules.$inferInsert;
export type KeyRotationSchedule = typeof keyRotationSchedules.$inferSelect;
export type InsertKeyRotationSchedule = typeof keyRotationSchedules.$inferInsert;
export type NetworkPolicy = typeof networkPolicies.$inferSelect;
export type InsertNetworkPolicy = typeof networkPolicies.$inferInsert;
export type VaultEngine = typeof vaultEngines.$inferSelect;
export type InsertVaultEngine = typeof vaultEngines.$inferInsert;
export type AnomalyModel = typeof anomalyModels.$inferSelect;
export type InsertAnomalyModel = typeof anomalyModels.$inferInsert;
export type NdprRecord = typeof ndprRecords.$inferSelect;
export type InsertNdprRecord = typeof ndprRecords.$inferInsert;
export type OutputEncodingRule = typeof outputEncodingRules.$inferSelect;
export type InsertOutputEncodingRule = typeof outputEncodingRules.$inferInsert;
export type ImageScan = typeof imageScans.$inferSelect;
export type InsertImageScan = typeof imageScans.$inferInsert;
export type WafRule = typeof wafRules.$inferSelect;
export type InsertWafRule = typeof wafRules.$inferInsert;
export type DdosRule = typeof ddosRules.$inferSelect;
export type InsertDdosRule = typeof ddosRules.$inferInsert;
export type IpRule = typeof ipRules.$inferSelect;
export type InsertIpRule = typeof ipRules.$inferInsert;
export type SiemPipeline = typeof siemPipelines.$inferSelect;
export type InsertSiemPipeline = typeof siemPipelines.$inferInsert;
export type CbnComplianceCheck = typeof cbnComplianceChecks.$inferSelect;
export type InsertCbnComplianceCheck = typeof cbnComplianceChecks.$inferInsert;
export type EgressPolicy = typeof egressPolicies.$inferSelect;
export type InsertEgressPolicy = typeof egressPolicies.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;
export type ImmutableAuditBlock = typeof immutableAuditBlocks.$inferSelect;
export type InsertImmutableAuditBlock = typeof immutableAuditBlocks.$inferInsert;
export type Soc2Evidence = typeof soc2Evidence.$inferSelect;
export type InsertSoc2Evidence = typeof soc2Evidence.$inferInsert;
export type PentestScan = typeof pentestScans.$inferSelect;
export type InsertPentestScan = typeof pentestScans.$inferInsert;
export type SriHash = typeof sriHashes.$inferSelect;
export type InsertSriHash = typeof sriHashes.$inferInsert;
export type CspPolicy = typeof cspPolicies.$inferSelect;
export type InsertCspPolicy = typeof cspPolicies.$inferInsert;
export type FramePolicy = typeof framePolicies.$inferSelect;
export type InsertFramePolicy = typeof framePolicies.$inferInsert;
export type DeviceProfile = typeof deviceProfiles.$inferSelect;
export type InsertDeviceProfile = typeof deviceProfiles.$inferInsert;

// ─── Performance Optimization Tables (40) ───────────────────────
export const redisCacheEntries = pgTable("redis_cache_entries", {
  id: serial("id").primaryKey(),
  route: varchar("route", { length: 100 }).notNull(),
  ttlSeconds: integer("ttlSeconds").default(0),
  hitCount: bigint("hitCount", { mode: "number" }).default(0),
  missCount: integer("missCount").default(0),
  hitRate: varchar("hitRate", { length: 20 }).notNull(),
  avgLatencyMs: real("avgLatencyMs").default(0),
  memoryMB: real("memoryMB").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("redis_cache_entries_status_idx").on(table.status)]);
export const redisSessions = pgTable("redis_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 100 }).notNull(),
  userId: varchar("userId", { length: 50 }).notNull(),
  deviceType: varchar("deviceType", { length: 30 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  expiresIn: varchar("expiresIn", { length: 20 }).notNull(),
  slidingTTL: boolean("slidingTTL").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("redis_sessions_status_idx").on(table.status)]);
export const cacheInvalidations = pgTable("cache_invalidations", {
  id: serial("id").primaryKey(),
  channel: varchar("channel", { length: 100 }).notNull(),
  subscribers: integer("subscribers").default(0),
  invalidations24h: integer("invalidations24h").default(0),
  avgPropagationMs: real("avgPropagationMs").default(0),
  pattern: varchar("pattern", { length: 30 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("cache_invalidations_status_idx").on(table.status)]);
export const bloomFilters = pgTable("bloom_filters", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  capacity: bigint("capacity", { mode: "number" }).default(0),
  falsePositiveRate: varchar("falsePositiveRate", { length: 20 }).notNull(),
  hashFunctions: integer("hashFunctions").default(0),
  memoryMB: real("memoryMB").default(0),
  lookups24h: bigint("lookups24h", { mode: "number" }).default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("bloom_filters_status_idx").on(table.status)]);
export const sortedSetRankings = pgTable("sorted_set_rankings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  members: integer("members").default(0),
  topScore: real("topScore").default(0),
  updateFrequency: varchar("updateFrequency", { length: 30 }).notNull(),
  queryLatencyMs: real("queryLatencyMs").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("sorted_set_rankings_status_idx").on(table.status)]);
export const pgbouncerPools = pgTable("pgbouncer_pools", {
  id: serial("id").primaryKey(),
  database: varchar("database", { length: 100 }).notNull(),
  poolMode: varchar("poolMode", { length: 30 }).notNull(),
  activeConnections: integer("activeConnections").default(0),
  idleConnections: integer("idleConnections").default(0),
  maxClientConn: integer("maxClientConn").default(0),
  avgQueryMs: real("avgQueryMs").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("pgbouncer_pools_status_idx").on(table.status)]);
export const queryCacheEntries = pgTable("query_cache_entries", {
  id: serial("id").primaryKey(),
  queryHash: varchar("queryHash", { length: 64 }).notNull(),
  tableName: varchar("tableName", { length: 100 }).notNull(),
  resultCount: integer("resultCount").default(0),
  ttlSeconds: integer("ttlSeconds").default(0),
  hitCount: bigint("hitCount", { mode: "number" }).default(0),
  hitRate: varchar("hitRate", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("query_cache_entries_status_idx").on(table.status)]);
export const preparedStatements = pgTable("prepared_statements", {
  id: serial("id").primaryKey(),
  queryPattern: text("queryPattern").notNull(),
  executions24h: bigint("executions24h", { mode: "number" }).default(0),
  avgExecMs: real("avgExecMs").default(0),
  planCacheHits: varchar("planCacheHits", { length: 20 }).notNull(),
  paramTypes: varchar("paramTypes", { length: 200 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("prepared_statements_status_idx").on(table.status)]);
export const tablePartitions = pgTable("table_partitions", {
  id: serial("id").primaryKey(),
  tableName: varchar("tableName", { length: 100 }).notNull(),
  partitionKey: varchar("partitionKey", { length: 50 }).notNull(),
  partitionType: varchar("partitionType", { length: 30 }).notNull(),
  activePartitions: integer("activePartitions").default(0),
  rowsPerPartition: varchar("rowsPerPartition", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("table_partitions_status_idx").on(table.status)]);
export const materializedViews = pgTable("materialized_views_perf", {
  id: serial("id").primaryKey(),
  viewName: varchar("viewName", { length: 100 }).notNull(),
  refreshIntervalSec: integer("refreshIntervalSec").default(0),
  lastRefreshMs: integer("lastRefreshMs").default(0),
  rowCount: integer("rowCount").default(0),
  autoRefresh: boolean("autoRefresh").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("materialized_views_perf_status_idx").on(table.status)]);
export const hotDataCaches = pgTable("hot_data_caches", {
  id: serial("id").primaryKey(),
  service: varchar("service", { length: 100 }).notNull(),
  cacheType: varchar("cacheType", { length: 20 }).notNull(),
  maxEntries: integer("maxEntries").default(0),
  currentEntries: integer("currentEntries").default(0),
  hitRate: varchar("hitRate", { length: 20 }).notNull(),
  memoryMB: real("memoryMB").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("hot_data_caches_status_idx").on(table.status)]);
export const batchAggregatorConfigs = pgTable("batch_aggregator_configs", {
  id: serial("id").primaryKey(),
  endpoint: varchar("endpoint", { length: 200 }).notNull(),
  maxRequests: integer("maxRequests").default(0),
  timeoutMs: integer("timeoutMs").default(0),
  avgBatchSize: real("avgBatchSize").default(0),
  requestsSaved24h: bigint("requestsSaved24h", { mode: "number" }).default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("batch_aggregator_configs_status_idx").on(table.status)]);
export const keepaliveConfigs = pgTable("keepalive_configs", {
  id: serial("id").primaryKey(),
  service: varchar("service", { length: 100 }).notNull(),
  keepAliveTimeout: integer("keepAliveTimeout").default(0),
  maxIdlePerHost: integer("maxIdlePerHost").default(0),
  activeConnections: integer("activeConnections").default(0),
  reuseRate: varchar("reuseRate", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("keepalive_configs_status_idx").on(table.status)]);
export const compressionConfigs = pgTable("compression_configs", {
  id: serial("id").primaryKey(),
  algorithm: varchar("algorithm", { length: 20 }).notNull(),
  level: integer("level").default(0),
  minBytes: integer("minBytes").default(0),
  compressionRatio: varchar("compressionRatio", { length: 20 }).notNull(),
  bandwidthSaved24h: varchar("bandwidthSaved24h", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("compression_configs_status_idx").on(table.status)]);
export const grpcServices = pgTable("grpc_services", {
  id: serial("id").primaryKey(),
  service: varchar("service", { length: 100 }).notNull(),
  proto: varchar("proto", { length: 100 }).notNull(),
  avgLatencyMs: real("avgLatencyMs").default(0),
  throughputRps: integer("throughputRps").default(0),
  compressionRatio: varchar("compressionRatio", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("grpc_services_status_idx").on(table.status)]);
export const routeTrieStats = pgTable("route_trie_stats", {
  id: serial("id").primaryKey(),
  routePrefix: varchar("routePrefix", { length: 200 }).notNull(),
  totalRoutes: integer("totalRoutes").default(0),
  trieDepth: integer("trieDepth").default(0),
  avgLookupNs: integer("avgLookupNs").default(0),
  cacheHitRate: varchar("cacheHitRate", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("route_trie_stats_status_idx").on(table.status)]);
export const streamResponseConfigs = pgTable("stream_response_configs", {
  id: serial("id").primaryKey(),
  endpoint: varchar("endpoint", { length: 200 }).notNull(),
  thresholdBytes: integer("thresholdBytes").default(0),
  chunksizeKB: integer("chunksizeKB").default(0),
  bytesStreamed24h: varchar("bytesStreamed24h", { length: 20 }).notNull(),
  memoryReductionPct: varchar("memoryReductionPct", { length: 10 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("stream_response_configs_status_idx").on(table.status)]);
export const http2Connections = pgTable("http2_connections", {
  id: serial("id").primaryKey(),
  clientIp: varchar("clientIp", { length: 45 }).notNull(),
  streams: integer("streams").default(0),
  maxConcurrentStreams: integer("maxConcurrentStreams").default(0),
  windowSize: varchar("windowSize", { length: 20 }).notNull(),
  serverPushEnabled: boolean("serverPushEnabled").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("http2_connections_status_idx").on(table.status)]);
export const coalescingRules = pgTable("coalescing_rules", {
  id: serial("id").primaryKey(),
  route: varchar("route", { length: 200 }).notNull(),
  windowMs: integer("windowMs").default(0),
  coalescedRequests24h: bigint("coalescedRequests24h", { mode: "number" }).default(0),
  uniqueRequests24h: bigint("uniqueRequests24h", { mode: "number" }).default(0),
  savingsRatio: varchar("savingsRatio", { length: 10 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("coalescing_rules_status_idx").on(table.status)]);
export const fastJsonSchemas = pgTable("fast_json_schemas", {
  id: serial("id").primaryKey(),
  schemaName: varchar("schemaName", { length: 100 }).notNull(),
  compiledSizeBytes: integer("compiledSizeBytes").default(0),
  serializationsPerSec: integer("serializationsPerSec").default(0),
  avgSerializeNs: integer("avgSerializeNs").default(0),
  speedup: varchar("speedup", { length: 10 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("fast_json_schemas_status_idx").on(table.status)]);
export const swCacheStrategies = pgTable("sw_cache_strategies", {
  id: serial("id").primaryKey(),
  pattern: varchar("pattern", { length: 200 }).notNull(),
  strategy: varchar("strategy", { length: 50 }).notNull(),
  maxAge: integer("maxAge").default(0),
  cacheHitRate: varchar("cacheHitRate", { length: 20 }).notNull(),
  offlineCapable: boolean("offlineCapable").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("sw_cache_strategies_status_idx").on(table.status)]);
export const virtualScrollConfigs = pgTable("virtual_scroll_configs", {
  id: serial("id").primaryKey(),
  tableName: varchar("tableName", { length: 100 }).notNull(),
  totalRows: bigint("totalRows", { mode: "number" }).default(0),
  viewportRows: integer("viewportRows").default(0),
  renderTimeMs: real("renderTimeMs").default(0),
  scrollFps: integer("scrollFps").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("virtual_scroll_configs_status_idx").on(table.status)]);
export const memoizationTargets = pgTable("memoization_targets", {
  id: serial("id").primaryKey(),
  component: varchar("component", { length: 100 }).notNull(),
  rerendersPer60s: integer("rerendersPer60s").default(0),
  estimatedSavingPct: varchar("estimatedSavingPct", { length: 10 }).notNull(),
  recommendation: varchar("recommendation", { length: 200 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("memoization_targets_status_idx").on(table.status)]);
export const bundleSplitConfigs = pgTable("bundle_split_configs", {
  id: serial("id").primaryKey(),
  chunk: varchar("chunk", { length: 100 }).notNull(),
  routes: integer("routes").default(0),
  sizeKB: integer("sizeKB").default(0),
  loadTimeMs: integer("loadTimeMs").default(0),
  preloadHint: varchar("preloadHint", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("bundle_split_configs_status_idx").on(table.status)]);
export const optimisticUIConfigs = pgTable("optimistic_ui_configs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 50 }).notNull(),
  endpoint: varchar("endpoint", { length: 200 }).notNull(),
  rollbackOnError: boolean("rollbackOnError").default(false),
  successRate: varchar("successRate", { length: 10 }).notNull(),
  perceivedLatencyMs: integer("perceivedLatencyMs").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("optimistic_ui_configs_status_idx").on(table.status)]);
export const kafkaConsumerGroups = pgTable("kafka_consumer_groups", {
  id: serial("id").primaryKey(),
  groupId: varchar("groupId", { length: 100 }).notNull(),
  topic: varchar("topic", { length: 100 }).notNull(),
  partitions: integer("partitions").default(0),
  consumers: integer("consumers").default(0),
  lag: bigint("lag", { mode: "number" }).default(0),
  throughputMps: integer("throughputMps").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("kafka_consumer_groups_status_idx").on(table.status)]);
export const kafkaBatchProducers = pgTable("kafka_batch_producers", {
  id: serial("id").primaryKey(),
  topic: varchar("topic", { length: 100 }).notNull(),
  lingerMs: integer("lingerMs").default(0),
  batchSizeKB: integer("batchSizeKB").default(0),
  compressionType: varchar("compressionType", { length: 20 }).notNull(),
  throughputMps: integer("throughputMps").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("kafka_batch_producers_status_idx").on(table.status)]);
export const avroSchemas = pgTable("avro_schemas", {
  id: serial("id").primaryKey(),
  subject: varchar("subject", { length: 100 }).notNull(),
  version: integer("version").default(0),
  compatibilityMode: varchar("compatibilityMode", { length: 20 }).notNull(),
  serializedSizeBytes: integer("serializedSizeBytes").default(0),
  compressionRatio: varchar("compressionRatio", { length: 10 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("avro_schemas_status_idx").on(table.status)]);
export const fluvioSmartModules = pgTable("fluvio_smart_modules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  moduleType: varchar("moduleType", { length: 20 }).notNull(),
  wasmSizeKB: integer("wasmSizeKB").default(0),
  avgLatencyUs: integer("avgLatencyUs").default(0),
  throughputEps: integer("throughputEps").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("fluvio_smart_modules_status_idx").on(table.status)]);
export const eventDedupConfigs = pgTable("event_dedup_configs", {
  id: serial("id").primaryKey(),
  topic: varchar("topic", { length: 100 }).notNull(),
  windowMs: integer("windowMs").default(0),
  strategy: varchar("strategy", { length: 30 }).notNull(),
  duplicatesBlocked24h: bigint("duplicatesBlocked24h", { mode: "number" }).default(0),
  totalEvents24h: bigint("totalEvents24h", { mode: "number" }).default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("event_dedup_configs_status_idx").on(table.status)]);
export const distrolessImages = pgTable("distroless_images", {
  id: serial("id").primaryKey(),
  service: varchar("service", { length: 100 }).notNull(),
  baseImage: varchar("baseImage", { length: 200 }).notNull(),
  imageSizeMB: real("imageSizeMB").default(0),
  previousSizeMB: real("previousSizeMB").default(0),
  reductionPct: varchar("reductionPct", { length: 10 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("distroless_images_status_idx").on(table.status)]);
export const tbBatchConfigs = pgTable("tb_batch_configs", {
  id: serial("id").primaryKey(),
  batchSize: integer("batchSize").default(0),
  avgBatchLatencyMs: real("avgBatchLatencyMs").default(0),
  throughputTps: integer("throughputTps").default(0),
  transfersProcessed24h: bigint("transfersProcessed24h", { mode: "number" }).default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("tb_batch_configs_status_idx").on(table.status)]);
export const hpaConfigs = pgTable("hpa_configs", {
  id: serial("id").primaryKey(),
  deployment: varchar("deployment", { length: 100 }).notNull(),
  minReplicas: integer("minReplicas").default(0),
  maxReplicas: integer("maxReplicas").default(0),
  currentReplicas: integer("currentReplicas").default(0),
  cpuTargetPct: integer("cpuTargetPct").default(0),
  customMetric: varchar("customMetric", { length: 200 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("hpa_configs_status_idx").on(table.status)]);
export const cdnEdgeConfigs = pgTable("cdn_edge_configs", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull(),
  origin: varchar("origin", { length: 200 }).notNull(),
  ttlStatic: integer("ttlStatic").default(0),
  ttlApi: integer("ttlApi").default(0),
  brotliEnabled: boolean("brotliEnabled").default(false),
  bandwidthSaved24h: varchar("bandwidthSaved24h", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("cdn_edge_configs_status_idx").on(table.status)]);
export const readReplicaConfigs = pgTable("read_replica_configs", {
  id: serial("id").primaryKey(),
  replicaHost: varchar("replicaHost", { length: 100 }).notNull(),
  lagMs: integer("lagMs").default(0),
  queriesRouted24h: bigint("queriesRouted24h", { mode: "number" }).default(0),
  loadPct: integer("loadPct").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("read_replica_configs_status_idx").on(table.status)]);
export const kedaScaleTriggers = pgTable("keda_scale_triggers", {
  id: serial("id").primaryKey(),
  scaleObject: varchar("scaleObject", { length: 100 }).notNull(),
  trigger: varchar("trigger", { length: 30 }).notNull(),
  metric: varchar("metric", { length: 50 }).notNull(),
  threshold: integer("threshold").default(0),
  currentReplicas: integer("currentReplicas").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("keda_scale_triggers_status_idx").on(table.status)]);
export const prometheusDashboards = pgTable("prometheus_dashboards", {
  id: serial("id").primaryKey(),
  dashboard: varchar("dashboard", { length: 100 }).notNull(),
  panels: integer("panels").default(0),
  refreshInterval: varchar("refreshInterval", { length: 10 }).notNull(),
  alertRules: integer("alertRules").default(0),
  dataSourceRetention: varchar("dataSourceRetention", { length: 10 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("prometheus_dashboards_status_idx").on(table.status)]);
export const opensearchIndexConfigs = pgTable("opensearch_index_configs", {
  id: serial("id").primaryKey(),
  indexName: varchar("indexName", { length: 100 }).notNull(),
  shards: integer("shards").default(0),
  replicas: integer("replicas").default(0),
  avgQueryMs: real("avgQueryMs").default(0),
  resultCacheEnabled: boolean("resultCacheEnabled").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("opensearch_index_configs_status_idx").on(table.status)]);
export const temporalMemoizedActivities = pgTable("temporal_memoized_activities", {
  id: serial("id").primaryKey(),
  workflow: varchar("workflow", { length: 100 }).notNull(),
  activity: varchar("activity", { length: 100 }).notNull(),
  replaySpeedup: varchar("replaySpeedup", { length: 10 }).notNull(),
  cacheTTL: varchar("cacheTTL", { length: 20 }).notNull(),
  cacheHitRate: varchar("cacheHitRate", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("temporal_memoized_activities_status_idx").on(table.status)]);
export const apisixPluginChains = pgTable("apisix_plugin_chains", {
  id: serial("id").primaryKey(),
  route: varchar("route", { length: 200 }).notNull(),
  avgLatencyMs: real("avgLatencyMs").default(0),
  latencySaving: varchar("latencySaving", { length: 10 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("apisix_plugin_chains_status_idx").on(table.status)]);

// ─── AML Enhancement Tables (15) ───────────────────────
export const amlRiskScores = pgTable("aml_risk_scores", {

  id: serial("id").primaryKey(),
  customerId: varchar("customerId", { length: 50 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  riskScore: integer("riskScore").default(0),
  riskLevel: varchar("riskLevel", { length: 20 }).notNull(),
  sanctionsHits: integer("sanctionsHits").default(0),
  pepMatch: boolean("pepMatch").default(false),
  adverseMedia: integer("adverseMedia").default(0),
  cddLevel: varchar("cddLevel", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("aml_risk_scores_status_idx").on(table.status)]);
export const sarReports = pgTable("sar_reports_aml", {

  id: serial("id").primaryKey(),
  customerId: varchar("customerId", { length: 50 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  reportType: varchar("reportType", { length: 10 }).notNull(),
  reason: text("reason").notNull(),
  amount: bigint("amount", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 5 }).notNull(),
  nfiuReference: varchar("nfiuReference", { length: 50 }).notNull(),
  priority: varchar("priority", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("sar_reports_aml_status_idx").on(table.status)]);
export const ctrReports = pgTable("ctr_reports_aml", {

  id: serial("id").primaryKey(),
  customerId: varchar("customerId", { length: 50 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  transactionId: varchar("transactionId", { length: 50 }).notNull(),
  amount: bigint("amount", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 5 }).notNull(),
  transactionType: varchar("transactionType", { length: 30 }).notNull(),
  nfiuReference: varchar("nfiuReference", { length: 50 }).notNull(),
  autoFiled: boolean("autoFiled").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("ctr_reports_aml_status_idx").on(table.status)]);
export const amlCases = pgTable("aml_cases", {

  id: serial("id").primaryKey(),
  customerId: varchar("customerId", { length: 50 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  caseType: varchar("caseType", { length: 30 }).notNull(),
  riskLevel: varchar("riskLevel", { length: 20 }).notNull(),
  assignedTo: varchar("assignedTo", { length: 100 }).notNull(),
  sarFiled: boolean("sarFiled").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("aml_cases_status_idx").on(table.status)]);
export const watchlistSources = pgTable("watchlist_sources", {

  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  format: varchar("format", { length: 20 }).notNull(),
  entries: integer("entries").default(0),
  syncFrequency: varchar("syncFrequency", { length: 20 }).notNull(),
  autoSync: boolean("autoSync").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("watchlist_sources_status_idx").on(table.status)]);
export const adverseMediaScans = pgTable("adverse_media_scans", {

  id: serial("id").primaryKey(),
  customerId: varchar("customerId", { length: 50 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  relevantArticles: integer("relevantArticles").default(0),
  sentiment: varchar("sentiment", { length: 20 }).notNull(),
  riskImpact: varchar("riskImpact", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("adverse_media_scans_status_idx").on(table.status)]);
export const beneficialOwners = pgTable("beneficial_owners", {

  id: serial("id").primaryKey(),
  entityId: varchar("entityId", { length: 50 }).notNull(),
  entityName: varchar("entityName", { length: 200 }).notNull(),
  entityType: varchar("entityType", { length: 30 }).notNull(),
  rcNumber: varchar("rcNumber", { length: 30 }).notNull(),
  totalLayers: integer("totalLayers").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("beneficial_owners_status_idx").on(table.status)]);
export const txnPatternAnalyses = pgTable("txn_pattern_analyses", {

  id: serial("id").primaryKey(),
  customerId: varchar("customerId", { length: 50 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  anomalyScore: real("anomalyScore").default(0),
  baselineDeviation: varchar("baselineDeviation", { length: 20 }).notNull(),
  recommendation: varchar("recommendation", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("txn_pattern_analyses_status_idx").on(table.status)]);
export const goamlReports = pgTable("goaml_reports", {

  id: serial("id").primaryKey(),
  reportType: varchar("reportType", { length: 10 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  amount: bigint("amount", { mode: "number" }).default(0),
  nfiuAcknowledgement: varchar("nfiuAcknowledgement", { length: 50 }).notNull(),
  xmlValidated: boolean("xmlValidated").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("goaml_reports_status_idx").on(table.status)]);
export const amlComplianceMetrics = pgTable("aml_compliance_metrics", {

  id: serial("id").primaryKey(),
  period: varchar("period", { length: 20 }).notNull(),
  totalScreenings: integer("totalScreenings").default(0),
  sarsFiled: integer("sarsFiled").default(0),
  ctrsFiled: integer("ctrsFiled").default(0),
  complianceScore: integer("complianceScore").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("aml_compliance_metrics_status_idx").on(table.status)]);
export const sanctionsBatchRuns = pgTable("sanctions_batch_runs", {

  id: serial("id").primaryKey(),
  triggerType: varchar("triggerType", { length: 30 }).notNull(),
  customersScreened: integer("customersScreened").default(0),
  newMatches: integer("newMatches").default(0),
  processingTimeMin: integer("processingTimeMin").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("sanctions_batch_runs_status_idx").on(table.status)]);
export const amlTrainingRecords = pgTable("aml_training_records", {

  id: serial("id").primaryKey(),
  staffId: varchar("staffId", { length: 30 }).notNull(),
  staffName: varchar("staffName", { length: 200 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  trainingModule: varchar("trainingModule", { length: 200 }).notNull(),
  score: integer("score").default(0),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("aml_training_records_status_idx").on(table.status)]);
export const wireTransferMonitor = pgTable("wire_transfer_monitor", {

  id: serial("id").primaryKey(),
  originatorName: varchar("originatorName", { length: 200 }).notNull(),
  beneficiaryName: varchar("beneficiaryName", { length: 200 }).notNull(),
  amount: bigint("amount", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 5 }).notNull(),
  travelRuleCompliant: boolean("travelRuleCompliant").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("wire_transfer_monitor_status_idx").on(table.status)]);
export const amlRegulatoryReports = pgTable("regulatory_reports_aml", {

  id: serial("id").primaryKey(),
  reportType: varchar("reportType", { length: 50 }).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  submittedTo: varchar("submittedTo", { length: 30 }).notNull(),
  filedDate: varchar("filedDate", { length: 30 }).notNull(),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("regulatory_reports_aml_status_idx").on(table.status)]);
export const typologyMatches = pgTable("typology_matches", {

  id: serial("id").primaryKey(),
  typologyCode: varchar("typologyCode", { length: 30 }).notNull(),
  typologyName: varchar("typologyName", { length: 200 }).notNull(),
  riskLevel: varchar("riskLevel", { length: 20 }).notNull(),
  customersTriggered: integer("customersTriggered").default(0),
  autoSARGeneration: boolean("autoSARGeneration").default(false),
  status: varchar("status", { length: 30 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("typology_matches_status_idx").on(table.status)]);




// === Agriculture Enhancement Tables (40 services, ports 8589-8628) ===

export const cooperativeManagement = pgTable("cooperative_management", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("cooperative_management_tenant_idx").on(t.tenantId),
]);

export const livestockManagement = pgTable("livestock_management", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("livestock_management_tenant_idx").on(t.tenantId),
]);

export const agriInputMarketplace = pgTable("agri_input_marketplace", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("agri_input_marketplace_tenant_idx").on(t.tenantId),
]);

export const nirsalCreditGuarantee = pgTable("nirsal_credit_guarantee", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("nirsal_credit_guarantee_tenant_idx").on(t.tenantId),
]);

export const cbnAnchorBorrowers = pgTable("cbn_anchor_borrowers", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("cbn_anchor_borrowers_tenant_idx").on(t.tenantId),
]);

export const interactiveUssdAgri = pgTable("interactive_ussd_agri", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("interactive_ussd_agri_tenant_idx").on(t.tenantId),
]);

export const agriSavingsCycles = pgTable("agri_savings_cycles", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("agri_savings_cycles_tenant_idx").on(t.tenantId),
]);

export const livestockFinance = pgTable("livestock_finance", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("livestock_finance_tenant_idx").on(t.tenantId),
]);

export const commodityExchange = pgTable("commodity_exchange", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("commodity_exchange_tenant_idx").on(t.tenantId),
]);

export const agriEvoucher = pgTable("agri_evoucher", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("agri_evoucher_tenant_idx").on(t.tenantId),
]);

export const commodityPriceIntelligence = pgTable("commodity_price_intelligence", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("commodity_price_intelligence_tenant_idx").on(t.tenantId),
]);

export const satelliteCropMonitor = pgTable("satellite_crop_monitor", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("satellite_crop_monitor_tenant_idx").on(t.tenantId),
]);

export const cooperativeCreditScoring = pgTable("cooperative_credit_scoring", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("cooperative_credit_scoring_tenant_idx").on(t.tenantId),
]);

export const fisheriesAquaculture = pgTable("fisheries_aquaculture", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("fisheries_aquaculture_tenant_idx").on(t.tenantId),
]);

export const farmBoundaryMapping = pgTable("farm_boundary_mapping", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("farm_boundary_mapping_tenant_idx").on(t.tenantId),
]);

export const areaYieldIndexInsurance = pgTable("area_yield_index_insurance", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("area_yield_index_insurance_tenant_idx").on(t.tenantId),
]);

export const warehouseManagement = pgTable("warehouse_management", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("warehouse_management_tenant_idx").on(t.tenantId),
]);

export const agentFarmerOnboarding = pgTable("agent_farmer_onboarding", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("agent_farmer_onboarding_tenant_idx").on(t.tenantId),
]);

export const livestockInsurance = pgTable("livestock_insurance", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("livestock_insurance_tenant_idx").on(t.tenantId),
]);

export const equipmentLeasing = pgTable("equipment_leasing", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("equipment_leasing_tenant_idx").on(t.tenantId),
]);

export const cropYieldPrediction = pgTable("crop_yield_prediction", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("crop_yield_prediction_tenant_idx").on(t.tenantId),
]);

export const multiPerilCropInsurance = pgTable("multi_peril_crop_insurance", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("multi_peril_crop_insurance_tenant_idx").on(t.tenantId),
]);

export const agriLogistics = pgTable("agri_logistics", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("agri_logistics_tenant_idx").on(t.tenantId),
]);

export const cbnAgriReturns = pgTable("cbn_agri_returns", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("cbn_agri_returns_tenant_idx").on(t.tenantId),
]);

export const animalIdTraceability = pgTable("animal_id_traceability", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("animal_id_traceability_tenant_idx").on(t.tenantId),
]);

export const nirsalAgroGeocoop = pgTable("nirsal_agro_geocoop", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("nirsal_agro_geocoop_tenant_idx").on(t.tenantId),
]);

export const agriIotSensor = pgTable("agri_iot_sensor", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("agri_iot_sensor_tenant_idx").on(t.tenantId),
]);

export const agriReinsurance = pgTable("agri_reinsurance", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("agri_reinsurance_tenant_idx").on(t.tenantId),
]);

export const qualityCertification = pgTable("quality_certification", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("quality_certification_tenant_idx").on(t.tenantId),
]);

export const agriEsgImpact = pgTable("agri_esg_impact", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("agri_esg_impact_tenant_idx").on(t.tenantId),
]);

export const crossborderAgriTrade = pgTable("crossborder_agri_trade", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("crossborder_agri_trade_tenant_idx").on(t.tenantId),
]);

export const cooperativeMeetings = pgTable("cooperative_meetings", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("cooperative_meetings_tenant_idx").on(t.tenantId),
]);

export const cooperativeFinancials = pgTable("cooperative_financials", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("cooperative_financials_tenant_idx").on(t.tenantId),
]);

export const soilAnalysis = pgTable("soil_analysis", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("soil_analysis_tenant_idx").on(t.tenantId),
]);

export const insurancePortfolioAnalytics = pgTable("insurance_portfolio_analytics", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("insurance_portfolio_analytics_tenant_idx").on(t.tenantId),
]);

export const parametricInsuranceIot = pgTable("parametric_insurance_iot", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("parametric_insurance_iot_tenant_idx").on(t.tenantId),
]);

export const postHarvestLossTracker = pgTable("post_harvest_loss_tracker", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("post_harvest_loss_tracker_tenant_idx").on(t.tenantId),
]);

export const aggregationCenter = pgTable("aggregation_center", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("aggregation_center_tenant_idx").on(t.tenantId),
]);

export const cbnAgsmeis = pgTable("cbn_agsmeis", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("cbn_agsmeis_tenant_idx").on(t.tenantId),
]);

export const acgsfGuarantee = pgTable("acgsf_guarantee", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  region: text("region"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("acgsf_guarantee_tenant_idx").on(t.tenantId),
]);

// === Channel Banking Tables (25 services, ports 8629-8653) ===

export const voiceBankingGateway = pgTable("voice_banking_gateway", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("voice_banking_gateway_tenant_idx").on(t.tenantId),
  index("voice_banking_gateway_channel_idx").on(t.channel),
]);

export const voiceTtsNigerian = pgTable("voice_tts_nigerian", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("voice_tts_nigerian_tenant_idx").on(t.tenantId),
  index("voice_tts_nigerian_channel_idx").on(t.channel),
]);

export const voiceAsrNigerian = pgTable("voice_asr_nigerian", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("voice_asr_nigerian_tenant_idx").on(t.tenantId),
  index("voice_asr_nigerian_channel_idx").on(t.channel),
]);

export const voiceNluBanking = pgTable("voice_nlu_banking", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("voice_nlu_banking_tenant_idx").on(t.tenantId),
  index("voice_nlu_banking_channel_idx").on(t.channel),
]);

export const voiceBiometricAuth = pgTable("voice_biometric_auth", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("voice_biometric_auth_tenant_idx").on(t.tenantId),
  index("voice_biometric_auth_channel_idx").on(t.channel),
]);

export const voiceIvrMenu = pgTable("voice_ivr_menu", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("voice_ivr_menu_tenant_idx").on(t.tenantId),
  index("voice_ivr_menu_channel_idx").on(t.channel),
]);

export const voiceCallAnalytics = pgTable("voice_call_analytics", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("voice_call_analytics_tenant_idx").on(t.tenantId),
  index("voice_call_analytics_channel_idx").on(t.channel),
]);

export const voiceAgentEscalation = pgTable("voice_agent_escalation", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("voice_agent_escalation_tenant_idx").on(t.tenantId),
  index("voice_agent_escalation_channel_idx").on(t.channel),
]);

export const telegramBotGateway = pgTable("telegram_bot_gateway", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("telegram_bot_gateway_tenant_idx").on(t.tenantId),
  index("telegram_bot_gateway_channel_idx").on(t.channel),
]);

export const telegramBankingCommands = pgTable("telegram_banking_commands", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("telegram_banking_commands_tenant_idx").on(t.tenantId),
  index("telegram_banking_commands_channel_idx").on(t.channel),
]);

export const telegramNotification = pgTable("telegram_notification", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("telegram_notification_tenant_idx").on(t.tenantId),
  index("telegram_notification_channel_idx").on(t.channel),
]);

export const telegramMiniApp = pgTable("telegram_mini_app", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("telegram_mini_app_tenant_idx").on(t.tenantId),
  index("telegram_mini_app_channel_idx").on(t.channel),
]);

export const telegramKycBot = pgTable("telegram_kyc_bot", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("telegram_kyc_bot_tenant_idx").on(t.tenantId),
  index("telegram_kyc_bot_channel_idx").on(t.channel),
]);

export const whatsappBusinessGateway = pgTable("whatsapp_business_gateway", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("whatsapp_business_gateway_tenant_idx").on(t.tenantId),
  index("whatsapp_business_gateway_channel_idx").on(t.channel),
]);

export const whatsappBankingFlows = pgTable("whatsapp_banking_flows", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("whatsapp_banking_flows_tenant_idx").on(t.tenantId),
  index("whatsapp_banking_flows_channel_idx").on(t.channel),
]);

export const whatsappPaymentIntegration = pgTable("whatsapp_payment_integration", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("whatsapp_payment_integration_tenant_idx").on(t.tenantId),
  index("whatsapp_payment_integration_channel_idx").on(t.channel),
]);

export const whatsappNotification = pgTable("whatsapp_notification", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("whatsapp_notification_tenant_idx").on(t.tenantId),
  index("whatsapp_notification_channel_idx").on(t.channel),
]);

export const whatsappDocumentService = pgTable("whatsapp_document_service", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("whatsapp_document_service_tenant_idx").on(t.tenantId),
  index("whatsapp_document_service_channel_idx").on(t.channel),
]);

export const ussdBankingGateway = pgTable("ussd_banking_gateway", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("ussd_banking_gateway_tenant_idx").on(t.tenantId),
  index("ussd_banking_gateway_channel_idx").on(t.channel),
]);

export const ussdTransactionEngine = pgTable("ussd_transaction_engine", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("ussd_transaction_engine_tenant_idx").on(t.tenantId),
  index("ussd_transaction_engine_channel_idx").on(t.channel),
]);

export const ussdMultilingual = pgTable("ussd_multilingual", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("ussd_multilingual_tenant_idx").on(t.tenantId),
  index("ussd_multilingual_channel_idx").on(t.channel),
]);

export const ussdSimToolkit = pgTable("ussd_sim_toolkit", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("ussd_sim_toolkit_tenant_idx").on(t.tenantId),
  index("ussd_sim_toolkit_channel_idx").on(t.channel),
]);

export const smsBankingGateway = pgTable("sms_banking_gateway", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("sms_banking_gateway_tenant_idx").on(t.tenantId),
  index("sms_banking_gateway_channel_idx").on(t.channel),
]);

export const smsOtpService = pgTable("sms_otp_service", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("sms_otp_service_tenant_idx").on(t.tenantId),
  index("sms_otp_service_channel_idx").on(t.channel),
]);

export const smsAlertNotification = pgTable("sms_alert_notification", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  amount: doublePrecision("amount").default(0),
  channel: text("channel"),
  msisdn: text("msisdn"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("sms_alert_notification_tenant_idx").on(t.tenantId),
  index("sms_alert_notification_channel_idx").on(t.channel),
]);

// ─── KPI PERSONNEL FRAMEWORK ────────────────────────────────────────────────

export const kpiRoles = pgTable("kpi_roles", {
  id: serial("id").primaryKey(),
  roleKey: varchar("role_key", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  level: integer("level").notNull().default(2),
  reportsTo: varchar("reports_to", { length: 50 }),
  fixedRatio: integer("fixed_ratio").default(70),
  variableRatio: integer("variable_ratio").default(30),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const kpiMetrics = pgTable("kpi_metrics", {
  id: serial("id").primaryKey(),
  metricKey: varchar("metric_key", { length: 80 }).notNull().unique(),
  roleKey: varchar("role_key", { length: 50 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  unit: text("unit").notNull().default("percent"),
  direction: text("direction").notNull().default("higher_better"),
  weight: doublePrecision("weight").notNull().default(0.1),
  greenThreshold: doublePrecision("green_threshold").notNull().default(85),
  amberThreshold: doublePrecision("amber_threshold").notNull().default(60),
  frequency: text("frequency").notNull().default("daily"),
  dataSource: text("data_source"),
  sqlQuery: text("sql_query"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("kpi_metrics_role_idx").on(t.roleKey),
  index("kpi_metrics_category_idx").on(t.category),
]);

export const kpiScores = pgTable("kpi_scores", {
  id: serial("id").primaryKey(),
  metricKey: varchar("metric_key", { length: 80 }).notNull(),
  roleKey: varchar("role_key", { length: 50 }).notNull(),
  personnelId: varchar("personnel_id", { length: 50 }),
  value: doublePrecision("value").notNull(),
  normalizedScore: doublePrecision("normalized_score").notNull(),
  status: varchar("status", { length: 10 }).notNull().default("green"),
  cadence: varchar("cadence", { length: 20 }).notNull().default("daily"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("kpi_scores_metric_idx").on(t.metricKey),
  index("kpi_scores_role_idx").on(t.roleKey),
  index("kpi_scores_period_idx").on(t.periodStart),
  index("kpi_scores_cadence_idx").on(t.cadence),
]);

export const kpiCompositeScores = pgTable("kpi_composite_scores", {
  id: serial("id").primaryKey(),
  roleKey: varchar("role_key", { length: 50 }).notNull(),
  personnelId: varchar("personnel_id", { length: 50 }),
  ownScore: doublePrecision("own_score").notNull(),
  rollupScore: doublePrecision("rollup_score"),
  compositeScore: doublePrecision("composite_score").notNull(),
  status: varchar("status", { length: 10 }).notNull().default("green"),
  cadence: varchar("cadence", { length: 20 }).notNull().default("daily"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  variablePayMultiplier: doublePrecision("variable_pay_multiplier").default(1.0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("kpi_composite_role_idx").on(t.roleKey),
  index("kpi_composite_period_idx").on(t.periodStart),
]);

export const kpiNotificationRules = pgTable("kpi_notification_rules", {
  id: serial("id").primaryKey(),
  ruleKey: varchar("rule_key", { length: 50 }).notNull().unique(),
  roleKey: varchar("role_key", { length: 50 }).notNull(),
  metricKey: varchar("metric_key", { length: 80 }).notNull(),
  condition: varchar("condition", { length: 10 }).notNull(),
  thresholdValue: doublePrecision("threshold_value").notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("warning"),
  channels: jsonb("channels").notNull(),
  escalationChain: jsonb("escalation_chain"),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
  enabled: boolean("enabled").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("kpi_notification_rules_role_idx").on(t.roleKey),
]);

export const kpiNotificationEvents = pgTable("kpi_notification_events", {
  id: serial("id").primaryKey(),
  ruleKey: varchar("rule_key", { length: 50 }).notNull(),
  roleKey: varchar("role_key", { length: 50 }).notNull(),
  metricKey: varchar("metric_key", { length: 80 }).notNull(),
  currentValue: doublePrecision("current_value").notNull(),
  thresholdValue: doublePrecision("threshold_value").notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("fired"),
  message: text("message"),
  firedAt: timestamp("fired_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  acknowledgedBy: varchar("acknowledged_by", { length: 50 }),
}, (t) => [
  index("kpi_events_rule_idx").on(t.ruleKey),
  index("kpi_events_role_idx").on(t.roleKey),
  index("kpi_events_status_idx").on(t.status),
  index("kpi_events_fired_idx").on(t.firedAt),
]);

export const kpiBranches = pgTable("kpi_branches", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  revenueNgn: bigint("revenue_ngn", { mode: "number" }).default(0),
  transactionsDaily: integer("transactions_daily").default(0),
  customers: integer("customers").default(0),
  nplPct: doublePrecision("npl_pct").default(0),
  depositsNgn: bigint("deposits_ngn", { mode: "number" }).default(0),
  status: varchar("status", { length: 10 }).notNull().default("green"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("kpi_branches_state_idx").on(t.state),
  index("kpi_branches_status_idx").on(t.status),
]);

export const kpiHierarchy = pgTable("kpi_hierarchy", {
  id: serial("id").primaryKey(),
  parentRoleKey: varchar("parent_role_key", { length: 50 }).notNull(),
  childRoleKey: varchar("child_role_key", { length: 50 }).notNull(),
  rollupWeight: doublePrecision("rollup_weight").notNull().default(1.0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("kpi_hierarchy_parent_idx").on(t.parentRoleKey),
  index("kpi_hierarchy_child_idx").on(t.childRoleKey),
]);

// ─── GL → eFASS MAPPING TABLE ──────────────────────────────────────────────
// Maps GL account code ranges to CBN eFASS MBR form lines
export const efassMapping = pgTable("efassMapping", {
  id: serial("id").primaryKey(),
  glCodeStart: varchar("glCodeStart", { length: 32 }).notNull(),
  glCodeEnd: varchar("glCodeEnd", { length: 32 }).notNull(),
  mbrForm: varchar("mbrForm", { length: 16 }).notNull(),
  mbrLine: integer("mbrLine").notNull(),
  lineName: varchar("lineName", { length: 191 }).notNull(),
  reportCategory: text("reportCategory").notNull(),
  aggregationType: varchar("aggregationType", { length: 16 }).notNull().default("sum"),
  signConvention: varchar("signConvention", { length: 8 }).notNull().default("normal"),
  cbnCode: varchar("cbnCode", { length: 32 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  efassMbrIdx: index("efass_mbr_idx").on(table.mbrForm, table.mbrLine),
  efassGlRangeIdx: index("efass_gl_range_idx").on(table.glCodeStart, table.glCodeEnd),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// GROWTH FEATURES TABLES (Enhancement 13-20)
// ═══════════════════════════════════════════════════════════════════════════════

export const chatbotIntents = pgTable("chatbot_intents", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-lagos-main"),
  intent: text("intent").notNull(),
  category: text("category").notNull(),
  confidenceThreshold: real("confidence_threshold").default(0.85),
  responses: integer("responses").default(0),
  avgConfidence: real("avg_confidence").default(0.92),
  escalationRate: real("escalation_rate").default(0.05),
  channel: text("channel").default("all"),
  language: text("language").default("en"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const smartSavingsGoals = pgTable("smart_savings_goals", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-lagos-main"),
  customerId: text("customer_id").notNull(),
  goalName: text("goal_name").notNull(),
  goalType: text("goal_type").notNull(),
  targetAmount: real("target_amount").notNull(),
  currentAmount: real("current_amount").default(0),
  currency: text("currency").default("NGN"),
  autoDebitAmount: real("auto_debit_amount"),
  frequency: text("frequency").default("monthly"),
  startDate: timestamp("start_date").defaultNow(),
  targetDate: timestamp("target_date"),
  interestRate: real("interest_rate").default(12.0),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const virtualCards = pgTable("virtual_cards", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-lagos-main"),
  customerId: text("customer_id").notNull(),
  cardType: text("card_type").notNull(),
  cardScheme: text("card_scheme").notNull(),
  maskedPan: text("masked_pan").notNull(),
  expiryDate: text("expiry_date").notNull(),
  spendLimit: real("spend_limit").notNull(),
  currentSpend: real("current_spend").default(0),
  currency: text("currency").default("NGN"),
  isFrozen: boolean("is_frozen").default(false),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const qrPaymentTransactions = pgTable("qr_payment_transactions", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-lagos-main"),
  merchantName: text("merchant_name").notNull(),
  merchantId: text("merchant_id").notNull(),
  amount: real("amount").notNull(),
  qrType: text("qr_type").notNull(),
  channel: text("channel").default("NQR"),
  customerAccount: text("customer_account"),
  settlementTime: text("settlement_time").default("T+0"),
  fee: real("fee").default(0),
  status: text("status").default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bnplOrders = pgTable("bnpl_orders", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-lagos-main"),
  customerId: text("customer_id").notNull(),
  merchantName: text("merchant_name").notNull(),
  orderAmount: real("order_amount").notNull(),
  product: text("product").notNull(),
  installments: integer("installments").notNull(),
  installmentAmount: real("installment_amount").notNull(),
  interestRate: real("interest_rate").default(0),
  paidInstallments: integer("paid_installments").default(0),
  nextDueDate: timestamp("next_due_date"),
  creditScore: integer("credit_score"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const investmentOrders = pgTable("investment_orders", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-lagos-main"),
  customerId: text("customer_id").notNull(),
  productType: text("product_type").notNull(),
  productName: text("product_name").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").default("NGN"),
  expectedReturn: real("expected_return"),
  tenor: integer("tenor"),
  maturityDate: timestamp("maturity_date"),
  currentValue: real("current_value"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const remittanceTransactions = pgTable("remittance_transactions", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-lagos-main"),
  corridor: text("corridor").notNull(),
  senderName: text("sender_name").notNull(),
  senderCountry: text("sender_country").notNull(),
  receiverName: text("receiver_name").notNull(),
  receiverCountry: text("receiver_country").default("NG"),
  sendAmount: real("send_amount").notNull(),
  sendCurrency: text("send_currency").notNull(),
  receiveAmount: real("receive_amount").notNull(),
  receiveCurrency: text("receive_currency").default("NGN"),
  fxRate: real("fx_rate").notNull(),
  fee: real("fee").default(0),
  partner: text("partner").notNull(),
  status: text("status").default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rewardsAccounts = pgTable("rewards_accounts", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-lagos-main"),
  customerId: text("customer_id").notNull(),
  tier: text("tier").default("Bronze"),
  totalPoints: integer("total_points").default(0),
  availablePoints: integer("available_points").default(0),
  lifetimePoints: integer("lifetime_points").default(0),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  badges: text("badges").default("[]"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Liveness Detection Schema ──────────────────────────────────────────────

export const livenessChecks = pgTable("liveness_checks", {
  id: serial("id").primaryKey(),
  checkId: text("check_id").notNull().unique(),
  tenantId: text("tenant_id").notNull().default("default"),
  customerId: text("customer_id").notNull(),
  sessionId: text("session_id").notNull(),
  mode: text("mode").notNull().default("hybrid"), // passive, active, hybrid
  isLive: boolean("is_live").notNull(),
  overallScore: real("overall_score").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  verdict: text("verdict").notNull(), // LIVE, SPOOF
  methodScores: jsonb("method_scores").default("{}"),
  deepfakeProbability: real("deepfake_probability").default(0),
  faceDetected: boolean("face_detected").default(true),
  faceQuality: real("face_quality").default(0),
  headPoseYaw: real("head_pose_yaw").default(0),
  headPosePitch: real("head_pose_pitch").default(0),
  headPoseRoll: real("head_pose_roll").default(0),
  devicePlatform: text("device_platform"),
  deviceModel: text("device_model"),
  ipAddress: text("ip_address"),
  challengeType: text("challenge_type"),
  challengesPassed: integer("challenges_passed").default(0),
  challengesTotal: integer("challenges_total").default(0),
  processingTimeMs: real("processing_time_ms"),
  kafkaEventId: text("kafka_event_id"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => [
  index("liveness_checks_customer_idx").on(t.customerId),
  index("liveness_checks_tenant_idx").on(t.tenantId),
  index("liveness_checks_session_idx").on(t.sessionId),
  index("liveness_checks_verdict_idx").on(t.verdict),
]);

export const faceMatches = pgTable("face_matches", {
  id: serial("id").primaryKey(),
  matchId: text("match_id").notNull().unique(),
  tenantId: text("tenant_id").notNull().default("default"),
  customerId: text("customer_id").notNull(),
  matched: boolean("matched").notNull(),
  similarityScore: real("similarity_score").notNull(),
  embeddingDistance: real("embedding_distance"),
  face1Quality: real("face1_quality"),
  face2Quality: real("face2_quality"),
  ageEstimation: integer("age_estimation"),
  genderEstimation: text("gender_estimation"),
  headPoseDiff: real("head_pose_diff"),
  glassesDetected: boolean("glasses_detected").default(false),
  maskDetected: boolean("mask_detected").default(false),
  purpose: text("purpose").default("kyc_onboarding"), // kyc_onboarding, transaction_auth, periodic_reverify
  processingTimeMs: real("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("face_matches_customer_idx").on(t.customerId),
  index("face_matches_tenant_idx").on(t.tenantId),
  index("face_matches_matched_idx").on(t.matched),
]);

export const antiSpoofingResults = pgTable("anti_spoofing_results", {
  id: serial("id").primaryKey(),
  resultId: text("result_id").notNull().unique(),
  tenantId: text("tenant_id").notNull().default("default"),
  customerId: text("customer_id").notNull(),
  livenessCheckId: text("liveness_check_id").notNull(),
  isSpoof: boolean("is_spoof").notNull(),
  spoofType: text("spoof_type").notNull().default("none"), // printed_photo, screen_replay, paper_mask, 3d_mask, deepfake, high_quality_photo, none
  overallConfidence: real("overall_confidence").notNull(),
  textureLbpScore: real("texture_lbp_score"),
  monocularDepthScore: real("monocular_depth_score"),
  frequencyFftScore: real("frequency_fft_score"),
  edgeBoundaryScore: real("edge_boundary_score"),
  moireDetected: boolean("moire_detected").default(false),
  reflectionAnomaly: boolean("reflection_anomaly").default(false),
  deepfakeProbability: real("deepfake_probability").default(0),
  modelVersion: text("model_version").default("v1.0"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("anti_spoofing_customer_idx").on(t.customerId),
  index("anti_spoofing_tenant_idx").on(t.tenantId),
  index("anti_spoofing_check_idx").on(t.livenessCheckId),
  index("anti_spoofing_spoof_type_idx").on(t.spoofType),
]);

export const livenessEvents = pgTable("liveness_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(), // session_created, frame_submitted, challenge_passed, session_completed, face_match_completed
  sessionId: text("session_id"),
  customerId: text("customer_id").notNull(),
  tenantId: text("tenant_id").notNull().default("default"),
  payload: jsonb("payload").default("{}"),
  kafkaTopic: text("kafka_topic"),
  kafkaPartition: integer("kafka_partition").default(0),
  kafkaOffset: bigint("kafka_offset", { mode: "number" }),
  publishedAt: timestamp("published_at").defaultNow(),
}, (t) => [
  index("liveness_events_session_idx").on(t.sessionId),
  index("liveness_events_customer_idx").on(t.customerId),
  index("liveness_events_type_idx").on(t.eventType),
]);

export const facialLandmarks = pgTable("facial_landmarks", {
  id: serial("id").primaryKey(),
  landmarkId: text("landmark_id").notNull().unique(),
  customerId: text("customer_id").notNull(),
  livenessCheckId: text("liveness_check_id"),
  landmarkCount: integer("landmark_count").default(68),
  landmarks: jsonb("landmarks").default("[]"), // Array of {index, x, y, confidence, region}
  faceQuality: real("face_quality"),
  interEyeDistance: real("inter_eye_distance"),
  faceAreaRatio: real("face_area_ratio"),
  headPose: jsonb("head_pose").default("{}"), // {yaw, pitch, roll}
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("facial_landmarks_customer_idx").on(t.customerId),
  index("facial_landmarks_check_idx").on(t.livenessCheckId),
]);

export const faceEmbeddings = pgTable("face_embeddings", {
  id: serial("id").primaryKey(),
  embeddingId: text("embedding_id").notNull().unique(),
  customerId: text("customer_id").notNull(),
  tenantId: text("tenant_id").notNull().default("default"),
  embedding: jsonb("embedding").notNull(), // 512-dim float vector
  embeddingNorm: real("embedding_norm").default(1.0),
  model: text("model").default("arcface_r100"),
  faceQuality: real("face_quality"),
  isEnrolled: boolean("is_enrolled").default(false), // true = reference face for matching
  purpose: text("purpose").default("enrollment"), // enrollment, verification, update
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("face_embeddings_customer_idx").on(t.customerId),
  index("face_embeddings_tenant_idx").on(t.tenantId),
  index("face_embeddings_enrolled_idx").on(t.isEnrolled),
]);

// ─── KYC/KYB Enforcement Schema ─────────────────────────────────────────────

export const kycEnforcementVerifications = pgTable("kyc_enforcement_verifications", {
  id: serial("id").primaryKey(),
  verificationId: text("verification_id").notNull().unique(),
  customerId: text("customer_id").notNull(),
  tenantId: text("tenant_id").notNull().default("default"),
  level: text("level").notNull(), // basic, standard, enhanced, full_edd
  status: text("status").notNull().default("pending"), // pending, verified, expired, rejected
  bvnVerified: boolean("bvn_verified").default(false),
  ninVerified: boolean("nin_verified").default(false),
  livenessVerified: boolean("liveness_verified").default(false),
  documentsVerified: boolean("documents_verified").default(false),
  sanctionsCleared: boolean("sanctions_cleared").default(false),
  riskScore: integer("risk_score"),
  assignedTier: text("assigned_tier"), // tier1, tier2, tier3
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("kyc_verifications_customer_idx").on(t.customerId),
  index("kyc_verifications_status_idx").on(t.status),
  index("kyc_verifications_level_idx").on(t.level),
  index("kyc_verifications_tenant_idx").on(t.tenantId),
]);

export const kybEnforcementVerifications = pgTable("kyb_enforcement_verifications", {
  id: serial("id").primaryKey(),
  verificationId: text("verification_id").notNull().unique(),
  companyId: text("company_id").notNull(),
  rcNumber: text("rc_number"),
  tenantId: text("tenant_id").notNull().default("default"),
  level: text("level").notNull(), // basic, standard, enhanced, full_edd
  status: text("status").notNull().default("pending"),
  cacVerified: boolean("cac_verified").default(false),
  tinVerified: boolean("tin_verified").default(false),
  uboVerified: boolean("ubo_verified").default(false),
  directorScreened: boolean("director_screened").default(false),
  sanctionsCleared: boolean("sanctions_cleared").default(false),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("kyb_verifications_company_idx").on(t.companyId),
  index("kyb_verifications_status_idx").on(t.status),
  index("kyb_verifications_tenant_idx").on(t.tenantId),
]);

export const kycEnforcementLog = pgTable("kyc_enforcement_log", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  serviceId: text("service_id").notNull(),
  path: text("path").notNull(),
  method: text("method").notNull(),
  customerId: text("customer_id"),
  companyId: text("company_id"),
  decision: text("decision").notNull(), // allowed, blocked, monitored
  reason: text("reason"),
  kycLevel: text("kyc_level"),
  requiredLevel: text("required_level"),
  tenantId: text("tenant_id").notNull().default("default"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("kyc_enforcement_log_service_idx").on(t.serviceId),
  index("kyc_enforcement_log_decision_idx").on(t.decision),
  index("kyc_enforcement_log_customer_idx").on(t.customerId),
]);

export const kycEventTriggers = pgTable("kyc_event_triggers", {
  id: serial("id").primaryKey(),
  triggerId: text("trigger_id").notNull().unique(),
  eventTopic: text("event_topic").notNull(),
  eventName: text("event_name").notNull(),
  customerId: text("customer_id"),
  companyId: text("company_id"),
  kycLevel: text("kyc_level").notNull(),
  kybRequired: boolean("kyb_required").default(false),
  status: text("status").notNull().default("triggered"), // triggered, processing, completed, failed
  triggerSource: text("trigger_source"),
  integratedServices: jsonb("integrated_services"),
  eventData: jsonb("event_data"),
  tenantId: text("tenant_id").notNull().default("default"),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => [
  index("kyc_event_triggers_topic_idx").on(t.eventTopic),
  index("kyc_event_triggers_customer_idx").on(t.customerId),
  index("kyc_event_triggers_status_idx").on(t.status),
]);


