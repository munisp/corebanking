export type BillingModel = "subscription" | "usage" | "hybrid" | "revenue_share";
export type BillingAccountStatus = "draft" | "active" | "suspended" | "closed";
export type BillingRateCardStatus = "draft" | "approved" | "active" | "retired";
export type BillingChargeType = "flat" | "per_unit" | "tiered" | "minimum" | "percentage";
export type BillingEventStatus = "pending" | "rated" | "ignored" | "failed";
export type BillingSnapshotStatus = "healthy" | "lagging" | "review";
export type BillingPeriodType = "monthly" | "quarterly" | "semi_annual" | "annual" | "custom";
export type BillingInvoiceStatus = "draft" | "pending_approval" | "approved" | "rejected" | "issued" | "paid" | "void";
export type BillingApprovalStatus = "pending" | "approved" | "rejected" | "skipped";
export type BillingContractOverrideType = "unit_price" | "included_units" | "minimum_commit" | "billing_model" | "billing_period";
export type BillingDiscountType = "percentage" | "fixed" | "threshold_percentage";
export type BillingRevenueShareTarget = "platform" | "partner_bank" | "aggregator" | "reseller";

export type BillingAccount = {
  id: string;
  tenantId: string;
  accountName: string;
  billingModel: BillingModel;
  currency: string;
  status: BillingAccountStatus;
  contractStartAt: string;
  contractEndAt?: string;
  defaultRateCardId: string;
  minimumCommitAmount: number;
  defaultBillingPeriodType?: BillingPeriodType;
  invoiceDueDays?: number;
};

export type BillingRateCard = {
  id: string;
  billingAccountId?: string;
  name: string;
  version: number;
  status: BillingRateCardStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  pricingCurrency: string;
  createdBy: string;
  approvalState: "pending" | "approved" | "rejected";
};

export type BillingRateCardLine = {
  id: string;
  rateCardId: string;
  meterKey: string;
  productKey: string;
  chargeType: BillingChargeType;
  unitPrice: number;
  includedUnits: number;
  tierStart?: number;
  tierEnd?: number;
  minimumCharge?: number;
  maximumCharge?: number;
  pricingFormula?: Record<string, unknown>;
  settlementLedgerCode?: string;
};

export type BillingUsageEvent = {
  id: string;
  idempotencyKey: string;
  tenantId: string;
  billingAccountId: string;
  sourceService: string;
  sourceEventType: string;
  meterKey: string;
  productKey: string;
  quantity: number;
  unitAmount?: number;
  currency: string;
  eventTimestamp: string;
  ingestedAt: string;
  correlationId?: string;
  actorId?: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  status: BillingEventStatus;
};

export type BillingRatedEvent = {
  id: string;
  usageEventId: string;
  rateCardId: string;
  rateCardLineId: string;
  billingPeriodKey: string;
  quantityRated: number;
  billableUnits: number;
  amountAccrued: number;
  currency: string;
  ratingExplanation: Record<string, unknown>;
  ratedAt: string;
};

export type BillingAccrualSnapshot = {
  id: string;
  tenantId: string;
  billingAccountId: string;
  billingPeriodKey: string;
  meterKey: string;
  productKey: string;
  ratedEventCount: number;
  usageQuantity: number;
  accruedAmount: number;
  unratedEventCount: number;
  lastUsageAt?: string;
  lastRatedAt?: string;
  snapshotStatus: BillingSnapshotStatus;
};

export type BillingContractOverride = {
  id: string;
  billingAccountId: string;
  tenantId: string;
  overrideType: BillingContractOverrideType;
  meterKey?: string;
  productKey?: string;
  valueNumber?: number;
  valueText?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "draft" | "active" | "expired";
  createdBy: string;
  notes?: string;
};

export type BillingDiscountRule = {
  id: string;
  billingAccountId: string;
  tenantId: string;
  name: string;
  discountType: BillingDiscountType;
  meterKey?: string;
  productKey?: string;
  percentage?: number;
  fixedAmount?: number;
  thresholdAmount?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "draft" | "active" | "expired";
  createdBy: string;
};

export type BillingRevenueShareRule = {
  id: string;
  billingAccountId: string;
  tenantId: string;
  name: string;
  target: BillingRevenueShareTarget;
  percentage: number;
  beneficiaryName: string;
  settlementLedgerCode?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "draft" | "active" | "expired";
  createdBy: string;
};

export type BillingInvoice = {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  billingAccountId: string;
  billingPeriodKey: string;
  billingPeriodType: BillingPeriodType;
  periodStartAt: string;
  periodEndAt: string;
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  revenueShareAmount: number;
  minimumCommitAdjustment: number;
  taxAmount: number;
  totalAmount: number;
  status: BillingInvoiceStatus;
  approvalStatus: BillingApprovalStatus;
  generatedAt: string;
  dueAt: string;
  approvalStepCount: number;
  issuedAt?: string;
};

export type BillingInvoiceLine = {
  id: string;
  invoiceId: string;
  lineType: "usage" | "discount" | "revenue_share" | "minimum_commit" | "tax";
  meterKey?: string;
  productKey?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  metadata?: Record<string, unknown>;
};

export type BillingInvoiceApproval = {
  id: string;
  invoiceId: string;
  stageKey: string;
  actorRole: "operations" | "treasury" | "compliance" | "branch";
  status: BillingApprovalStatus;
  actedAt?: string;
  note?: string;
};

export type BillingDashboardSummary = {
  billingPeriodKey: string;
  currency: string;
  totalAccruedAmount: number;
  ratedEventCount: number;
  unratedEventCount: number;
  usageEventCount: number;
  draftInvoiceCount: number;
  pendingApprovalInvoiceCount: number;
  issuedInvoiceAmount: number;
  topMeters: Array<{
    meterKey: string;
    productKey: string;
    accruedAmount: number;
    usageQuantity: number;
  }>;
  thresholdAlerts: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
  }>;
  liveSeries: Array<{
    periodKey: string;
    accruedAmount: number;
    usageEventCount: number;
    invoiceAmount: number;
  }>;
  contractSummary: {
    overrideCount: number;
    discountRuleCount: number;
    revenueShareRuleCount: number;
  };
};

export type BillingDashboard = {
  summary: BillingDashboardSummary;
  accounts: BillingAccount[];
  rateCards: BillingRateCard[];
  rateCardLines: BillingRateCardLine[];
  usageEvents: BillingUsageEvent[];
  ratedEvents: BillingRatedEvent[];
  accruals: BillingAccrualSnapshot[];
  invoices: BillingInvoice[];
  invoiceLines: BillingInvoiceLine[];
  invoiceApprovals: BillingInvoiceApproval[];
  contractOverrides: BillingContractOverride[];
  discountRules: BillingDiscountRule[];
  revenueShareRules: BillingRevenueShareRule[];
};

export type BillingUsageEventInput = Omit<
  BillingUsageEvent,
  "id" | "ingestedAt" | "status" | "billingAccountId"
> & {
  billingAccountId?: string;
};

export function periodKeyForIso(iso: string) {
  const value = new Date(iso);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function safePositive(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function toUtcIso(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString();
}

function withinEffectiveWindow(pointIso: string, effectiveFrom: string, effectiveTo?: string) {
  const point = new Date(pointIso).getTime();
  const start = new Date(effectiveFrom).getTime();
  const end = effectiveTo ? new Date(effectiveTo).getTime() : Number.POSITIVE_INFINITY;
  return point >= start && point <= end;
}

export function buildBillingPeriodWindow(periodType: BillingPeriodType, anchorIso: string) {
  const anchor = new Date(anchorIso);
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(start);

  if (periodType === "monthly") {
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else if (periodType === "quarterly") {
    end.setUTCMonth(end.getUTCMonth() + 3);
  } else if (periodType === "semi_annual") {
    end.setUTCMonth(end.getUTCMonth() + 6);
  } else if (periodType === "annual") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }

  end.setUTCDate(end.getUTCDate() - 1);
  end.setUTCHours(23, 59, 59, 999);

  return {
    periodStartAt: start.toISOString(),
    periodEndAt: end.toISOString(),
    billingPeriodKey: periodKeyForIso(anchorIso),
  };
}

export function resolveActiveRateCard(
  account: BillingAccount,
  rateCards: BillingRateCard[],
  atIso: string,
) {
  const point = new Date(atIso).getTime();
  return (
    rateCards.find((card) => {
      if (card.id !== account.defaultRateCardId) return false;
      const starts = new Date(card.effectiveFrom).getTime();
      const ends = card.effectiveTo ? new Date(card.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
      return card.status === "active" && point >= starts && point <= ends;
    }) ?? null
  );
}

function resolveOverrideValue(
  event: BillingUsageEvent,
  account: BillingAccount,
  overrides: BillingContractOverride[],
  type: BillingContractOverrideType,
) {
  return overrides.find((item) => {
    if (item.billingAccountId !== account.id) return false;
    if (item.overrideType !== type) return false;
    if (item.status !== "active") return false;
    if (!withinEffectiveWindow(event.eventTimestamp, item.effectiveFrom, item.effectiveTo)) return false;
    if (item.meterKey && item.meterKey !== event.meterKey) return false;
    if (item.productKey && item.productKey !== event.productKey) return false;
    return true;
  });
}

export function calculateRatedAmount(
  quantity: number,
  line: BillingRateCardLine,
  override?: { unitPrice?: number; includedUnits?: number },
) {
  const normalizedQuantity = safePositive(quantity);
  const includedUnits = safePositive(override?.includedUnits ?? line.includedUnits);
  const unitPrice = safePositive(override?.unitPrice ?? line.unitPrice);
  let billableUnits = Math.max(0, normalizedQuantity - includedUnits);
  let amountAccrued = 0;

  if (line.chargeType === "flat") {
    billableUnits = normalizedQuantity > 0 ? 1 : 0;
    amountAccrued = normalizedQuantity > 0 ? unitPrice : 0;
  } else if (line.chargeType === "percentage") {
    const ratio = Number(line.pricingFormula?.ratio ?? 0.01);
    amountAccrued = normalizedQuantity * ratio;
    billableUnits = normalizedQuantity;
  } else {
    amountAccrued = billableUnits * unitPrice;
  }

  if (typeof line.minimumCharge === "number") {
    amountAccrued = Math.max(amountAccrued, safePositive(line.minimumCharge));
  }

  if (typeof line.maximumCharge === "number") {
    amountAccrued = Math.min(amountAccrued, safePositive(line.maximumCharge));
  }

  return {
    billableUnits,
    amountAccrued,
    includedUnits,
    unitPrice,
  };
}

export function rateUsageEvent(
  event: BillingUsageEvent,
  account: BillingAccount,
  rateCards: BillingRateCard[],
  rateCardLines: BillingRateCardLine[],
  overrides: BillingContractOverride[] = [],
): BillingRatedEvent | null {
  const rateCard = resolveActiveRateCard(account, rateCards, event.eventTimestamp);
  if (!rateCard) return null;

  const line = rateCardLines.find(
    (candidate) =>
      candidate.rateCardId === rateCard.id &&
      candidate.meterKey === event.meterKey &&
      candidate.productKey === event.productKey,
  );

  if (!line) return null;

  const unitPriceOverride = resolveOverrideValue(event, account, overrides, "unit_price");
  const includedUnitsOverride = resolveOverrideValue(event, account, overrides, "included_units");
  const rating = calculateRatedAmount(event.quantity, line, {
    unitPrice: unitPriceOverride?.valueNumber,
    includedUnits: includedUnitsOverride?.valueNumber,
  });

  return {
    id: `BRE-${event.id}`,
    usageEventId: event.id,
    rateCardId: rateCard.id,
    rateCardLineId: line.id,
    billingPeriodKey: periodKeyForIso(event.eventTimestamp),
    quantityRated: event.quantity,
    billableUnits: rating.billableUnits,
    amountAccrued: rating.amountAccrued,
    currency: event.currency || account.currency,
    ratingExplanation: {
      chargeType: line.chargeType,
      includedUnits: rating.includedUnits,
      unitPrice: rating.unitPrice,
      meterKey: line.meterKey,
      productKey: line.productKey,
      contractOverrideIds: [unitPriceOverride?.id, includedUnitsOverride?.id].filter(Boolean),
    },
    ratedAt: new Date().toISOString(),
  };
}

export function buildAccrualSnapshots(
  usageEvents: BillingUsageEvent[],
  ratedEvents: BillingRatedEvent[],
): BillingAccrualSnapshot[] {
  const snapshotMap = new Map<string, BillingAccrualSnapshot>();
  const ratedUsageIds = new Set(ratedEvents.map((item) => item.usageEventId));

  for (const event of usageEvents) {
    const key = `${event.tenantId}:${event.billingAccountId}:${periodKeyForIso(event.eventTimestamp)}:${event.meterKey}:${event.productKey}`;
    const existing = snapshotMap.get(key) ?? {
      id: `BAS-${snapshotMap.size + 1}`,
      tenantId: event.tenantId,
      billingAccountId: event.billingAccountId,
      billingPeriodKey: periodKeyForIso(event.eventTimestamp),
      meterKey: event.meterKey,
      productKey: event.productKey,
      ratedEventCount: 0,
      usageQuantity: 0,
      accruedAmount: 0,
      unratedEventCount: 0,
      lastUsageAt: undefined,
      lastRatedAt: undefined,
      snapshotStatus: "healthy" as BillingSnapshotStatus,
    };

    existing.usageQuantity += safePositive(event.quantity);
    existing.lastUsageAt = event.eventTimestamp;
    if (!ratedUsageIds.has(event.id)) {
      existing.unratedEventCount += 1;
    }
    snapshotMap.set(key, existing);
  }

  for (const rated of ratedEvents) {
    const event = usageEvents.find((item) => item.id === rated.usageEventId);
    if (!event) continue;
    const key = `${event.tenantId}:${event.billingAccountId}:${rated.billingPeriodKey}:${event.meterKey}:${event.productKey}`;
    const existing = snapshotMap.get(key);
    if (!existing) continue;
    existing.ratedEventCount += 1;
    existing.accruedAmount += safePositive(rated.amountAccrued);
    existing.lastRatedAt = rated.ratedAt;
  }

  for (const snapshot of Array.from(snapshotMap.values())) {
    snapshot.snapshotStatus = snapshot.unratedEventCount > 0 ? "lagging" : snapshot.accruedAmount >= 5_000_000 ? "review" : "healthy";
  }

  return Array.from(snapshotMap.values()).sort((a, b) => b.accruedAmount - a.accruedAmount);
}

function calculateDiscountAmount(subtotalAmount: number, rule: BillingDiscountRule) {
  if (rule.discountType === "fixed") {
    return safePositive(rule.fixedAmount ?? 0);
  }
  if (rule.discountType === "threshold_percentage") {
    const threshold = safePositive(rule.thresholdAmount ?? 0);
    if (subtotalAmount < threshold) return 0;
  }
  return subtotalAmount * safePositive((rule.percentage ?? 0) / 100);
}

function buildInvoiceNumber(account: BillingAccount, billingPeriodKey: string, index: number) {
  return `${account.tenantId.toUpperCase().slice(0, 6)}-${billingPeriodKey.replace("-", "")}-${String(index + 1).padStart(3, "0")}`;
}

export function buildInvoices(args: {
  accounts: BillingAccount[];
  accruals: BillingAccrualSnapshot[];
  overrides?: BillingContractOverride[];
  discountRules?: BillingDiscountRule[];
  revenueShareRules?: BillingRevenueShareRule[];
  periodType?: BillingPeriodType;
  generatedAt?: string;
  taxRate?: number;
}): { invoices: BillingInvoice[]; invoiceLines: BillingInvoiceLine[]; invoiceApprovals: BillingInvoiceApproval[] } {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const periodType = args.periodType ?? "monthly";
  const taxRate = args.taxRate ?? 7.5;
  const overrides = args.overrides ?? [];
  const discountRules = args.discountRules ?? [];
  const revenueShareRules = args.revenueShareRules ?? [];
  const grouped = new Map<string, BillingAccrualSnapshot[]>();

  for (const accrual of args.accruals) {
    const key = `${accrual.billingAccountId}:${accrual.billingPeriodKey}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(accrual);
    grouped.set(key, bucket);
  }

  const invoices: BillingInvoice[] = [];
  const invoiceLines: BillingInvoiceLine[] = [];
  const invoiceApprovals: BillingInvoiceApproval[] = [];

  Array.from(grouped.entries()).forEach(([key, accruals], index) => {
    const [billingAccountId, billingPeriodKey] = key.split(":");
    const account = args.accounts.find((item) => item.id === billingAccountId);
    if (!account) return;

    const subtotalAmount = accruals.reduce((sum, item) => sum + safePositive(item.accruedAmount), 0);
    const applicableDiscounts = discountRules.filter(
      (rule) =>
        rule.billingAccountId === account.id &&
        rule.status === "active" &&
        withinEffectiveWindow(generatedAt, rule.effectiveFrom, rule.effectiveTo),
    );
    const applicableRevenueShares = revenueShareRules.filter(
      (rule) =>
        rule.billingAccountId === account.id &&
        rule.status === "active" &&
        withinEffectiveWindow(generatedAt, rule.effectiveFrom, rule.effectiveTo),
    );

    const overridePeriod = overrides.find(
      (item) =>
        item.billingAccountId === account.id &&
        item.overrideType === "billing_period" &&
        item.status === "active" &&
        withinEffectiveWindow(generatedAt, item.effectiveFrom, item.effectiveTo),
    );
    const overridePeriodType = (overridePeriod?.valueText as BillingPeriodType | undefined) ?? account.defaultBillingPeriodType ?? periodType;
    const periodWindow = buildBillingPeriodWindow(overridePeriodType, `${billingPeriodKey}-01T00:00:00.000Z`);
    const minimumCommitOverride = overrides.find(
      (item) =>
        item.billingAccountId === account.id &&
        item.overrideType === "minimum_commit" &&
        item.status === "active" &&
        withinEffectiveWindow(generatedAt, item.effectiveFrom, item.effectiveTo),
    );
    const minimumCommitAmount = safePositive(minimumCommitOverride?.valueNumber ?? account.minimumCommitAmount);

    const discountAmount = applicableDiscounts.reduce((sum, rule) => sum + calculateDiscountAmount(subtotalAmount, rule), 0);
    const netAfterDiscounts = Math.max(0, subtotalAmount - discountAmount);
    const revenueShareAmount = applicableRevenueShares.reduce(
      (sum, rule) => sum + netAfterDiscounts * safePositive(rule.percentage / 100),
      0,
    );
    const minimumCommitAdjustment = Math.max(0, minimumCommitAmount - Math.max(0, netAfterDiscounts - revenueShareAmount));
    const taxableBase = Math.max(0, netAfterDiscounts - revenueShareAmount + minimumCommitAdjustment);
    const taxAmount = taxableBase * (taxRate / 100);
    const totalAmount = taxableBase + taxAmount;
    const invoiceId = `BINV-${String(index + 1).padStart(3, "0")}`;
    const dueAt = new Date(new Date(generatedAt).getTime() + (account.invoiceDueDays ?? 14) * 24 * 60 * 60 * 1000).toISOString();

    const invoice: BillingInvoice = {
      id: invoiceId,
      invoiceNumber: buildInvoiceNumber(account, billingPeriodKey, index),
      tenantId: account.tenantId,
      billingAccountId: account.id,
      billingPeriodKey,
      billingPeriodType: overridePeriodType,
      periodStartAt: periodWindow.periodStartAt,
      periodEndAt: periodWindow.periodEndAt,
      currency: account.currency,
      subtotalAmount,
      discountAmount,
      revenueShareAmount,
      minimumCommitAdjustment,
      taxAmount,
      totalAmount,
      status: applicableDiscounts.length > 0 || applicableRevenueShares.length > 0 ? "pending_approval" : "draft",
      approvalStatus: "pending",
      generatedAt,
      dueAt,
      approvalStepCount: 3,
    };
    invoices.push(invoice);

    accruals.forEach((accrual, lineIndex) => {
      invoiceLines.push({
        id: `BIL-${invoice.id}-${lineIndex + 1}`,
        invoiceId: invoice.id,
        lineType: "usage",
        meterKey: accrual.meterKey,
        productKey: accrual.productKey,
        description: `${accrual.productKey} / ${accrual.meterKey}`,
        quantity: accrual.usageQuantity,
        unitPrice: accrual.usageQuantity > 0 ? accrual.accruedAmount / accrual.usageQuantity : 0,
        amount: accrual.accruedAmount,
        metadata: { ratedEventCount: accrual.ratedEventCount },
      });
    });

    if (discountAmount > 0) {
      invoiceLines.push({
        id: `BIL-${invoice.id}-discount`,
        invoiceId: invoice.id,
        lineType: "discount",
        description: "Tenant-specific commercial discount",
        quantity: 1,
        unitPrice: -discountAmount,
        amount: -discountAmount,
      });
    }

    if (revenueShareAmount > 0) {
      invoiceLines.push({
        id: `BIL-${invoice.id}-share`,
        invoiceId: invoice.id,
        lineType: "revenue_share",
        description: "Revenue-share partner allocation",
        quantity: 1,
        unitPrice: -revenueShareAmount,
        amount: -revenueShareAmount,
      });
    }

    if (minimumCommitAdjustment > 0) {
      invoiceLines.push({
        id: `BIL-${invoice.id}-minimum`,
        invoiceId: invoice.id,
        lineType: "minimum_commit",
        description: "Minimum commit true-up",
        quantity: 1,
        unitPrice: minimumCommitAdjustment,
        amount: minimumCommitAdjustment,
      });
    }

    invoiceLines.push({
      id: `BIL-${invoice.id}-tax`,
      invoiceId: invoice.id,
      lineType: "tax",
      description: `VAT ${taxRate}%`,
      quantity: 1,
      unitPrice: taxAmount,
      amount: taxAmount,
    });

    ["operations_review", "treasury_signoff", "compliance_release"].forEach((stageKey, stageIndex) => {
      const actorRole = stageIndex === 0 ? "operations" : stageIndex === 1 ? "treasury" : "compliance";
      invoiceApprovals.push({
        id: `BAP-${invoice.id}-${stageIndex + 1}`,
        invoiceId: invoice.id,
        stageKey,
        actorRole,
        status: "pending",
      });
    });
  });

  return { invoices, invoiceLines, invoiceApprovals };
}

export function buildBillingDashboard(args: {
  accounts: BillingAccount[];
  rateCards: BillingRateCard[];
  rateCardLines: BillingRateCardLine[];
  usageEvents: BillingUsageEvent[];
  ratedEvents: BillingRatedEvent[];
  accruals: BillingAccrualSnapshot[];
  invoices?: BillingInvoice[];
  invoiceLines?: BillingInvoiceLine[];
  invoiceApprovals?: BillingInvoiceApproval[];
  contractOverrides?: BillingContractOverride[];
  discountRules?: BillingDiscountRule[];
  revenueShareRules?: BillingRevenueShareRule[];
}): BillingDashboard {
  const invoices = args.invoices ?? [];
  const invoiceLines = args.invoiceLines ?? [];
  const invoiceApprovals = args.invoiceApprovals ?? [];
  const contractOverrides = args.contractOverrides ?? [];
  const discountRules = args.discountRules ?? [];
  const revenueShareRules = args.revenueShareRules ?? [];
  const latestPeriod = args.accruals[0]?.billingPeriodKey ?? periodKeyForIso(new Date().toISOString());
  const totalAccruedAmount = args.accruals.reduce((sum, item) => sum + item.accruedAmount, 0);
  const ratedEventCount = args.ratedEvents.length;
  const usageEventCount = args.usageEvents.length;
  const unratedEventCount = Math.max(0, usageEventCount - ratedEventCount);

  const topMeters = args.accruals.slice(0, 5).map((item) => ({
    meterKey: item.meterKey,
    productKey: item.productKey,
    accruedAmount: item.accruedAmount,
    usageQuantity: item.usageQuantity,
  }));

  const thresholdAlerts = args.accruals
    .filter((item) => item.accruedAmount >= 5_000_000 || item.snapshotStatus !== "healthy")
    .slice(0, 6)
    .map((item, index) => ({
      id: `BTA-${index + 1}`,
      severity: item.accruedAmount >= 10_000_000 ? "critical" as const : item.snapshotStatus !== "healthy" ? "warning" as const : "info" as const,
      title: `${item.meterKey} accrued exposure`,
      detail: `${item.productKey} has accrued ${item.accruedAmount.toLocaleString("en-NG", { maximumFractionDigits: 0 })} in period ${item.billingPeriodKey}.`,
    }));

  const liveSeriesMap = new Map<string, { periodKey: string; accruedAmount: number; usageEventCount: number; invoiceAmount: number }>();
  args.accruals.forEach((item) => {
    const existing = liveSeriesMap.get(item.billingPeriodKey) ?? {
      periodKey: item.billingPeriodKey,
      accruedAmount: 0,
      usageEventCount: 0,
      invoiceAmount: 0,
    };
    existing.accruedAmount += item.accruedAmount;
    existing.usageEventCount += item.ratedEventCount + item.unratedEventCount;
    liveSeriesMap.set(item.billingPeriodKey, existing);
  });
  invoices.forEach((item) => {
    const existing = liveSeriesMap.get(item.billingPeriodKey) ?? {
      periodKey: item.billingPeriodKey,
      accruedAmount: 0,
      usageEventCount: 0,
      invoiceAmount: 0,
    };
    existing.invoiceAmount += item.totalAmount;
    liveSeriesMap.set(item.billingPeriodKey, existing);
  });

  const liveSeries = Array.from(liveSeriesMap.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  return {
    summary: {
      billingPeriodKey: latestPeriod,
      currency: args.accounts[0]?.currency ?? "NGN",
      totalAccruedAmount,
      ratedEventCount,
      unratedEventCount,
      usageEventCount,
      draftInvoiceCount: invoices.filter((item) => item.status === "draft").length,
      pendingApprovalInvoiceCount: invoices.filter((item) => item.status === "pending_approval").length,
      issuedInvoiceAmount: invoices
        .filter((item) => item.status === "approved" || item.status === "issued" || item.status === "paid")
        .reduce((sum, item) => sum + item.totalAmount, 0),
      topMeters,
      thresholdAlerts,
      liveSeries,
      contractSummary: {
        overrideCount: contractOverrides.length,
        discountRuleCount: discountRules.length,
        revenueShareRuleCount: revenueShareRules.length,
      },
    },
    accounts: args.accounts,
    rateCards: args.rateCards,
    rateCardLines: args.rateCardLines,
    usageEvents: args.usageEvents,
    ratedEvents: args.ratedEvents,
    accruals: args.accruals,
    invoices,
    invoiceLines,
    invoiceApprovals,
    contractOverrides,
    discountRules,
    revenueShareRules,
  };
}

export const defaultBillingAccounts: BillingAccount[] = [
  {
    id: "BAC-001",
    tenantId: "54bank-platform-prod",
    accountName: "54Bank Platform Commercial Account",
    billingModel: "hybrid",
    currency: "NGN",
    status: "active",
    contractStartAt: "2026-01-01T00:00:00.000Z",
    defaultRateCardId: "BRC-001",
    minimumCommitAmount: 9_000_000,
    defaultBillingPeriodType: "monthly",
    invoiceDueDays: 14,
  },
];

export const defaultBillingRateCards: BillingRateCard[] = [
  {
    id: "BRC-001",
    billingAccountId: "BAC-001",
    name: "54Bank Platform Enterprise Hybrid v1",
    version: 1,
    status: "active",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    pricingCurrency: "NGN",
    createdBy: "commercial.ops",
    approvalState: "approved",
  },
];

export const defaultBillingRateCardLines: BillingRateCardLine[] = [
  {
    id: "BRL-001",
    rateCardId: "BRC-001",
    meterKey: "active_customer",
    productKey: "customer",
    chargeType: "per_unit",
    unitPrice: 10,
    includedUnits: 200_000,
    settlementLedgerCode: "REV-CUST",
  },
  {
    id: "BRL-002",
    rateCardId: "BRC-001",
    meterKey: "named_user",
    productKey: "operations",
    chargeType: "per_unit",
    unitPrice: 50_000,
    includedUnits: 150,
    settlementLedgerCode: "REV-SEAT",
  },
  {
    id: "BRL-003",
    rateCardId: "BRC-001",
    meterKey: "transfer_posted",
    productKey: "payments",
    chargeType: "per_unit",
    unitPrice: 25,
    includedUnits: 10_000,
    settlementLedgerCode: "REV-TXN",
  },
  {
    id: "BRL-004",
    rateCardId: "BRC-001",
    meterKey: "branch",
    productKey: "operations",
    chargeType: "per_unit",
    unitPrice: 350_000,
    includedUnits: 25,
    settlementLedgerCode: "REV-BRANCH",
  },
  {
    id: "BRL-005",
    rateCardId: "BRC-001",
    meterKey: "environment",
    productKey: "platform",
    chargeType: "per_unit",
    unitPrice: 1_500_000,
    includedUnits: 2,
    settlementLedgerCode: "REV-ENV",
  },
];

export const defaultBillingUsageEvents: BillingUsageEvent[] = [
  {
    id: "BUE-001",
    idempotencyKey: "tenant-54bank-active-customer-2026-05-01",
    tenantId: "54bank-platform-prod",
    billingAccountId: "BAC-001",
    sourceService: "customer-service",
    sourceEventType: "customer.activated",
    meterKey: "active_customer",
    productKey: "customer",
    quantity: 225_000,
    currency: "NGN",
    eventTimestamp: "2026-05-01T09:00:00.000Z",
    ingestedAt: "2026-05-01T09:00:02.000Z",
    actorId: "system.customer.sync",
    payload: { source: "daily-tenant-rollup", middleware: ["Kafka", "Lakehouse", "Postgres"] },
    status: "rated",
  },
  {
    id: "BUE-002",
    idempotencyKey: "tenant-54bank-seats-2026-05-02",
    tenantId: "54bank-platform-prod",
    billingAccountId: "BAC-001",
    sourceService: "tenant-service",
    sourceEventType: "seat.assigned",
    meterKey: "named_user",
    productKey: "operations",
    quantity: 185,
    currency: "NGN",
    eventTimestamp: "2026-05-02T10:15:00.000Z",
    ingestedAt: "2026-05-02T10:15:01.000Z",
    actorId: "ops.super.admin",
    payload: { source: "tenant-admin", middleware: ["Keycloak", "Permify", "Postgres"] },
    status: "rated",
  },
  {
    id: "BUE-003",
    idempotencyKey: "tenant-54bank-transfer-volume-2026-05-03",
    tenantId: "54bank-platform-prod",
    billingAccountId: "BAC-001",
    sourceService: "payment-service",
    sourceEventType: "transfer.posted",
    meterKey: "transfer_posted",
    productKey: "payments",
    quantity: 12_450,
    currency: "NGN",
    eventTimestamp: "2026-05-03T13:20:00.000Z",
    ingestedAt: "2026-05-03T13:20:01.000Z",
    actorId: "system.payments.meter",
    payload: { source: "settlement-rollup", middleware: ["Kafka", "Mojaloop", "TigerBeetle"] },
    status: "rated",
  },
];

export const defaultBillingContractOverrides: BillingContractOverride[] = [
  {
    id: "BCO-001",
    billingAccountId: "BAC-001",
    tenantId: "54bank-platform-prod",
    overrideType: "unit_price",
    meterKey: "transfer_posted",
    productKey: "payments",
    valueNumber: 22,
    effectiveFrom: "2026-05-01T00:00:00.000Z",
    status: "active",
    createdBy: "commercial.ops",
    notes: "Preferred transaction pricing for launch quarter.",
  },
  {
    id: "BCO-002",
    billingAccountId: "BAC-001",
    tenantId: "54bank-platform-prod",
    overrideType: "minimum_commit",
    valueNumber: 8_500_000,
    effectiveFrom: "2026-05-01T00:00:00.000Z",
    status: "active",
    createdBy: "finance.ops",
    notes: "Launch-phase minimum commit override.",
  },
];

export const defaultBillingDiscountRules: BillingDiscountRule[] = [
  {
    id: "BDR-001",
    billingAccountId: "BAC-001",
    tenantId: "54bank-platform-prod",
    name: "Launch adoption discount",
    discountType: "percentage",
    percentage: 7.5,
    effectiveFrom: "2026-05-01T00:00:00.000Z",
    status: "active",
    createdBy: "commercial.ops",
  },
];

export const defaultBillingRevenueShareRules: BillingRevenueShareRule[] = [
  {
    id: "BSR-001",
    billingAccountId: "BAC-001",
    tenantId: "54bank-platform-prod",
    name: "Partner bank usage share",
    target: "partner_bank",
    percentage: 12.5,
    beneficiaryName: "Mutual partner operations pool",
    settlementLedgerCode: "REV-SHARE-PARTNER",
    effectiveFrom: "2026-05-01T00:00:00.000Z",
    status: "active",
    createdBy: "finance.ops",
  },
];

export function seedRatedEvents(
  accounts: BillingAccount[] = defaultBillingAccounts,
  rateCards: BillingRateCard[] = defaultBillingRateCards,
  rateCardLines: BillingRateCardLine[] = defaultBillingRateCardLines,
  usageEvents: BillingUsageEvent[] = defaultBillingUsageEvents,
  overrides: BillingContractOverride[] = defaultBillingContractOverrides,
) {
  return usageEvents
    .map((event) => {
      const account = accounts.find((item) => item.id === event.billingAccountId);
      return account ? rateUsageEvent(event, account, rateCards, rateCardLines, overrides) : null;
    })
    .filter((item): item is BillingRatedEvent => Boolean(item));
}

const seededRatedEvents = seedRatedEvents();
const seededAccruals = buildAccrualSnapshots(defaultBillingUsageEvents, seededRatedEvents);
const seededInvoices = buildInvoices({
  accounts: defaultBillingAccounts,
  accruals: seededAccruals,
  overrides: defaultBillingContractOverrides,
  discountRules: defaultBillingDiscountRules,
  revenueShareRules: defaultBillingRevenueShareRules,
  generatedAt: "2026-05-05T08:30:00.000Z",
});

export const defaultBillingAccrualSnapshots: BillingAccrualSnapshot[] = seededAccruals;
export const defaultBillingInvoices: BillingInvoice[] = seededInvoices.invoices;
export const defaultBillingInvoiceLines: BillingInvoiceLine[] = seededInvoices.invoiceLines;
export const defaultBillingInvoiceApprovals: BillingInvoiceApproval[] = seededInvoices.invoiceApprovals.map((item, index) =>
  index === 0
    ? { ...item, status: "approved", actedAt: "2026-05-05T09:00:00.000Z", note: "Operations validated meter evidence." }
    : item,
);

export function buildRealtimeUsageFeed(usageEvents: BillingUsageEvent[], ratedEvents: BillingRatedEvent[]) {
  return usageEvents
    .slice()
    .sort((left, right) => new Date(right.eventTimestamp).getTime() - new Date(left.eventTimestamp).getTime())
    .slice(0, 12)
    .map((event) => {
      const rated = ratedEvents.find((item) => item.usageEventId === event.id);
      return {
        id: event.id,
        meterKey: event.meterKey,
        productKey: event.productKey,
        sourceService: event.sourceService,
        quantity: event.quantity,
        status: event.status,
        eventTimestamp: event.eventTimestamp,
        amountAccrued: rated?.amountAccrued ?? 0,
      };
    });
}

export function nextBusinessDayIso(anchorIso: string, days = 1) {
  const value = new Date(anchorIso);
  value.setUTCDate(value.getUTCDate() + days);
  return toUtcIso(value);
}
