import { and, desc, eq } from "drizzle-orm";

import {
  auditEntries,
  customerApprovals,
  customerBillPayments,
  customerCardEvents,
  customerCards,
  customerNotifications,
  customerSavedBillers,
  customerSessionPreferences,
  customerStatementExports,
  customerStatements,
  customerTransfers,
  customers,
  exportJobs,
  operatorActions,
  partnerApprovalRecords,
  partnerOnboardingRecords,
  tenantFeatureFlags,
  tenants,
  workflowCases,
} from "../drizzle/schema";
import { getDb } from "./db";

type JsonObject = Record<string, unknown>;

type SeedCollections = {
  customers: any[];
  customerCards: any[];
  customerCardEvents: any[];
  customerSavedBillers: any[];
  customerBillPayments: any[];
  customerTransfers: any[];
  customerApprovals: any[];
  workflowCases: any[];
  operatorActions: any[];
  auditTrail: any[];
  exportJobs: any[];
  partnerOnboardingRecords?: any[];
  partnerApprovalRecords?: any[];
  tenantConfiguration?: any;
};

const seededTenants = new Set<string>();

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());
const toDate = (value?: string | Date | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return isValidDate(parsed) ? parsed : null;
};
const toRequiredDate = (value?: string | Date | null, fallback?: string | Date | null) =>
  toDate(value) ?? toDate(fallback) ?? new Date();
const toIso = (value?: Date | string | null) => {
  if (value instanceof Date) return isValidDate(value) ? value.toISOString() : undefined;
  return value ?? undefined;
};
const boolToInt = (value?: boolean) => (value ? 1 : 0);
const intToBool = (value?: number | null) => Boolean(value);

function defaultTenant(tenantId: string) {
  return {
    tenantId,
    name: "54Bank Retail Platform",
    onboardingStatus: "active",
    segment: "retail",
    region: "Lagos",
    enabledModules: ["transfers", "bills", "cards", "savings", "loans", "notifications", "qr"],
    whiteLabel: {
      displayName: "54Bank Retail Platform",
      legalEntity: "54Bank Platform Services Ltd",
      supportEmail: "platform-operations@54bank.app",
      primaryColor: "#047857",
      accentColor: "#0f172a",
      logoUrl: "https://assets.54bank.app/logos/54bank-primary.png",
      loginHeadline: "Banking configured for retail launch teams and customer journeys.",
      customDomain: "app.54bank.app",
    },
    featureFlags: [
      {
        key: "transfers",
        label: "Transfers",
        category: "payments",
        description: "Allow customers to create bank, wallet, and workflow transfer requests.",
        enabled: true,
        rolloutStage: "general",
        adminManaged: true,
        dependsOn: ["payment-service", "notification-service"],
      },
      {
        key: "bills",
        label: "Bill Payments",
        category: "payments",
        description: "Enable biller lookup, validation, and payment orchestration during customer onboarding.",
        enabled: true,
        rolloutStage: "controlled",
        adminManaged: true,
        dependsOn: ["payment-service", "ledger-service"],
      },
      {
        key: "cards",
        label: "Cards",
        category: "operations",
        description: "Expose virtual and physical card management controls to enrolled customers.",
        enabled: true,
        rolloutStage: "controlled",
        adminManaged: true,
        dependsOn: ["card-service"],
      },
      {
        key: "loans",
        label: "Loans",
        category: "onboarding",
        description: "Show lending offers once onboarding and compliance requirements are satisfied.",
        enabled: true,
        rolloutStage: "pilot",
        adminManaged: true,
        dependsOn: ["loan-service", "kyc-service"],
      },
      {
        key: "qr",
        label: "QR Banking",
        category: "payments",
        description: "Enable scan-to-pay and merchant QR interactions for the tenant channel mix.",
        enabled: true,
        rolloutStage: "controlled",
        adminManaged: true,
        dependsOn: ["payment-service", "qr-service"],
      },
    ],
  };
}

function moduleCategory(moduleKey: string): "onboarding" | "payments" | "cards" | "operations" | "compliance" | "platform" {
  switch (moduleKey) {
    case "digital_onboarding":
    case "loans":
    case "savings":
      return "onboarding";
    case "transfers":
    case "payments":
    case "collections":
    case "notifications":
      return "payments";
    case "cards":
      return "cards";
    case "compliance":
    case "kyb":
      return "compliance";
    case "analytics":
    case "admin":
      return "platform";
    default:
      return "operations";
  }
}

function moduleDependencies(moduleKey: string) {
  switch (moduleKey) {
    case "digital_onboarding":
      return ["kyc-service", "workflow-service"];
    case "cards":
      return ["card-service"];
    case "transfers":
      return ["payment-service", "ledger-service"];
    case "notifications":
      return ["notification-service"];
    case "loans":
      return ["loan-service", "risk-service"];
    case "savings":
      return ["ledger-service"];
    default:
      return ["platform-core"];
  }
}

function moduleLabel(moduleKey: string) {
  return moduleKey
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function moduleFeatureFlag(moduleKey: string) {
  const normalized = moduleKey.trim().toLowerCase();
  const label = moduleLabel(normalized || "module");
  return {
    key: normalized,
    label,
    category: moduleCategory(normalized),
    description: `${label} provisioned automatically for a white-label partner rollout.`,
    enabled: true,
    rolloutStage: "general" as const,
    adminManaged: true,
    dependsOn: moduleDependencies(normalized),
  };
}

export async function ensurePlatformSeed(tenantId: string, seed: SeedCollections) {
  if (seededTenants.has(tenantId)) return;
  const db = await getDb();
  if (!db) return;

  const [
    existingTenants,
    existingTenantFlags,
    existingCustomers,
    existingCustomerCards,
    existingCardEvents,
    existingSavedBillers,
    existingBillPayments,
    existingTransfers,
    existingApprovals,
    existingWorkflowCases,
    existingOperatorActions,
    existingAuditEntries,
    existingExportJobs,
    existingPartnerRecords,
    existingPartnerApprovals,
  ] = await Promise.all([
    db.select({ id: tenants.id }).from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1),
    db.select({ id: tenantFeatureFlags.id }).from(tenantFeatureFlags).where(eq(tenantFeatureFlags.tenantId, tenantId)).limit(1),
    db.select({ id: customers.id }).from(customers).limit(1),
    db.select({ id: customerCards.id }).from(customerCards).limit(1),
    db.select({ id: customerCardEvents.id }).from(customerCardEvents).limit(1),
    db.select({ id: customerSavedBillers.id }).from(customerSavedBillers).limit(1),
    db.select({ id: customerBillPayments.id }).from(customerBillPayments).limit(1),
    db.select({ id: customerTransfers.id }).from(customerTransfers).limit(1),
    db.select({ id: customerApprovals.id }).from(customerApprovals).limit(1),
    db.select({ id: workflowCases.id }).from(workflowCases).limit(1),
    db.select({ id: operatorActions.id }).from(operatorActions).limit(1),
    db.select({ id: auditEntries.id }).from(auditEntries).limit(1),
    db.select({ id: exportJobs.id }).from(exportJobs).limit(1),
    db.select({ id: partnerOnboardingRecords.id }).from(partnerOnboardingRecords).limit(1),
    db.select({ id: partnerApprovalRecords.id }).from(partnerApprovalRecords).limit(1),
  ]);

  const tenant = seed.tenantConfiguration ?? defaultTenant(tenantId);

  if (!existingTenants.length) {
    await db.insert(tenants).values({
      tenantId,
      name: tenant.name,
      onboardingStatus: tenant.onboardingStatus,
      segment: tenant.segment,
      region: tenant.region,
      enabledModules: tenant.enabledModules,
      whiteLabel: tenant.whiteLabel,
    });
  }

  if (!existingTenantFlags.length && (tenant.featureFlags?.length ?? 0) > 0) {
    await db.insert(tenantFeatureFlags).values(
      (tenant.featureFlags ?? []).map((flag: any) => ({
        tenantId,
        featureKey: flag.key,
        label: flag.label,
        category: flag.category,
        description: flag.description,
        enabled: boolToInt(flag.enabled),
        rolloutStage: flag.rolloutStage,
        adminManaged: boolToInt(flag.adminManaged),
        dependsOn: flag.dependsOn ?? [],
      })),
    );
  }

  if (seed.customers.length > 0 && !existingCustomers.length) {
    await db.insert(customers).values(
      seed.customers.map((customer) => ({
        customerId: customer.id,
        tenantId,
        name: customer.name,
        segment: customer.segment,
        tier: customer.tier,
        location: customer.location,
        relationshipManager: customer.relationshipManager,
        risk: customer.risk,
        status: customer.status,
        bvn: customer.bvn,
        phone: customer.phone,
        balance: customer.balance,
        lastTouchpointLabel: customer.lastTouchpoint,
        lastTouchpointAt: new Date(),
      })),
    );
  }

  if (seed.customerCards.length > 0 && !existingCustomerCards.length) {
    await db.insert(customerCards).values(
      seed.customerCards.map((card) => ({
        cardId: card.id,
        customerId: card.customerId,
        cardType: card.type,
        brand: card.brand,
        lastFour: card.lastFour,
        expiryDate: card.expiryDate,
        cardHolder: card.cardHolder,
        balance: card.balance,
        isLocked: boolToInt(card.isLocked),
        controls: card.controls,
        spendingLimits: card.spendingLimits,
        colorTone: card.colorTone,
        updatedAt: toRequiredDate(card.updatedAt),
        createdAt: toRequiredDate(card.updatedAt),
      })),
    );
  }

  if (seed.customerCardEvents.length > 0 && !existingCardEvents.length) {
    await db.insert(customerCardEvents).values(
      seed.customerCardEvents.map((event) => ({
        eventId: event.id,
        cardId: event.cardId,
        customerId: event.customerId,
        title: event.title,
        detail: event.detail,
        severity: event.severity,
        createdAt: toRequiredDate(event.createdAt),
      })),
    );
  }

  if (seed.customerSavedBillers.length > 0 && !existingSavedBillers.length) {
    await db.insert(customerSavedBillers).values(
      seed.customerSavedBillers.map((item) => ({
        billerRecordId: item.id,
        customerId: item.customerId,
        category: item.category,
        provider: item.provider,
        billerId: item.billerId,
        customerReference: item.customerReference,
        nickname: item.nickname,
        lastAmount: item.lastAmount,
        verifiedName: item.verifiedName,
        lastPaidAt: toDate(item.lastPaidAt),
        createdAt: toRequiredDate(item.createdAt),
      })),
    );
  }

  if (seed.customerBillPayments.length > 0 && !existingBillPayments.length) {
    await db.insert(customerBillPayments).values(
      seed.customerBillPayments.map((payment) => ({
        paymentId: payment.id,
        customerId: payment.customerId,
        category: payment.category,
        provider: payment.provider,
        amount: payment.amount,
        status: payment.status,
        paidAt: toRequiredDate(payment.paidAt),
        reference: payment.reference,
        billerId: payment.billerId,
        customerReference: payment.customerReference,
        customerName: payment.customerName,
        scheduledFor: toDate(payment.scheduledFor),
        evidenceStatus: payment.evidenceStatus,
        channel: payment.channel,
      })),
    );
  }

  if (seed.customerTransfers.length > 0 && !existingTransfers.length) {
    await db.insert(customerTransfers).values(
      seed.customerTransfers.map((transfer) => ({
        transferId: transfer.id,
        customerId: transfer.customerId,
        beneficiaryId: transfer.beneficiaryId,
        beneficiaryName: transfer.beneficiaryName,
        amount: transfer.amount,
        narration: transfer.narration,
        transferType: transfer.transferType,
        status: transfer.status,
        bankCode: transfer.bankCode,
        bankName: transfer.bankName,
        accountNumber: transfer.accountNumber,
        accountName: transfer.accountName,
        workflowId: transfer.workflowId,
        otpReference: transfer.otpReference,
        otpIssuedAt: toDate(transfer.otpIssuedAt),
        confirmedAt: toDate(transfer.confirmedAt),
        approvalState: transfer.approvalState ?? "not_required",
        createdAt: toRequiredDate(transfer.createdAt),
        updatedAt: toRequiredDate(transfer.confirmedAt, transfer.createdAt),
      })),
    );
  }

  if (seed.customerApprovals.length > 0 && !existingApprovals.length) {
    await db.insert(customerApprovals).values(
      seed.customerApprovals.map((approval) => ({
        approvalId: approval.id,
        customerId: approval.customerId,
        entityType: approval.entityType,
        entityId: approval.entityId,
        title: approval.title,
        detail: approval.detail,
        route: approval.route,
        state: approval.state,
        requestedAt: toRequiredDate(approval.requestedAt),
        requestedByRole: approval.requestedByRole as any,
        requestedById: approval.requestedById,
        approvalRole: approval.approvalRole as any,
        resolvedAt: toDate(approval.resolvedAt),
        resolutionNote: approval.resolutionNote,
      })),
    );
  }

  if (seed.workflowCases.length > 0 && !existingWorkflowCases.length) {
    await db.insert(workflowCases).values(
      seed.workflowCases.map((workflow) => ({
        workflowId: workflow.id,
        customer: workflow.customer,
        product: workflow.product,
        stage: workflow.stage,
        status: workflow.status,
        channel: workflow.channel,
        amount: workflow.amount,
        nextAction: workflow.nextAction,
        slaHours: workflow.slaHours,
      })),
    );
  }

  if (seed.operatorActions.length > 0 && !existingOperatorActions.length) {
    await db.insert(operatorActions).values(
      seed.operatorActions.map((action) => ({
        actionId: action.id,
        domainKey: action.domainKey,
        title: action.title,
        detail: action.detail,
        owner: action.owner,
        dueAt: toRequiredDate(action.due),
        route: action.route,
        status: action.status,
        roles: action.roles ?? [],
      })),
    );
  }

  if (seed.auditTrail.length > 0 && !existingAuditEntries.length) {
    await db.insert(auditEntries).values(
      seed.auditTrail.map((entry) => ({
        auditId: entry.id,
        timestampAt: toRequiredDate(entry.timestamp),
        actorRole: entry.actorRole,
        actorId: entry.actorId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        outcome: entry.outcome,
        severity: entry.severity,
        route: entry.route,
        middleware: entry.middleware ?? [],
        detail: entry.detail,
      })),
    );
  }

  if (seed.exportJobs.length > 0 && !existingExportJobs.length) {
    await db.insert(exportJobs).values(
      seed.exportJobs.map((job) => ({
        exportJobId: job.id,
        domainKey: job.domainKey,
        title: job.title,
        format: job.format,
        status: job.status,
        createdAt: toRequiredDate(job.createdAt),
        requestedByRole: job.requestedByRole,
        route: job.route,
        rowCount: job.rowCount,
        approvalState: job.approvalState,
        approvalSignature: job.approvalSignature,
        downloadUrl: job.downloadUrl,
        retainedUntil: toDate(job.retainedUntil),
        reportVersion: job.reportVersion,
        approvalChain: job.approvalChain ?? [],
        signedBy: job.signedBy ?? [],
      })),
    );
  }

  if ((seed.partnerOnboardingRecords?.length ?? 0) > 0 && !existingPartnerRecords.length) {
    await db.insert(partnerOnboardingRecords).values(
      (seed.partnerOnboardingRecords ?? []).map((partner) => ({
        partnerId: partner.id,
        tenantId: partner.tenantId,
        partnerName: partner.partnerName,
        legalEntity: partner.legalEntity,
        partnerType: partner.partnerType,
        region: partner.region,
        stage: partner.stage,
        requestedModules: partner.requestedModules ?? [],
        primaryContact: partner.primaryContact,
        operationsContact: partner.operationsContact,
        commercial: partner.commercial,
        compliance: partner.compliance,
        branding: partner.branding,
        checklist: partner.checklist ?? [],
        blockers: partner.blockers ?? [],
        readinessScore: partner.readinessScore ?? 0,
        createdAt: toRequiredDate(partner.createdAt),
        updatedAt: toRequiredDate(partner.updatedAt, partner.createdAt),
        submittedAt: toDate(partner.submittedAt),
        launchedAt: toDate(partner.launchedAt),
        lastSubmittedBy: partner.lastSubmittedBy,
      })),
    );
  }

  if ((seed.partnerApprovalRecords?.length ?? 0) > 0 && !existingPartnerApprovals.length) {
    await db.insert(partnerApprovalRecords).values(
      (seed.partnerApprovalRecords ?? []).map((approval) => ({
        approvalId: approval.id,
        partnerId: approval.partnerId,
        stage: approval.stage,
        title: approval.title,
        detail: approval.detail,
        state: approval.state,
        requiredRole: approval.requiredRole,
        requestedAt: toRequiredDate(approval.requestedAt),
        requestedById: approval.requestedById,
        resolvedAt: toDate(approval.resolvedAt),
        resolutionNote: approval.resolutionNote,
      })),
    );
  }

  seededTenants.add(tenantId);
}

function mapTenant(base: any, flags: any[]) {
  return {
    tenantId: base.tenantId,
    name: base.name,
    onboardingStatus: base.onboardingStatus,
    segment: base.segment,
    region: base.region,
    enabledModules: base.enabledModules ?? [],
    featureFlags: flags.map((flag) => ({
      key: flag.featureKey,
      label: flag.label,
      category: flag.category,
      description: flag.description,
      enabled: intToBool(flag.enabled),
      rolloutStage: flag.rolloutStage,
      adminManaged: intToBool(flag.adminManaged),
      dependsOn: flag.dependsOn ?? [],
    })),
    whiteLabel: base.whiteLabel,
  };
}

export async function listTenantConfigurations() {
  const db = await getDb();
  if (!db) return [];
  const tenantRows = await db.select().from(tenants);
  const flagRows = await db.select().from(tenantFeatureFlags);
  return tenantRows.map((tenant) => mapTenant(tenant, flagRows.filter((flag) => flag.tenantId === tenant.tenantId)));
}

export async function updateTenantFeatureFlag(tenantId: string, featureKey: string, enabled: boolean) {
  const db = await getDb();
  if (!db) return null;
  await db.update(tenantFeatureFlags).set({ enabled: boolToInt(enabled), updatedAt: new Date() }).where(and(eq(tenantFeatureFlags.tenantId, tenantId), eq(tenantFeatureFlags.featureKey, featureKey)));
  const [tenant] = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
  if (!tenant) return null;
  const flags = await db.select().from(tenantFeatureFlags).where(eq(tenantFeatureFlags.tenantId, tenantId));
  return mapTenant(tenant, flags);
}

export async function updateTenantBranding(tenantId: string, whiteLabel: JsonObject) {
  const db = await getDb();
  if (!db) return null;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
  if (!tenant) return null;
  await db
    .update(tenants)
    .set({
      whiteLabel: {
        displayName: String((whiteLabel.displayName ?? (tenant.whiteLabel as any).displayName) ?? "54Bank Retail Platform"),
        legalEntity: String((whiteLabel.legalEntity ?? (tenant.whiteLabel as any).legalEntity) ?? "54Bank Platform Services Ltd"),
        supportEmail: String((whiteLabel.supportEmail ?? (tenant.whiteLabel as any).supportEmail) ?? "platform-operations@54bank.app"),
        primaryColor: String((whiteLabel.primaryColor ?? (tenant.whiteLabel as any).primaryColor) ?? "#047857"),
        accentColor: String((whiteLabel.accentColor ?? (tenant.whiteLabel as any).accentColor) ?? "#0f172a"),
        logoUrl: String((whiteLabel.logoUrl ?? (tenant.whiteLabel as any).logoUrl) ?? "https://assets.54bank.app/logos/54bank-primary.png"),
        loginHeadline: String((whiteLabel.loginHeadline ?? (tenant.whiteLabel as any).loginHeadline) ?? "Banking configured for retail launch teams and customer journeys."),
        ...(whiteLabel.customDomain !== undefined || (tenant.whiteLabel as any).customDomain !== undefined
          ? { customDomain: String((whiteLabel.customDomain ?? (tenant.whiteLabel as any).customDomain) ?? "app.54bank.app") }
          : {}),
      },
      updatedAt: new Date(),
    })
    .where(eq(tenants.tenantId, tenantId));
  const [nextTenant] = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
  const flags = await db.select().from(tenantFeatureFlags).where(eq(tenantFeatureFlags.tenantId, tenantId));
  return nextTenant ? mapTenant(nextTenant, flags) : null;
}

export async function provisionPartnerTenant(input: {
  tenantId: string;
  name: string;
  legalEntity: string;
  region: string;
  requestedModules: string[];
  whiteLabel: JsonObject;
}) {
  const db = await getDb();
  if (!db) return null;

  const normalizedModules = Array.from(new Set((input.requestedModules ?? []).map((item) => item.trim()).filter(Boolean)));
  const [existingTenant] = await db.select().from(tenants).where(eq(tenants.tenantId, input.tenantId)).limit(1);

  const whiteLabel = {
    displayName: String((input.whiteLabel.displayName ?? input.name) || input.name),
    legalEntity: String((input.whiteLabel.legalEntity ?? input.legalEntity) || input.legalEntity),
    supportEmail: String((input.whiteLabel.supportEmail ?? "platform-operations@54bank.app") || "platform-operations@54bank.app"),
    primaryColor: String((input.whiteLabel.primaryColor ?? "#047857") || "#047857"),
    accentColor: String((input.whiteLabel.accentColor ?? "#0f172a") || "#0f172a"),
    logoUrl: String((input.whiteLabel.logoUrl ?? "https://assets.54bank.app/logos/54bank-primary.png") || "https://assets.54bank.app/logos/54bank-primary.png"),
    loginHeadline: String((input.whiteLabel.loginHeadline ?? `${input.name} workspace is provisioned for launch.`) || `${input.name} workspace is provisioned for launch.`),
    ...(input.whiteLabel.customDomain !== undefined ? { customDomain: String(input.whiteLabel.customDomain ?? "") } : {}),
  };

  if (existingTenant) {
    await db
      .update(tenants)
      .set({
        name: input.name,
        onboardingStatus: "active",
        segment: existingTenant.segment,
        region: input.region,
        enabledModules: normalizedModules,
        whiteLabel,
        updatedAt: new Date(),
      })
      .where(eq(tenants.tenantId, input.tenantId));
  } else {
    await db.insert(tenants).values({
      tenantId: input.tenantId,
      name: input.name,
      onboardingStatus: "active",
      segment: "growth",
      region: input.region,
      enabledModules: normalizedModules,
      whiteLabel,
    });
  }

  await db.delete(tenantFeatureFlags).where(eq(tenantFeatureFlags.tenantId, input.tenantId));

  if (normalizedModules.length > 0) {
    await db.insert(tenantFeatureFlags).values(
      normalizedModules.map((moduleKey) => {
        const flag = moduleFeatureFlag(moduleKey);
        return {
          tenantId: input.tenantId,
          featureKey: flag.key,
          label: flag.label,
          category: flag.category,
          description: flag.description,
          enabled: boolToInt(flag.enabled),
          rolloutStage: flag.rolloutStage,
          adminManaged: boolToInt(flag.adminManaged),
          dependsOn: flag.dependsOn,
        };
      }),
    );
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.tenantId, input.tenantId)).limit(1);
  if (!tenant) return null;
  const flags = await db.select().from(tenantFeatureFlags).where(eq(tenantFeatureFlags.tenantId, input.tenantId));
  return mapTenant(tenant, flags);
}

export async function listCustomers(filters?: { q?: string; segment?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customers).orderBy(desc(customers.updatedAt));
  const q = (filters?.q ?? "").trim().toLowerCase();
  return rows
    .filter((customer) => {
      const matchesQuery = !q || [customer.customerId, customer.name, customer.location, customer.relationshipManager, customer.bvn, customer.phone].join(" ").toLowerCase().includes(q);
      const matchesSegment = !filters?.segment || filters.segment === "All" || customer.segment === filters.segment;
      const matchesStatus = !filters?.status || filters.status === "All" || customer.status === filters.status;
      return matchesQuery && matchesSegment && matchesStatus;
    })
    .map((customer) => ({
      id: customer.customerId,
      name: customer.name,
      segment: customer.segment,
      tier: customer.tier,
      location: customer.location,
      relationshipManager: customer.relationshipManager,
      risk: customer.risk,
      status: customer.status,
      bvn: customer.bvn,
      phone: customer.phone,
      balance: customer.balance,
      lastTouchpoint: customer.lastTouchpointLabel,
    }));
}

export async function getCustomer(customerId: string) {
  const db = await getDb();
  if (!db) return null;
  const [customer] = await db.select().from(customers).where(eq(customers.customerId, customerId)).limit(1);
  return customer
    ? {
        id: customer.customerId,
        name: customer.name,
        segment: customer.segment,
        tier: customer.tier,
        location: customer.location,
        relationshipManager: customer.relationshipManager,
        risk: customer.risk,
        status: customer.status,
        bvn: customer.bvn,
        phone: customer.phone,
        balance: customer.balance,
        lastTouchpoint: customer.lastTouchpointLabel,
      }
    : null;
}

export async function createCustomerRecord(tenantId: string, customerId: string, payload: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customers).values({
    customerId,
    tenantId,
    name: payload.name,
    segment: payload.segment ?? "Agriculture",
    tier: payload.tier ?? "Tier 1",
    location: payload.location,
    relationshipManager: payload.relationshipManager,
    risk: payload.risk ?? "Medium",
    status: payload.status ?? "Pending",
    bvn: payload.bvn ?? "Pending capture",
    phone: payload.phone ?? "Pending capture",
    balance: Number(payload.balance ?? 0),
    lastTouchpointLabel: "Just now",
    lastTouchpointAt: new Date(),
  });
  return getCustomer(customerId);
}

export async function updateCustomerRecord(customerId: string, payload: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(customers).set({
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.segment !== undefined ? { segment: payload.segment } : {}),
    ...(payload.tier !== undefined ? { tier: payload.tier } : {}),
    ...(payload.location !== undefined ? { location: payload.location } : {}),
    ...(payload.relationshipManager !== undefined ? { relationshipManager: payload.relationshipManager } : {}),
    ...(payload.risk !== undefined ? { risk: payload.risk } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.bvn !== undefined ? { bvn: payload.bvn } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
    ...(payload.balance !== undefined ? { balance: Number(payload.balance) } : {}),
    lastTouchpointLabel: "Just now",
    lastTouchpointAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(customers.customerId, customerId));
  return getCustomer(customerId);
}

export async function listCustomerCards(customerId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customerCards).where(eq(customerCards.customerId, customerId)).orderBy(desc(customerCards.updatedAt));
  return rows.map((card) => ({
    id: card.cardId,
    customerId: card.customerId,
    type: card.cardType,
    brand: card.brand,
    lastFour: card.lastFour,
    expiryDate: card.expiryDate,
    cardHolder: card.cardHolder,
    balance: card.balance,
    isLocked: intToBool(card.isLocked),
    controls: card.controls,
    spendingLimits: card.spendingLimits,
    colorTone: card.colorTone,
    updatedAt: toIso(card.updatedAt),
  }));
}

export async function getCustomerCard(cardId: string) {
  const db = await getDb();
  if (!db) return null;
  const [card] = await db.select().from(customerCards).where(eq(customerCards.cardId, cardId)).limit(1);
  if (!card) return null;
  return {
    id: card.cardId,
    customerId: card.customerId,
    type: card.cardType,
    brand: card.brand,
    lastFour: card.lastFour,
    expiryDate: card.expiryDate,
    cardHolder: card.cardHolder,
    balance: card.balance,
    isLocked: intToBool(card.isLocked),
    controls: card.controls,
    spendingLimits: card.spendingLimits,
    colorTone: card.colorTone,
    updatedAt: toIso(card.updatedAt),
  };
}

export async function updateCustomerCardRecord(cardId: string, payload: any) {
  const db = await getDb();
  if (!db) return null;
  const [card] = await db.select().from(customerCards).where(eq(customerCards.cardId, cardId)).limit(1);
  if (!card) return null;
  await db.update(customerCards).set({
    ...(payload.balance !== undefined ? { balance: Number(payload.balance) } : {}),
    ...(payload.isLocked !== undefined ? { isLocked: boolToInt(Boolean(payload.isLocked)) } : {}),
    ...(payload.controls !== undefined
      ? {
          controls: {
            online: Boolean((payload.controls as any).online ?? (card.controls as any).online),
            atm: Boolean((payload.controls as any).atm ?? (card.controls as any).atm),
            international: Boolean((payload.controls as any).international ?? (card.controls as any).international),
          },
        }
      : {}),
    ...(payload.spendingLimits !== undefined
      ? {
          spendingLimits: {
            daily: Number((payload.spendingLimits as any).daily ?? (card.spendingLimits as any).daily ?? 0),
            atm: Number((payload.spendingLimits as any).atm ?? (card.spendingLimits as any).atm ?? 0),
            online: Number((payload.spendingLimits as any).online ?? (card.spendingLimits as any).online ?? 0),
          },
        }
      : {}),
    updatedAt: new Date(),
  }).where(eq(customerCards.cardId, cardId));
  return getCustomerCard(cardId);
}

export async function addCustomerCardEvent(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customerCardEvents).values({
    eventId: input.id,
    cardId: input.cardId,
    customerId: input.customerId,
    title: input.title,
    detail: input.detail,
    severity: input.severity,
    createdAt: new Date(input.createdAt ?? new Date().toISOString()),
  });
  return input;
}

export async function listCustomerCardEvents(customerId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customerCardEvents).where(eq(customerCardEvents.customerId, customerId)).orderBy(desc(customerCardEvents.createdAt));
  return rows.map((event) => ({
    id: event.eventId,
    cardId: event.cardId,
    customerId: event.customerId,
    title: event.title,
    detail: event.detail,
    severity: event.severity,
    createdAt: toIso(event.createdAt),
  }));
}

export async function listCustomerSavedBillers(customerId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customerSavedBillers).where(eq(customerSavedBillers.customerId, customerId)).orderBy(desc(customerSavedBillers.createdAt));
  return rows.map((item) => ({
    id: item.billerRecordId,
    customerId: item.customerId,
    category: item.category,
    provider: item.provider,
    billerId: item.billerId,
    customerReference: item.customerReference,
    nickname: item.nickname,
    lastAmount: item.lastAmount,
    verifiedName: item.verifiedName ?? undefined,
    lastPaidAt: toIso(item.lastPaidAt),
    createdAt: toIso(item.createdAt) ?? new Date().toISOString(),
  }));
}

export async function createSavedBiller(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customerSavedBillers).values({
    billerRecordId: input.id,
    customerId: input.customerId,
    category: input.category,
    provider: input.provider,
    billerId: input.billerId,
    customerReference: input.customerReference,
    nickname: input.nickname,
    lastAmount: Number(input.lastAmount ?? 0),
    verifiedName: input.verifiedName,
    lastPaidAt: toDate(input.lastPaidAt),
    createdAt: new Date(input.createdAt ?? new Date().toISOString()),
  });
  return input;
}

export async function deleteSavedBiller(billerId: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(customerSavedBillers).where(eq(customerSavedBillers.billerRecordId, billerId)).limit(1);
  if (!row) return null;
  await db.delete(customerSavedBillers).where(eq(customerSavedBillers.billerRecordId, billerId));
  return {
    id: row.billerRecordId,
    customerId: row.customerId,
    category: row.category,
    provider: row.provider,
    billerId: row.billerId,
    customerReference: row.customerReference,
    nickname: row.nickname,
  };
}

export async function listCustomerBillPayments(customerId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customerBillPayments).where(eq(customerBillPayments.customerId, customerId)).orderBy(desc(customerBillPayments.paidAt));
  return rows.map((payment) => ({
    id: payment.paymentId,
    customerId: payment.customerId,
    category: payment.category,
    provider: payment.provider,
    amount: payment.amount,
    status: payment.status,
    paidAt: toIso(payment.paidAt) ?? new Date().toISOString(),
    reference: payment.reference,
    billerId: payment.billerId ?? undefined,
    customerReference: payment.customerReference ?? undefined,
    customerName: payment.customerName ?? undefined,
    scheduledFor: toIso(payment.scheduledFor),
    evidenceStatus: payment.evidenceStatus ?? undefined,
    channel: payment.channel ?? undefined,
  }));
}

export async function createBillPayment(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customerBillPayments).values({
    paymentId: input.id,
    customerId: input.customerId,
    category: input.category,
    provider: input.provider,
    amount: Number(input.amount),
    status: input.status,
    paidAt: new Date(input.paidAt),
    reference: input.reference,
    billerId: input.billerId,
    customerReference: input.customerReference,
    customerName: input.customerName,
    scheduledFor: toDate(input.scheduledFor),
    evidenceStatus: input.evidenceStatus,
    channel: input.channel,
  });
  return input;
}

export async function listCustomerTransfers(customerId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customerTransfers).where(eq(customerTransfers.customerId, customerId)).orderBy(desc(customerTransfers.createdAt));
  return rows.map((transfer) => ({
    id: transfer.transferId,
    customerId: transfer.customerId,
    beneficiaryId: transfer.beneficiaryId ?? undefined,
    beneficiaryName: transfer.beneficiaryName,
    amount: transfer.amount,
    narration: transfer.narration ?? undefined,
    transferType: transfer.transferType,
    status: transfer.status,
    createdAt: toIso(transfer.createdAt) ?? new Date().toISOString(),
    bankCode: transfer.bankCode ?? undefined,
    bankName: transfer.bankName ?? undefined,
    accountNumber: transfer.accountNumber ?? undefined,
    accountName: transfer.accountName ?? undefined,
    workflowId: transfer.workflowId ?? undefined,
    otpReference: transfer.otpReference ?? undefined,
    otpIssuedAt: toIso(transfer.otpIssuedAt),
    confirmedAt: toIso(transfer.confirmedAt),
    approvalState: transfer.approvalState ?? undefined,
  }));
}

export async function getCustomerTransfer(transferId: string) {
  const db = await getDb();
  if (!db) return null;
  const [transfer] = await db.select().from(customerTransfers).where(eq(customerTransfers.transferId, transferId)).limit(1);
  return transfer
    ? {
        id: transfer.transferId,
        customerId: transfer.customerId,
        beneficiaryId: transfer.beneficiaryId ?? undefined,
        beneficiaryName: transfer.beneficiaryName,
        amount: transfer.amount,
        narration: transfer.narration ?? undefined,
        transferType: transfer.transferType,
        status: transfer.status,
        createdAt: toIso(transfer.createdAt) ?? new Date().toISOString(),
        bankCode: transfer.bankCode ?? undefined,
        bankName: transfer.bankName ?? undefined,
        accountNumber: transfer.accountNumber ?? undefined,
        accountName: transfer.accountName ?? undefined,
        workflowId: transfer.workflowId ?? undefined,
        otpReference: transfer.otpReference ?? undefined,
        otpIssuedAt: toIso(transfer.otpIssuedAt),
        confirmedAt: toIso(transfer.confirmedAt),
        approvalState: transfer.approvalState ?? undefined,
      }
    : null;
}

export async function createTransfer(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customerTransfers).values({
    transferId: input.id,
    customerId: input.customerId,
    beneficiaryId: input.beneficiaryId,
    beneficiaryName: input.beneficiaryName,
    amount: Number(input.amount),
    narration: input.narration,
    transferType: input.transferType,
    status: input.status,
    bankCode: input.bankCode,
    bankName: input.bankName,
    accountNumber: input.accountNumber,
    accountName: input.accountName,
    workflowId: input.workflowId,
    otpReference: input.otpReference,
    otpIssuedAt: toDate(input.otpIssuedAt),
    confirmedAt: toDate(input.confirmedAt),
    approvalState: input.approvalState ?? "not_required",
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.createdAt),
  });
  return getCustomerTransfer(input.id);
}

export async function updateTransfer(transferId: string, payload: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(customerTransfers).set({
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.otpReference !== undefined ? { otpReference: payload.otpReference } : {}),
    ...(payload.otpIssuedAt !== undefined ? { otpIssuedAt: toDate(payload.otpIssuedAt) } : {}),
    ...(payload.confirmedAt !== undefined ? { confirmedAt: toDate(payload.confirmedAt) } : {}),
    ...(payload.approvalState !== undefined ? { approvalState: payload.approvalState } : {}),
    updatedAt: new Date(),
  }).where(eq(customerTransfers.transferId, transferId));
  return getCustomerTransfer(transferId);
}

export async function listCustomerApprovals(customerId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customerApprovals).where(eq(customerApprovals.customerId, customerId)).orderBy(desc(customerApprovals.requestedAt));
  return rows.map((approval) => ({
    id: approval.approvalId,
    customerId: approval.customerId,
    entityType: approval.entityType,
    entityId: approval.entityId,
    title: approval.title,
    detail: approval.detail,
    route: approval.route,
    state: approval.state,
    requestedAt: toIso(approval.requestedAt) ?? new Date().toISOString(),
    requestedByRole: approval.requestedByRole as any,
    requestedById: approval.requestedById,
    approvalRole: approval.approvalRole as any,
    resolvedAt: toIso(approval.resolvedAt) ?? undefined,
    resolutionNote: approval.resolutionNote ?? undefined,
  }));
}

export async function findPendingApproval(entityType: string, entityId: string) {
  const db = await getDb();
  if (!db) return null;
  const [approval] = await db
    .select()
    .from(customerApprovals)
    .where(and(eq(customerApprovals.entityType, entityType as any), eq(customerApprovals.entityId, entityId), eq(customerApprovals.state, "pending")))
    .limit(1);
  return approval
    ? {
        id: approval.approvalId,
        customerId: approval.customerId,
        entityType: approval.entityType,
        entityId: approval.entityId,
        title: approval.title,
        detail: approval.detail,
        route: approval.route,
        state: approval.state,
        requestedAt: toIso(approval.requestedAt) ?? new Date().toISOString(),
        requestedByRole: approval.requestedByRole as any,
        requestedById: approval.requestedById,
        approvalRole: approval.approvalRole as any,
        resolvedAt: toIso(approval.resolvedAt) ?? undefined,
        resolutionNote: approval.resolutionNote ?? undefined,
      }
    : null;
}

export async function createApproval(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customerApprovals).values({
    approvalId: input.id,
    customerId: input.customerId,
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    detail: input.detail,
    route: input.route,
    state: input.state ?? "pending",
    requestedAt: new Date(input.requestedAt ?? new Date().toISOString()),
    requestedByRole: input.requestedByRole,
    requestedById: input.requestedById,
    approvalRole: input.approvalRole,
    resolvedAt: toDate(input.resolvedAt),
    resolutionNote: input.resolutionNote,
  });
  return findPendingApproval(input.entityType, input.entityId);
}

export async function resolveApproval(approvalId: string, state: "approved" | "rejected", resolutionNote?: string) {
  const db = await getDb();
  if (!db) return null;
  await db.update(customerApprovals).set({ state, resolvedAt: new Date(), resolutionNote: resolutionNote ?? null }).where(eq(customerApprovals.approvalId, approvalId));
  const [approval] = await db.select().from(customerApprovals).where(eq(customerApprovals.approvalId, approvalId)).limit(1);
  return approval
    ? {
        id: approval.approvalId,
        customerId: approval.customerId,
        entityType: approval.entityType,
        entityId: approval.entityId,
        title: approval.title,
        detail: approval.detail,
        route: approval.route,
        state: approval.state,
        requestedAt: toIso(approval.requestedAt) ?? new Date().toISOString(),
        requestedByRole: approval.requestedByRole as any,
        requestedById: approval.requestedById,
        approvalRole: approval.approvalRole as any,
        resolvedAt: toIso(approval.resolvedAt) ?? undefined,
        resolutionNote: approval.resolutionNote ?? undefined,
      }
    : null;
}

export async function listCustomerStatements(customerId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customerStatements).where(eq(customerStatements.customerId, customerId)).orderBy(desc(customerStatements.occurredAt));
  return rows.map((statement) => ({
    id: statement.statementId,
    customerId: statement.customerId,
    title: statement.title,
    detail: statement.detail,
    amount: statement.amount,
    direction: statement.direction,
    type: statement.statementType,
    status: statement.status,
    timestamp: toIso(statement.occurredAt),
    reference: statement.reference ?? undefined,
    category: statement.category ?? undefined,
  }));
}

export async function createStatement(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customerStatements).values({
    statementId: input.id,
    customerId: input.customerId,
    title: input.title,
    detail: input.detail,
    amount: Number(input.amount),
    direction: input.direction,
    statementType: input.type,
    status: input.status,
    occurredAt: new Date(input.timestamp),
    reference: input.reference,
    category: input.category,
  });
  return input;
}

export async function listCustomerNotifications(customerId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customerNotifications).where(eq(customerNotifications.customerId, customerId)).orderBy(desc(customerNotifications.createdAt));
  return rows.map((notification) => ({
    id: notification.notificationId,
    customerId: notification.customerId,
    title: notification.title,
    message: notification.message,
    type: notification.notificationType,
    read: intToBool(notification.isRead),
    actionUrl: notification.actionUrl ?? undefined,
    createdAt: toIso(notification.createdAt),
  }));
}

export async function createNotification(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customerNotifications).values({
    notificationId: input.id,
    customerId: input.customerId,
    title: input.title,
    message: input.message,
    notificationType: input.type,
    isRead: boolToInt(Boolean(input.read)),
    actionUrl: input.actionUrl,
    createdAt: new Date(input.createdAt ?? new Date().toISOString()),
  });
  return input;
}

export async function markNotificationRead(notificationId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(customerNotifications).set({ isRead: 1 }).where(eq(customerNotifications.notificationId, notificationId));
}

export async function markAllNotificationsRead(customerId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(customerNotifications).set({ isRead: 1 }).where(eq(customerNotifications.customerId, customerId));
}

export async function listWorkflowCases() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(workflowCases).orderBy(desc(workflowCases.updatedAt));
  return rows.map((workflow) => ({
    id: workflow.workflowId,
    customer: workflow.customer,
    product: workflow.product,
    stage: workflow.stage,
    status: workflow.status,
    channel: workflow.channel,
    amount: workflow.amount,
    nextAction: workflow.nextAction,
    slaHours: workflow.slaHours,
  }));
}

export async function updateWorkflowCase(workflowId: string, payload: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(workflowCases).set({
    ...(payload.stage !== undefined ? { stage: payload.stage } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.nextAction !== undefined ? { nextAction: payload.nextAction } : {}),
    ...(payload.slaHours !== undefined ? { slaHours: Number(payload.slaHours) } : {}),
    updatedAt: new Date(),
  }).where(eq(workflowCases.workflowId, workflowId));
  const [workflow] = await db.select().from(workflowCases).where(eq(workflowCases.workflowId, workflowId)).limit(1);
  return workflow
    ? {
        id: workflow.workflowId,
        customer: workflow.customer,
        product: workflow.product,
        stage: workflow.stage,
        status: workflow.status,
        channel: workflow.channel,
        amount: workflow.amount,
        nextAction: workflow.nextAction,
        slaHours: workflow.slaHours,
      }
    : null;
}

export async function listOperatorActions(domainKey?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = domainKey
    ? await db.select().from(operatorActions).where(eq(operatorActions.domainKey, domainKey)).orderBy(desc(operatorActions.updatedAt))
    : await db.select().from(operatorActions).orderBy(desc(operatorActions.updatedAt));
  return rows.map((action) => ({
    id: action.actionId,
    domainKey: action.domainKey,
    title: action.title,
    detail: action.detail,
    owner: action.owner,
    due: toIso(action.dueAt),
    route: action.route,
    status: action.status,
    roles: action.roles ?? [],
  }));
}

export async function updateOperatorAction(actionId: string, status: string) {
  const db = await getDb();
  if (!db) return null;
  await db.update(operatorActions).set({ status: status as any, updatedAt: new Date() }).where(eq(operatorActions.actionId, actionId));
  const [action] = await db.select().from(operatorActions).where(eq(operatorActions.actionId, actionId)).limit(1);
  return action
    ? {
        id: action.actionId,
        domainKey: action.domainKey,
        title: action.title,
        detail: action.detail,
        owner: action.owner,
        due: toIso(action.dueAt),
        route: action.route,
        status: action.status,
        roles: action.roles ?? [],
      }
    : null;
}

export async function listAuditEntries(domainKey?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(auditEntries).orderBy(desc(auditEntries.timestampAt));
  return rows
    .map((entry) => ({
      id: entry.auditId,
      timestamp: toIso(entry.timestampAt),
      actorRole: entry.actorRole,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      outcome: entry.outcome,
      severity: entry.severity,
      route: entry.route,
      middleware: entry.middleware ?? [],
      detail: entry.detail,
    }))
    .filter((entry) => !domainKey || entry.route.includes(domainKey) || entry.entityType.includes(domainKey));
}

export async function createAuditEntry(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(auditEntries).values({
    auditId: input.id,
    timestampAt: new Date(input.timestamp ?? new Date().toISOString()),
    actorRole: input.actorRole,
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    outcome: input.outcome,
    severity: input.severity,
    route: input.route,
    middleware: input.middleware ?? [],
    detail: input.detail,
  });
  return input;
}

export async function listExportJobs(domainKey?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = domainKey
    ? await db.select().from(exportJobs).where(eq(exportJobs.domainKey, domainKey)).orderBy(desc(exportJobs.createdAt))
    : await db.select().from(exportJobs).orderBy(desc(exportJobs.createdAt));
  return rows.map((job) => ({
    id: job.exportJobId,
    domainKey: job.domainKey,
    title: job.title,
    format: job.format,
    status: job.status,
    createdAt: toIso(job.createdAt) ?? new Date().toISOString(),
    requestedByRole: job.requestedByRole as any,
    route: job.route,
    rowCount: job.rowCount,
    approvalState: job.approvalState,
    approvalSignature: job.approvalSignature,
    downloadUrl: job.downloadUrl,
    retainedUntil: toIso(job.retainedUntil),
    reportVersion: job.reportVersion ?? undefined,
    approvalChain: job.approvalChain ?? [],
    signedBy: job.signedBy ?? [],
  }));
}

export async function createExportJobRecord(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(exportJobs).values({
    exportJobId: input.id,
    domainKey: input.domainKey,
    title: input.title,
    format: input.format,
    status: input.status,
    createdAt: new Date(input.createdAt),
    requestedByRole: input.requestedByRole,
    route: input.route,
    rowCount: input.rowCount,
    approvalState: input.approvalState,
    approvalSignature: input.approvalSignature,
    downloadUrl: input.downloadUrl,
    retainedUntil: toDate(input.retainedUntil),
    reportVersion: input.reportVersion,
    approvalChain: input.approvalChain ?? [],
    signedBy: input.signedBy ?? [],
  });
  return input;
}

export async function createStatementExportRecord(input: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customerStatementExports).values({
    exportRequestId: input.exportRequestId,
    customerId: input.customerId,
    exportJobId: input.exportJobId,
    format: input.format,
    rowCount: input.rowCount,
    title: input.title,
    createdAt: new Date(input.createdAt),
  });
  return input;
}

export async function listCustomerStatementExports(customerId: string) {
  const db = await getDb();
  if (!db) return [];
  const links = await db.select().from(customerStatementExports).where(eq(customerStatementExports.customerId, customerId));
  const jobs = await db.select().from(exportJobs);
  const jobIds = new Set(links.map((link) => link.exportJobId));
  return jobs
    .filter((job) => jobIds.has(job.exportJobId))
    .sort((left, right) => (right.createdAt?.getTime?.() ?? 0) - (left.createdAt?.getTime?.() ?? 0))
    .map((job) => ({
      id: job.exportJobId,
      domainKey: job.domainKey,
      title: job.title,
      format: job.format,
      status: job.status,
      createdAt: toIso(job.createdAt) ?? new Date().toISOString(),
      requestedByRole: job.requestedByRole as any,
      route: job.route,
      rowCount: job.rowCount,
      approvalState: job.approvalState,
      approvalSignature: job.approvalSignature,
      downloadUrl: job.downloadUrl,
      retainedUntil: toIso(job.retainedUntil),
      reportVersion: job.reportVersion ?? undefined,
      approvalChain: job.approvalChain ?? [],
      signedBy: job.signedBy ?? [],
    }));
}

export async function searchPlatformRecords(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const [customerRows, workflowRows, actionRows, auditRows] = await Promise.all([
    listCustomers({ q }),
    listWorkflowCases(),
    listOperatorActions(),
    listAuditEntries(),
  ]);
  const results = [
    ...customerRows
      .filter((item) => [item.id, item.name, item.location, item.relationshipManager].join(" ").toLowerCase().includes(q))
      .map((item) => ({ id: item.id, title: item.name, subtitle: `${item.segment} · ${item.status}`, route: "/", domain: "customer" })),
    ...workflowRows
      .filter((item) => [item.id, item.customer, item.product, item.stage].join(" ").toLowerCase().includes(q))
      .map((item) => ({ id: item.id, title: item.product, subtitle: `${item.customer} · ${item.stage}`, route: "/", domain: "workflow" })),
    ...actionRows
      .filter((item) => [item.id, item.title, item.detail, item.owner].join(" ").toLowerCase().includes(q))
      .map((item) => ({ id: item.id, title: item.title, subtitle: `${item.domainKey} · ${item.status}`, route: item.route, domain: "action" })),
    ...auditRows
      .filter((item) => [item.id, item.entityId, item.outcome, item.detail].join(" ").toLowerCase().includes(q))
      .map((item) => ({ id: item.id, title: item.outcome, subtitle: `${item.entityType} · ${item.severity}`, route: item.route, domain: "audit" })),
  ];
  return results.slice(0, 24);
}

export async function loadRuntimeStateFromDb() {
  const db = await getDb();
  if (!db) return null;

  const [
    customerRows,
    cardRows,
    cardEventRows,
    savedBillerRows,
    billPaymentRows,
    transferRows,
    approvalRows,
    workflowRows,
    actionRows,
    auditRows,
    exportRows,
    partnerRows,
    partnerApprovalRows,
  ] = await Promise.all([
    listCustomers(),
    db.select().from(customerCards).orderBy(desc(customerCards.updatedAt)),
    db.select().from(customerCardEvents).orderBy(desc(customerCardEvents.createdAt)),
    db.select().from(customerSavedBillers).orderBy(desc(customerSavedBillers.createdAt)),
    db.select().from(customerBillPayments).orderBy(desc(customerBillPayments.paidAt)),
    db.select().from(customerTransfers).orderBy(desc(customerTransfers.createdAt)),
    db.select().from(customerApprovals).orderBy(desc(customerApprovals.requestedAt)),
    listWorkflowCases(),
    listOperatorActions(),
    listAuditEntries(),
    listExportJobs(),
    db.select().from(partnerOnboardingRecords).orderBy(desc(partnerOnboardingRecords.updatedAt)),
    db.select().from(partnerApprovalRecords).orderBy(desc(partnerApprovalRecords.requestedAt)),
  ]);

  return {
    customers: customerRows,
    customerCards: cardRows.map((card) => ({
      id: card.cardId,
      customerId: card.customerId,
      type: card.cardType,
      brand: card.brand,
      lastFour: card.lastFour,
      expiryDate: card.expiryDate,
      cardHolder: card.cardHolder,
      balance: card.balance,
      isLocked: intToBool(card.isLocked),
      controls: card.controls,
      spendingLimits: card.spendingLimits,
      colorTone: card.colorTone,
      updatedAt: toIso(card.updatedAt),
    })),
    customerCardEvents: cardEventRows.map((event) => ({
      id: event.eventId,
      cardId: event.cardId,
      customerId: event.customerId,
      title: event.title,
      detail: event.detail,
      severity: event.severity,
      createdAt: toIso(event.createdAt),
    })),
    customerSavedBillers: savedBillerRows.map((item) => ({
      id: item.billerRecordId,
      customerId: item.customerId,
      category: item.category,
      provider: item.provider,
      billerId: item.billerId,
      customerReference: item.customerReference,
      nickname: item.nickname,
      lastAmount: item.lastAmount,
      verifiedName: item.verifiedName ?? undefined,
      lastPaidAt: toIso(item.lastPaidAt),
      createdAt: toIso(item.createdAt) ?? new Date().toISOString(),
    })),
    customerBillPayments: billPaymentRows.map((payment) => ({
      id: payment.paymentId,
      customerId: payment.customerId,
      category: payment.category,
      provider: payment.provider,
      amount: payment.amount,
      status: payment.status,
      paidAt: toIso(payment.paidAt) ?? new Date().toISOString(),
      reference: payment.reference,
      billerId: payment.billerId ?? undefined,
      customerReference: payment.customerReference ?? undefined,
      customerName: payment.customerName ?? undefined,
      scheduledFor: toIso(payment.scheduledFor),
      evidenceStatus: payment.evidenceStatus ?? undefined,
      channel: payment.channel ?? undefined,
    })),
    customerTransfers: transferRows.map((transfer) => ({
      id: transfer.transferId,
      customerId: transfer.customerId,
      beneficiaryId: transfer.beneficiaryId ?? undefined,
      beneficiaryName: transfer.beneficiaryName,
      amount: transfer.amount,
      narration: transfer.narration ?? undefined,
      transferType: transfer.transferType,
      status: transfer.status,
      createdAt: toIso(transfer.createdAt) ?? new Date().toISOString(),
      bankCode: transfer.bankCode ?? undefined,
      bankName: transfer.bankName ?? undefined,
      accountNumber: transfer.accountNumber ?? undefined,
      accountName: transfer.accountName ?? undefined,
      workflowId: transfer.workflowId ?? undefined,
      otpReference: transfer.otpReference ?? undefined,
      otpIssuedAt: toIso(transfer.otpIssuedAt),
      confirmedAt: toIso(transfer.confirmedAt),
      approvalState: transfer.approvalState ?? undefined,
    })),
    customerApprovals: approvalRows.map((approval) => ({
      id: approval.approvalId,
      customerId: approval.customerId,
      entityType: approval.entityType,
      entityId: approval.entityId,
      title: approval.title,
      detail: approval.detail,
      route: approval.route,
      state: approval.state,
      requestedAt: toIso(approval.requestedAt) ?? new Date().toISOString(),
      requestedByRole: approval.requestedByRole as any,
      requestedById: approval.requestedById,
      approvalRole: approval.approvalRole as any,
      resolvedAt: toIso(approval.resolvedAt) ?? undefined,
      resolutionNote: approval.resolutionNote ?? undefined,
    })),
    workflowCases: workflowRows,
    operatorActions: actionRows,
    auditTrail: auditRows,
    exportJobs: exportRows,
    partnerOnboardingRecords: partnerRows.length
      ? partnerRows.map((partner) => ({
          id: partner.partnerId,
          tenantId: partner.tenantId,
          partnerName: partner.partnerName,
          legalEntity: partner.legalEntity,
          partnerType: partner.partnerType,
          region: partner.region,
          stage: partner.stage,
          requestedModules: partner.requestedModules,
          primaryContact: partner.primaryContact,
          operationsContact: partner.operationsContact,
          commercial: partner.commercial,
          compliance: partner.compliance,
          branding: partner.branding,
          checklist: partner.checklist,
          blockers: partner.blockers,
          readinessScore: partner.readinessScore,
          createdAt: toIso(partner.createdAt) ?? new Date().toISOString(),
          updatedAt: toIso(partner.updatedAt) ?? new Date().toISOString(),
          submittedAt: toIso(partner.submittedAt),
          launchedAt: toIso(partner.launchedAt),
          lastSubmittedBy: partner.lastSubmittedBy ?? undefined,
        }))
      : undefined,
    partnerApprovalRecords: partnerApprovalRows.length
      ? partnerApprovalRows.map((approval) => ({
          id: approval.approvalId,
          partnerId: approval.partnerId,
          stage: approval.stage,
          title: approval.title,
          detail: approval.detail,
          state: approval.state,
          requiredRole: approval.requiredRole,
          requestedAt: toIso(approval.requestedAt) ?? new Date().toISOString(),
          requestedById: approval.requestedById,
          resolvedAt: toIso(approval.resolvedAt),
          resolutionNote: approval.resolutionNote ?? undefined,
        }))
      : undefined,
  };
}

export async function syncRuntimeStateToDb(tenantId: string, state: SeedCollections) {
  return replaceRuntimeState(tenantId, state);
}

export async function replaceRuntimeState(tenantId: string, state: SeedCollections) {
  const db = await getDb();
  if (!db) return;
  await db.delete(partnerApprovalRecords);
  await db.delete(partnerOnboardingRecords);
  await db.delete(customerApprovals);
  await db.delete(customerStatementExports);
  await db.delete(customerStatements);
  await db.delete(customerNotifications);
  await db.delete(customerBillPayments);
  await db.delete(customerTransfers);
  await db.delete(customerSavedBillers);
  await db.delete(customerCards);
  await db.delete(operatorActions);
  await db.delete(workflowCases);
  await db.delete(auditEntries);
  await db.delete(exportJobs);
  await db.delete(tenantFeatureFlags);
  await db.delete(tenants);
  await db.delete(customers);
  seededTenants.delete(tenantId);
  await ensurePlatformSeed(tenantId, state);
}

export async function getCustomerSessionPreference(input: { actorId: string; actorRole: string; tenantId: string }) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(customerSessionPreferences)
    .where(eq(customerSessionPreferences.actorId, input.actorId))
    .limit(20);

  const row = rows.find(
    (entry) => entry.actorRole === input.actorRole && entry.tenantId === input.tenantId,
  );

  return row
    ? {
        id: row.id,
        actorId: row.actorId,
        actorRole: row.actorRole,
        tenantId: row.tenantId,
        activeCustomerId: row.activeCustomerId,
        createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
        updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
      }
    : null;
}

export async function upsertCustomerSessionPreference(input: {
  actorId: string;
  actorRole: string;
  tenantId: string;
  activeCustomerId: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getCustomerSessionPreference({
    actorId: input.actorId,
    actorRole: input.actorRole,
    tenantId: input.tenantId,
  });

  if (existing) {
    const matchingPreferenceIds = await db
      .select({ id: customerSessionPreferences.id })
      .from(customerSessionPreferences)
      .where(eq(customerSessionPreferences.actorId, input.actorId))
      .limit(20);

    const targetIds = matchingPreferenceIds
      .filter((entry) => existing.id === undefined || entry.id === existing.id)
      .map((entry) => entry.id);

    for (const id of targetIds) {
      await db
        .update(customerSessionPreferences)
        .set({ activeCustomerId: input.activeCustomerId, updatedAt: new Date() })
        .where(eq(customerSessionPreferences.id, id));
    }
  } else {
    await db.insert(customerSessionPreferences).values({
      actorId: input.actorId,
      actorRole: input.actorRole,
      tenantId: input.tenantId,
      activeCustomerId: input.activeCustomerId,
    });
  }

  return getCustomerSessionPreference({
    actorId: input.actorId,
    actorRole: input.actorRole,
    tenantId: input.tenantId,
  });
}
