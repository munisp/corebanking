import { desc, eq } from "drizzle-orm";

import { getDb } from "./db";
import {
  billingAccounts,
  billingAccrualSnapshots,
  billingContractOverrides,
  billingDiscountRules,
  billingInvoiceApprovals,
  billingInvoiceLines,
  billingInvoices,
  billingRateCardLines,
  billingRateCards,
  billingRatedEvents,
  billingRevenueShareRules,
  billingUsageEvents,
} from "../drizzle/schema";
import {
  buildAccrualSnapshots,
  buildBillingDashboard,
  buildInvoices,
  defaultBillingAccounts,
  defaultBillingAccrualSnapshots,
  defaultBillingContractOverrides,
  defaultBillingDiscountRules,
  defaultBillingInvoiceApprovals,
  defaultBillingInvoiceLines,
  defaultBillingInvoices,
  defaultBillingRateCardLines,
  defaultBillingRateCards,
  defaultBillingRevenueShareRules,
  defaultBillingUsageEvents,
  nextBusinessDayIso,
  rateUsageEvent,
  seedRatedEvents,
  type BillingAccrualSnapshot,
  type BillingAccount,
  type BillingContractOverride,
  type BillingDashboard,
  type BillingDiscountRule,
  type BillingInvoice,
  type BillingInvoiceApproval,
  type BillingInvoiceLine,
  type BillingPeriodType,
  type BillingRateCard,
  type BillingRateCardLine,
  type BillingRatedEvent,
  type BillingRevenueShareRule,
  type BillingUsageEvent,
  type BillingUsageEventInput,
} from "../shared/billingEngine";

function toIso(value?: Date | string | null) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function nextId(prefix: string, currentCount: number) {
  return `${prefix}-${String(currentCount + 1).padStart(3, "0")}`;
}

function mapAccount(row: typeof billingAccounts.$inferSelect): BillingAccount {
  return ({
    id: row.billingAccountId,
    tenantId: row.tenantId,
    accountName: row.accountName,
    billingModel: row.billingModel,
    currency: row.currency,
    status: row.status,
    contractStartAt: toIso(row.contractStartAt)!,
    contractEndAt: toIso(row.contractEndAt),
    defaultRateCardId: row.defaultRateCardId,
    minimumCommitAmount: row.minimumCommitAmount,
    defaultBillingPeriodType: row.defaultBillingPeriodType,
    invoiceDueDays: row.invoiceDueDays,
  }) as unknown as BillingAccount;
}

function mapRateCard(row: typeof billingRateCards.$inferSelect): BillingRateCard {
  return ({
    id: row.rateCardId,
    billingAccountId: row.billingAccountId ?? undefined,
    name: row.name,
    version: row.version,
    status: row.status,
    effectiveFrom: toIso(row.effectiveFrom)!,
    effectiveTo: toIso(row.effectiveTo),
    pricingCurrency: row.pricingCurrency,
    createdBy: row.createdBy,
    approvalState: row.approvalState,
  }) as unknown as BillingRateCard;
}

function mapRateCardLine(row: typeof billingRateCardLines.$inferSelect): BillingRateCardLine {
  return ({
    id: row.rateCardLineId,
    rateCardId: row.rateCardId,
    meterKey: row.meterKey,
    productKey: row.productKey,
    chargeType: row.chargeType,
    unitPrice: row.unitPrice,
    includedUnits: row.includedUnits,
    tierStart: row.tierStart ?? undefined,
    tierEnd: row.tierEnd ?? undefined,
    minimumCharge: row.minimumCharge ?? undefined,
    maximumCharge: row.maximumCharge ?? undefined,
    pricingFormula: (row.pricingFormula as Record<string, unknown> | null) ?? undefined,
    settlementLedgerCode: row.settlementLedgerCode ?? undefined,
  }) as unknown as BillingRateCardLine;
}

function mapUsageEvent(row: typeof billingUsageEvents.$inferSelect): BillingUsageEvent {
  return ({
    id: row.usageEventId,
    idempotencyKey: row.idempotencyKey,
    tenantId: row.tenantId,
    billingAccountId: row.billingAccountId,
    sourceService: row.sourceService,
    sourceEventType: row.sourceEventType,
    meterKey: row.meterKey,
    productKey: row.productKey,
    quantity: row.quantity,
    unitAmount: row.unitAmount ?? undefined,
    currency: row.currency,
    eventTimestamp: toIso(row.eventTimestamp)!,
    ingestedAt: toIso(row.ingestedAt)!,
    correlationId: row.correlationId ?? undefined,
    actorId: row.actorId ?? undefined,
    resourceId: row.resourceId ?? undefined,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status,
  }) as unknown as BillingUsageEvent;
}

function mapRatedEvent(row: typeof billingRatedEvents.$inferSelect): BillingRatedEvent {
  return {
    id: row.ratedEventId,
    usageEventId: row.usageEventId,
    rateCardId: row.rateCardId,
    rateCardLineId: row.rateCardLineId,
    billingPeriodKey: row.billingPeriodKey,
    quantityRated: row.quantityRated,
    billableUnits: row.billableUnits,
    amountAccrued: row.amountAccrued,
    currency: row.currency,
    ratingExplanation: (row.ratingExplanation as Record<string, unknown>) ?? {},
    ratedAt: toIso(row.ratedAt)!,
  };
}

function mapAccrualSnapshot(row: typeof billingAccrualSnapshots.$inferSelect): BillingAccrualSnapshot {
  return ({
    id: row.accrualSnapshotId,
    tenantId: row.tenantId,
    billingAccountId: row.billingAccountId,
    billingPeriodKey: row.billingPeriodKey,
    meterKey: row.meterKey,
    productKey: row.productKey,
    ratedEventCount: row.ratedEventCount,
    usageQuantity: row.usageQuantity,
    accruedAmount: row.accruedAmount,
    unratedEventCount: row.unratedEventCount,
    lastUsageAt: toIso(row.lastUsageAt),
    lastRatedAt: toIso(row.lastRatedAt),
    snapshotStatus: row.snapshotStatus,
  }) as unknown as BillingAccrualSnapshot;
}

function mapContractOverride(row: typeof billingContractOverrides.$inferSelect): BillingContractOverride {
  return ({
    id: row.contractOverrideId,
    billingAccountId: row.billingAccountId,
    tenantId: row.tenantId,
    overrideType: row.overrideType,
    meterKey: row.meterKey ?? undefined,
    productKey: row.productKey ?? undefined,
    valueNumber: row.valueNumber ?? undefined,
    valueText: row.valueText ?? undefined,
    effectiveFrom: toIso(row.effectiveFrom)!,
    effectiveTo: toIso(row.effectiveTo),
    status: row.status,
    createdBy: row.createdBy,
    notes: row.notes ?? undefined,
  }) as unknown as BillingContractOverride;
}

function mapDiscountRule(row: typeof billingDiscountRules.$inferSelect): BillingDiscountRule {
  return ({
    id: row.discountRuleId,
    billingAccountId: row.billingAccountId,
    tenantId: row.tenantId,
    name: row.name,
    discountType: row.discountType,
    meterKey: row.meterKey ?? undefined,
    productKey: row.productKey ?? undefined,
    percentage: row.percentage ?? undefined,
    fixedAmount: row.fixedAmount ?? undefined,
    thresholdAmount: row.thresholdAmount ?? undefined,
    effectiveFrom: toIso(row.effectiveFrom)!,
    effectiveTo: toIso(row.effectiveTo),
    status: row.status,
    createdBy: row.createdBy,
  }) as unknown as BillingDiscountRule;
}

function mapRevenueShareRule(row: typeof billingRevenueShareRules.$inferSelect): BillingRevenueShareRule {
  return ({
    id: row.revenueShareRuleId,
    billingAccountId: row.billingAccountId,
    tenantId: row.tenantId,
    name: row.name,
    target: row.target,
    percentage: row.percentage,
    beneficiaryName: row.beneficiaryName,
    settlementLedgerCode: row.settlementLedgerCode ?? undefined,
    effectiveFrom: toIso(row.effectiveFrom)!,
    effectiveTo: toIso(row.effectiveTo),
    status: row.status,
    createdBy: row.createdBy,
  }) as unknown as BillingRevenueShareRule;
}

function mapInvoice(row: typeof billingInvoices.$inferSelect): BillingInvoice {
  return ({
    id: row.billingInvoiceId,
    invoiceNumber: row.invoiceNumber,
    tenantId: row.tenantId,
    billingAccountId: row.billingAccountId,
    billingPeriodKey: row.billingPeriodKey,
    billingPeriodType: row.billingPeriodType,
    periodStartAt: toIso(row.periodStartAt)!,
    periodEndAt: toIso(row.periodEndAt)!,
    currency: row.currency,
    subtotalAmount: row.subtotalAmount,
    discountAmount: row.discountAmount,
    revenueShareAmount: row.revenueShareAmount,
    minimumCommitAdjustment: row.minimumCommitAdjustment,
    taxAmount: row.taxAmount,
    totalAmount: row.totalAmount,
    status: row.status,
    approvalStatus: row.approvalStatus,
    generatedAt: toIso(row.generatedAt)!,
    dueAt: toIso(row.dueAt)!,
    approvalStepCount: row.approvalStepCount,
    issuedAt: toIso(row.issuedAt),
  }) as unknown as BillingInvoice;
}

function mapInvoiceLine(row: typeof billingInvoiceLines.$inferSelect): BillingInvoiceLine {
  return ({
    id: row.billingInvoiceLineId,
    invoiceId: row.billingInvoiceId,
    lineType: row.lineType,
    meterKey: row.meterKey ?? undefined,
    productKey: row.productKey ?? undefined,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    amount: row.amount,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  }) as unknown as BillingInvoiceLine;
}

function mapInvoiceApproval(row: typeof billingInvoiceApprovals.$inferSelect): BillingInvoiceApproval {
  return ({
    id: row.billingInvoiceApprovalId,
    invoiceId: row.billingInvoiceId,
    stageKey: row.stageKey,
    actorRole: row.actorRole,
    status: row.status,
    actedAt: toIso(row.actedAt),
    note: row.note ?? undefined,
  }) as unknown as BillingInvoiceApproval;
}

export async function ensureBillingEngineSeed() {
  const db = await getDb();
  if (!db) return false;

  const existingAccounts = await db.select({ id: billingAccounts.id }).from(billingAccounts).limit(1);
  if (existingAccounts.length > 0) {
    return true;
  }

  await db.insert(billingAccounts).values(
    defaultBillingAccounts.map((item) => ({
      billingAccountId: item.id,
      tenantId: item.tenantId,
      accountName: item.accountName,
      billingModel: item.billingModel,
      currency: item.currency,
      status: item.status,
      contractStartAt: new Date(item.contractStartAt),
      contractEndAt: item.contractEndAt ? new Date(item.contractEndAt) : null,
      defaultRateCardId: item.defaultRateCardId,
      minimumCommitAmount: item.minimumCommitAmount,
      defaultBillingPeriodType: item.defaultBillingPeriodType ?? "monthly",
      invoiceDueDays: item.invoiceDueDays ?? 14,
    })),
  );

  await db.insert(billingRateCards).values(
    defaultBillingRateCards.map((item) => ({
      rateCardId: item.id,
      billingAccountId: item.billingAccountId ?? null,
      name: item.name,
      version: item.version,
      status: item.status,
      effectiveFrom: new Date(item.effectiveFrom),
      effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
      pricingCurrency: item.pricingCurrency,
      createdBy: item.createdBy,
      approvalState: item.approvalState,
    })),
  );

  await db.insert(billingRateCardLines).values(
    defaultBillingRateCardLines.map((item) => ({
      rateCardLineId: item.id,
      rateCardId: item.rateCardId,
      meterKey: item.meterKey,
      productKey: item.productKey,
      chargeType: item.chargeType,
      unitPrice: item.unitPrice,
      includedUnits: item.includedUnits,
      tierStart: item.tierStart ?? null,
      tierEnd: item.tierEnd ?? null,
      minimumCharge: item.minimumCharge ?? null,
      maximumCharge: item.maximumCharge ?? null,
      pricingFormula: item.pricingFormula ?? null,
      settlementLedgerCode: item.settlementLedgerCode ?? null,
    })),
  );

  await db.insert(billingUsageEvents).values(
    defaultBillingUsageEvents.map((item) => ({
      usageEventId: item.id,
      idempotencyKey: item.idempotencyKey,
      tenantId: item.tenantId,
      billingAccountId: item.billingAccountId,
      sourceService: item.sourceService,
      sourceEventType: item.sourceEventType,
      meterKey: item.meterKey,
      productKey: item.productKey,
      quantity: item.quantity,
      unitAmount: item.unitAmount ?? null,
      currency: item.currency,
      eventTimestamp: new Date(item.eventTimestamp),
      ingestedAt: new Date(item.ingestedAt),
      correlationId: item.correlationId ?? null,
      actorId: item.actorId ?? null,
      resourceId: item.resourceId ?? null,
      payload: item.payload,
      status: item.status,
    })),
  );

  const seededRated = seedRatedEvents();
  await db.insert(billingRatedEvents).values(
    seededRated.map((item) => ({
      ratedEventId: item.id,
      usageEventId: item.usageEventId,
      rateCardId: item.rateCardId,
      rateCardLineId: item.rateCardLineId,
      billingPeriodKey: item.billingPeriodKey,
      quantityRated: item.quantityRated,
      billableUnits: item.billableUnits,
      amountAccrued: item.amountAccrued,
      currency: item.currency,
      ratingExplanation: item.ratingExplanation,
      ratedAt: new Date(item.ratedAt),
    })),
  );

  await db.insert(billingAccrualSnapshots).values(
    defaultBillingAccrualSnapshots.map((item) => ({
      accrualSnapshotId: item.id,
      tenantId: item.tenantId,
      billingAccountId: item.billingAccountId,
      billingPeriodKey: item.billingPeriodKey,
      meterKey: item.meterKey,
      productKey: item.productKey,
      ratedEventCount: item.ratedEventCount,
      usageQuantity: item.usageQuantity,
      accruedAmount: item.accruedAmount,
      unratedEventCount: item.unratedEventCount,
      lastUsageAt: item.lastUsageAt ? new Date(item.lastUsageAt) : null,
      lastRatedAt: item.lastRatedAt ? new Date(item.lastRatedAt) : null,
      snapshotStatus: item.snapshotStatus,
    })),
  );

  await db.insert(billingContractOverrides).values(
    defaultBillingContractOverrides.map((item) => ({
      contractOverrideId: item.id,
      billingAccountId: item.billingAccountId,
      tenantId: item.tenantId,
      overrideType: item.overrideType,
      meterKey: item.meterKey ?? null,
      productKey: item.productKey ?? null,
      valueNumber: item.valueNumber ?? null,
      valueText: item.valueText ?? null,
      effectiveFrom: new Date(item.effectiveFrom),
      effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
      status: item.status,
      createdBy: item.createdBy,
      notes: item.notes ?? null,
    })),
  );

  await db.insert(billingDiscountRules).values(
    defaultBillingDiscountRules.map((item) => ({
      discountRuleId: item.id,
      billingAccountId: item.billingAccountId,
      tenantId: item.tenantId,
      name: item.name,
      discountType: item.discountType,
      meterKey: item.meterKey ?? null,
      productKey: item.productKey ?? null,
      percentage: item.percentage ?? null,
      fixedAmount: item.fixedAmount ?? null,
      thresholdAmount: item.thresholdAmount ?? null,
      effectiveFrom: new Date(item.effectiveFrom),
      effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
      status: item.status,
      createdBy: item.createdBy,
    })),
  );

  await db.insert(billingRevenueShareRules).values(
    defaultBillingRevenueShareRules.map((item) => ({
      revenueShareRuleId: item.id,
      billingAccountId: item.billingAccountId,
      tenantId: item.tenantId,
      name: item.name,
      target: item.target,
      percentage: item.percentage,
      beneficiaryName: item.beneficiaryName,
      settlementLedgerCode: item.settlementLedgerCode ?? null,
      effectiveFrom: new Date(item.effectiveFrom),
      effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
      status: item.status,
      createdBy: item.createdBy,
    })),
  );

  await db.insert(billingInvoices).values(
    defaultBillingInvoices.map((item) => ({
      billingInvoiceId: item.id,
      invoiceNumber: item.invoiceNumber,
      tenantId: item.tenantId,
      billingAccountId: item.billingAccountId,
      billingPeriodKey: item.billingPeriodKey,
      billingPeriodType: item.billingPeriodType,
      periodStartAt: new Date(item.periodStartAt),
      periodEndAt: new Date(item.periodEndAt),
      currency: item.currency,
      subtotalAmount: item.subtotalAmount,
      discountAmount: item.discountAmount,
      revenueShareAmount: item.revenueShareAmount,
      minimumCommitAdjustment: item.minimumCommitAdjustment,
      taxAmount: item.taxAmount,
      totalAmount: item.totalAmount,
      status: item.status,
      approvalStatus: item.approvalStatus,
      generatedAt: new Date(item.generatedAt),
      dueAt: new Date(item.dueAt),
      approvalStepCount: item.approvalStepCount,
      issuedAt: item.issuedAt ? new Date(item.issuedAt) : null,
    })),
  );

  await db.insert(billingInvoiceLines).values(
    defaultBillingInvoiceLines.map((item) => ({
      billingInvoiceLineId: item.id,
      billingInvoiceId: item.invoiceId,
      lineType: item.lineType,
      meterKey: item.meterKey ?? null,
      productKey: item.productKey ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      metadata: item.metadata ?? null,
    })),
  );

  await db.insert(billingInvoiceApprovals).values(
    defaultBillingInvoiceApprovals.map((item) => ({
      billingInvoiceApprovalId: item.id,
      billingInvoiceId: item.invoiceId,
      stageKey: item.stageKey,
      actorRole: item.actorRole,
      status: item.status,
      actedAt: item.actedAt ? new Date(item.actedAt) : null,
      note: item.note ?? null,
    })),
  );

  return true;
}

export async function listBillingAccounts() {
  const db = await getDb();
  if (!db) return defaultBillingAccounts;
  const rows = await db.select().from(billingAccounts).orderBy(desc(billingAccounts.updatedAt));
  return rows.map(mapAccount);
}

export async function listBillingRateCards() {
  const db = await getDb();
  if (!db) return defaultBillingRateCards;
  const rows = await db.select().from(billingRateCards).orderBy(desc(billingRateCards.updatedAt));
  return rows.map(mapRateCard);
}

export async function listBillingRateCardLines() {
  const db = await getDb();
  if (!db) return defaultBillingRateCardLines;
  const rows = await db.select().from(billingRateCardLines).orderBy(desc(billingRateCardLines.updatedAt));
  return rows.map(mapRateCardLine);
}

export async function listBillingUsageEvents(limit = 50) {
  const db = await getDb();
  if (!db) return defaultBillingUsageEvents.slice(0, limit);
  const rows = await db.select().from(billingUsageEvents).orderBy(desc(billingUsageEvents.eventTimestamp)).limit(limit);
  return rows.map(mapUsageEvent);
}

export async function listBillingRatedEvents(limit = 100) {
  const db = await getDb();
  if (!db) return seedRatedEvents().slice(0, limit);
  const rows = await db.select().from(billingRatedEvents).orderBy(desc(billingRatedEvents.ratedAt)).limit(limit);
  return rows.map(mapRatedEvent);
}

export async function listBillingAccrualSnapshots() {
  const db = await getDb();
  if (!db) return defaultBillingAccrualSnapshots;
  const rows = await db.select().from(billingAccrualSnapshots).orderBy(desc(billingAccrualSnapshots.updatedAt));
  return rows.map(mapAccrualSnapshot);
}

export async function listBillingContractOverrides() {
  const db = await getDb();
  if (!db) return defaultBillingContractOverrides;
  const rows = await db.select().from(billingContractOverrides).orderBy(desc(billingContractOverrides.updatedAt));
  return rows.map(mapContractOverride);
}

export async function listBillingDiscountRules() {
  const db = await getDb();
  if (!db) return defaultBillingDiscountRules;
  const rows = await db.select().from(billingDiscountRules).orderBy(desc(billingDiscountRules.updatedAt));
  return rows.map(mapDiscountRule);
}

export async function listBillingRevenueShareRules() {
  const db = await getDb();
  if (!db) return defaultBillingRevenueShareRules;
  const rows = await db.select().from(billingRevenueShareRules).orderBy(desc(billingRevenueShareRules.updatedAt));
  return rows.map(mapRevenueShareRule);
}

export async function listBillingInvoices() {
  const db = await getDb();
  if (!db) return defaultBillingInvoices;
  const rows = await db.select().from(billingInvoices).orderBy(desc(billingInvoices.updatedAt));
  return rows.map(mapInvoice);
}

export async function listBillingInvoiceLines() {
  const db = await getDb();
  if (!db) return defaultBillingInvoiceLines;
  const rows = await db.select().from(billingInvoiceLines).orderBy(desc(billingInvoiceLines.createdAt));
  return rows.map(mapInvoiceLine);
}

export async function listBillingInvoiceApprovals() {
  const db = await getDb();
  if (!db) return defaultBillingInvoiceApprovals;
  const rows = await db.select().from(billingInvoiceApprovals).orderBy(desc(billingInvoiceApprovals.updatedAt));
  return rows.map(mapInvoiceApproval);
}

export async function refreshBillingAccrualSnapshots() {
  const db = await getDb();
  if (!db) return defaultBillingAccrualSnapshots;

  const usage = await listBillingUsageEvents(500);
  const rated = await listBillingRatedEvents(500);
  const nextSnapshots = buildAccrualSnapshots(usage, rated);

  await db.delete(billingAccrualSnapshots);
  if (nextSnapshots.length > 0) {
    await db.insert(billingAccrualSnapshots).values(
      nextSnapshots.map((item) => ({
        accrualSnapshotId: item.id,
        tenantId: item.tenantId,
        billingAccountId: item.billingAccountId,
        billingPeriodKey: item.billingPeriodKey,
        meterKey: item.meterKey,
        productKey: item.productKey,
        ratedEventCount: item.ratedEventCount,
        usageQuantity: item.usageQuantity,
        accruedAmount: item.accruedAmount,
        unratedEventCount: item.unratedEventCount,
        lastUsageAt: item.lastUsageAt ? new Date(item.lastUsageAt) : null,
        lastRatedAt: item.lastRatedAt ? new Date(item.lastRatedAt) : null,
        snapshotStatus: item.snapshotStatus,
      })),
    );
  }

  return nextSnapshots;
}

export async function createBillingRateCard(input: {
  billingAccountId?: string;
  name: string;
  pricingCurrency?: string;
  createdBy: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select({ id: billingRateCards.id }).from(billingRateCards).orderBy(desc(billingRateCards.id));
  const rateCardId = nextId("BRC", existing.length);
  await db.insert(billingRateCards).values({
    rateCardId,
    billingAccountId: input.billingAccountId ?? null,
    name: input.name,
    version: 1,
    status: "draft",
    effectiveFrom: new Date(),
    effectiveTo: null,
    pricingCurrency: input.pricingCurrency ?? "NGN",
    createdBy: input.createdBy,
    approvalState: "pending",
  });
  const [row] = await db.select().from(billingRateCards).where(eq(billingRateCards.rateCardId, rateCardId)).limit(1);
  return row ? mapRateCard(row) : null;
}

export async function createBillingUsageEvent(input: BillingUsageEventInput) {
  const db = await getDb();
  if (!db) return null;

  const accounts = await listBillingAccounts();
  const overrides = await listBillingContractOverrides();
  const account = accounts.find((item) => item.tenantId === input.tenantId || item.id === input.billingAccountId) ?? accounts[0];
  if (!account) return null;

  const usageRows = await db.select({ id: billingUsageEvents.id }).from(billingUsageEvents).orderBy(desc(billingUsageEvents.id));
  const usageEventId = nextId("BUE", usageRows.length);
  const usageEvent: BillingUsageEvent = {
    id: usageEventId,
    idempotencyKey: input.idempotencyKey,
    tenantId: input.tenantId,
    billingAccountId: account.id,
    sourceService: input.sourceService,
    sourceEventType: input.sourceEventType,
    meterKey: input.meterKey,
    productKey: input.productKey,
    quantity: input.quantity,
    unitAmount: input.unitAmount,
    currency: input.currency,
    eventTimestamp: input.eventTimestamp,
    ingestedAt: new Date().toISOString(),
    correlationId: input.correlationId,
    actorId: input.actorId,
    resourceId: input.resourceId,
    payload: input.payload,
    status: "pending",
  };

  await db.insert(billingUsageEvents).values({
    usageEventId: usageEvent.id,
    idempotencyKey: usageEvent.idempotencyKey,
    tenantId: usageEvent.tenantId,
    billingAccountId: usageEvent.billingAccountId,
    sourceService: usageEvent.sourceService,
    sourceEventType: usageEvent.sourceEventType,
    meterKey: usageEvent.meterKey,
    productKey: usageEvent.productKey,
    quantity: usageEvent.quantity,
    unitAmount: usageEvent.unitAmount ?? null,
    currency: usageEvent.currency,
    eventTimestamp: new Date(usageEvent.eventTimestamp),
    ingestedAt: new Date(usageEvent.ingestedAt),
    correlationId: usageEvent.correlationId ?? null,
    actorId: usageEvent.actorId ?? null,
    resourceId: usageEvent.resourceId ?? null,
    payload: usageEvent.payload,
    status: usageEvent.status,
  });

  const rateCards = await listBillingRateCards();
  const lines = await listBillingRateCardLines();
  const rated = rateUsageEvent(usageEvent, account, rateCards, lines, overrides);

  if (rated) {
    const ratedRows = await db.select({ id: billingRatedEvents.id }).from(billingRatedEvents).orderBy(desc(billingRatedEvents.id));
    const ratedEventId = nextId("BRE", ratedRows.length);
    await db.insert(billingRatedEvents).values({
      ratedEventId,
      usageEventId: usageEvent.id,
      rateCardId: rated.rateCardId,
      rateCardLineId: rated.rateCardLineId,
      billingPeriodKey: rated.billingPeriodKey,
      quantityRated: rated.quantityRated,
      billableUnits: rated.billableUnits,
      amountAccrued: rated.amountAccrued,
      currency: rated.currency,
      ratingExplanation: rated.ratingExplanation,
      ratedAt: new Date(),
    });
    await db.update(billingUsageEvents).set({ status: "rated" }).where(eq(billingUsageEvents.usageEventId, usageEvent.id));
  }

  const [stored] = await db.select().from(billingUsageEvents).where(eq(billingUsageEvents.usageEventId, usageEvent.id)).limit(1);
  await refreshBillingAccrualSnapshots();
  return stored ? mapUsageEvent(stored) : usageEvent;
}

export async function createBillingContractOverride(input: Omit<BillingContractOverride, "id">) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: billingContractOverrides.id }).from(billingContractOverrides).orderBy(desc(billingContractOverrides.id));
  const id = nextId("BCO", rows.length);
  await db.insert(billingContractOverrides).values({
    contractOverrideId: id,
    billingAccountId: input.billingAccountId,
    tenantId: input.tenantId,
    overrideType: input.overrideType,
    meterKey: input.meterKey ?? null,
    productKey: input.productKey ?? null,
    valueNumber: input.valueNumber ?? null,
    valueText: input.valueText ?? null,
    effectiveFrom: new Date(input.effectiveFrom),
    effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    status: input.status,
    createdBy: input.createdBy,
    notes: input.notes ?? null,
  });
  const [stored] = await db.select().from(billingContractOverrides).where(eq(billingContractOverrides.contractOverrideId, id)).limit(1);
  return stored ? mapContractOverride(stored) : null;
}

export async function createBillingDiscountRule(input: Omit<BillingDiscountRule, "id">) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: billingDiscountRules.id }).from(billingDiscountRules).orderBy(desc(billingDiscountRules.id));
  const id = nextId("BDR", rows.length);
  await db.insert(billingDiscountRules).values({
    discountRuleId: id,
    billingAccountId: input.billingAccountId,
    tenantId: input.tenantId,
    name: input.name,
    discountType: input.discountType,
    meterKey: input.meterKey ?? null,
    productKey: input.productKey ?? null,
    percentage: input.percentage ?? null,
    fixedAmount: input.fixedAmount ?? null,
    thresholdAmount: input.thresholdAmount ?? null,
    effectiveFrom: new Date(input.effectiveFrom),
    effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    status: input.status,
    createdBy: input.createdBy,
  });
  const [stored] = await db.select().from(billingDiscountRules).where(eq(billingDiscountRules.discountRuleId, id)).limit(1);
  return stored ? mapDiscountRule(stored) : null;
}

export async function createBillingRevenueShareRule(input: Omit<BillingRevenueShareRule, "id">) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: billingRevenueShareRules.id }).from(billingRevenueShareRules).orderBy(desc(billingRevenueShareRules.id));
  const id = nextId("BSR", rows.length);
  await db.insert(billingRevenueShareRules).values({
    revenueShareRuleId: id,
    billingAccountId: input.billingAccountId,
    tenantId: input.tenantId,
    name: input.name,
    target: input.target,
    percentage: input.percentage,
    beneficiaryName: input.beneficiaryName,
    settlementLedgerCode: input.settlementLedgerCode ?? null,
    effectiveFrom: new Date(input.effectiveFrom),
    effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    status: input.status,
    createdBy: input.createdBy,
  });
  const [stored] = await db.select().from(billingRevenueShareRules).where(eq(billingRevenueShareRules.revenueShareRuleId, id)).limit(1);
  return stored ? mapRevenueShareRule(stored) : null;
}

async function clearInvoiceRunTables(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  await db.delete(billingInvoiceApprovals);
  await db.delete(billingInvoiceLines);
  await db.delete(billingInvoices);
}

export async function generateBillingInvoices(input: {
  billingAccountId?: string;
  periodType?: BillingPeriodType;
  generatedBy: string;
}) {
  const db = await getDb();
  if (!db) {
    return {
      invoices: defaultBillingInvoices,
      invoiceLines: defaultBillingInvoiceLines,
      invoiceApprovals: defaultBillingInvoiceApprovals,
    };
  }

  const [accounts, accruals, overrides, discountRules, revenueShareRules] = await Promise.all([
    listBillingAccounts(),
    refreshBillingAccrualSnapshots(),
    listBillingContractOverrides(),
    listBillingDiscountRules(),
    listBillingRevenueShareRules(),
  ]);

  const scopedAccounts = input.billingAccountId
    ? accounts.filter((item) => item.id === input.billingAccountId)
    : accounts;
  const scopedAccruals = input.billingAccountId
    ? accruals.filter((item) => item.billingAccountId === input.billingAccountId)
    : accruals;

  const generated = buildInvoices({
    accounts: scopedAccounts,
    accruals: scopedAccruals,
    overrides,
    discountRules,
    revenueShareRules,
    periodType: input.periodType,
    generatedAt: new Date().toISOString(),
  });

  await clearInvoiceRunTables(db);

  if (generated.invoices.length > 0) {
    await db.insert(billingInvoices).values(
      generated.invoices.map((item) => ({
        billingInvoiceId: item.id,
        invoiceNumber: item.invoiceNumber,
        tenantId: item.tenantId,
        billingAccountId: item.billingAccountId,
        billingPeriodKey: item.billingPeriodKey,
        billingPeriodType: item.billingPeriodType,
        periodStartAt: new Date(item.periodStartAt),
        periodEndAt: new Date(item.periodEndAt),
        currency: item.currency,
        subtotalAmount: item.subtotalAmount,
        discountAmount: item.discountAmount,
        revenueShareAmount: item.revenueShareAmount,
        minimumCommitAdjustment: item.minimumCommitAdjustment,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
        status: item.status,
        approvalStatus: item.approvalStatus,
        generatedAt: new Date(item.generatedAt),
        dueAt: new Date(item.dueAt),
        approvalStepCount: item.approvalStepCount,
        issuedAt: item.issuedAt ? new Date(item.issuedAt) : null,
      })),
    );

    await db.insert(billingInvoiceLines).values(
      generated.invoiceLines.map((item) => ({
        billingInvoiceLineId: item.id,
        billingInvoiceId: item.invoiceId,
        lineType: item.lineType,
        meterKey: item.meterKey ?? null,
        productKey: item.productKey ?? null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        metadata: item.metadata ?? null,
      })),
    );

    await db.insert(billingInvoiceApprovals).values(
      generated.invoiceApprovals.map((item) => ({
        billingInvoiceApprovalId: item.id,
        billingInvoiceId: item.invoiceId,
        stageKey: item.stageKey,
        actorRole: item.actorRole,
        status: item.status,
        actedAt: item.actedAt ? new Date(item.actedAt) : null,
        note: item.note ?? null,
      })),
    );
  }

  return generated;
}

export async function resolveBillingInvoiceApproval(input: {
  invoiceId: string;
  approvalId: string;
  actorRole: BillingInvoiceApproval["actorRole"];
  decision: "approve" | "reject";
  note?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const [approvalRow] = await db
    .select()
    .from(billingInvoiceApprovals)
    .where(eq(billingInvoiceApprovals.billingInvoiceApprovalId, input.approvalId))
    .limit(1);
  if (!approvalRow || approvalRow.billingInvoiceId !== input.invoiceId || approvalRow.actorRole !== input.actorRole) {
    return null;
  }

  await db
    .update(billingInvoiceApprovals)
    .set({
      status: input.decision === "approve" ? "approved" : "rejected",
      actedAt: new Date(),
      note: input.note ?? null,
    })
    .where(eq(billingInvoiceApprovals.billingInvoiceApprovalId, input.approvalId));

  const approvals = await listBillingInvoiceApprovals();
  const scoped = approvals.filter((item) => item.invoiceId === input.invoiceId);
  const hasRejected = scoped.some((item) => item.status === "rejected");
  const allApproved = scoped.length > 0 && scoped.every((item) => item.status === "approved" || item.status === "skipped");

  await db
    .update(billingInvoices)
    .set({
      status: hasRejected ? "rejected" : allApproved ? "approved" : "pending_approval",
      approvalStatus: hasRejected ? "rejected" : allApproved ? "approved" : "pending",
      issuedAt: allApproved ? new Date(nextBusinessDayIso(new Date().toISOString(), 1)) : null,
    })
    .where(eq(billingInvoices.billingInvoiceId, input.invoiceId));

  const [invoiceRow] = await db.select().from(billingInvoices).where(eq(billingInvoices.billingInvoiceId, input.invoiceId)).limit(1);
  return invoiceRow ? mapInvoice(invoiceRow) : null;
}

export async function getBillingDashboard(): Promise<BillingDashboard> {
  const [accounts, rateCards, rateCardLines, usageEvents, ratedEvents, accruals, invoices, invoiceLines, invoiceApprovals, contractOverrides, discountRules, revenueShareRules] = await Promise.all([
    listBillingAccounts(),
    listBillingRateCards(),
    listBillingRateCardLines(),
    listBillingUsageEvents(150),
    listBillingRatedEvents(150),
    listBillingAccrualSnapshots(),
    listBillingInvoices(),
    listBillingInvoiceLines(),
    listBillingInvoiceApprovals(),
    listBillingContractOverrides(),
    listBillingDiscountRules(),
    listBillingRevenueShareRules(),
  ]);

  return buildBillingDashboard({
    accounts,
    rateCards,
    rateCardLines,
    usageEvents,
    ratedEvents,
    accruals,
    invoices,
    invoiceLines,
    invoiceApprovals,
    contractOverrides,
    discountRules,
    revenueShareRules,
  });
}
