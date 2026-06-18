import {
  defaultBillingApprovalMatrices,
  defaultBillingInvoiceDisputes,
  type BillingApprovalMatrix,
  type BillingInvoiceDispute,
  type BillingErpPostingAttempt,
  type BillingInvoiceExportBundle,
  buildErpPostingPayload,
  buildIngestionBridgeSummary,
  buildInvoiceApprovalsFromMatrix,
  buildInvoiceExportBundles,
} from "../shared/billingAutomation";
import type { BillingInvoiceApproval } from "../shared/billingEngine";
import {
  createBillingUsageEvent,
  ensureBillingEngineSeed,
  generateBillingInvoices,
  getBillingDashboard,
  listBillingAccounts,
  listBillingContractOverrides,
  listBillingDiscountRules,
  listBillingInvoiceApprovals,
  listBillingInvoiceLines,
  listBillingInvoices,
  listBillingRevenueShareRules,
  listBillingUsageEvents,
} from "./billingEngine";

const approvalMatrices = [...defaultBillingApprovalMatrices];
const invoiceDisputes = [...defaultBillingInvoiceDisputes];
const erpPostingAttempts: BillingErpPostingAttempt[] = [];

const nextId = (prefix: string, length: number) => `${prefix}-${String(length + 1).padStart(3, "0")}`;

export async function listBillingApprovalMatrices() {
  await ensureBillingEngineSeed();
  return approvalMatrices;
}

export async function createBillingApprovalMatrix(input: Omit<BillingApprovalMatrix, "id" | "createdAt">) {
  const item: BillingApprovalMatrix = {
    id: nextId("BAM", approvalMatrices.length),
    createdAt: new Date().toISOString(),
    ...input,
  };
  approvalMatrices.unshift(item);
  return item;
}

export async function listBillingInvoiceDisputes() {
  await ensureBillingEngineSeed();
  return invoiceDisputes;
}

export async function createBillingInvoiceDispute(input: Omit<BillingInvoiceDispute, "id" | "openedAt" | "updatedAt" | "status">) {
  const item: BillingInvoiceDispute = {
    id: nextId("BID", invoiceDisputes.length),
    status: "open",
    openedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...input,
  };
  invoiceDisputes.unshift(item);
  return item;
}

export async function resolveBillingInvoiceDispute(input: {
  disputeId: string;
  status: "under_review" | "resolved" | "rejected";
  resolutionNote?: string;
}) {
  const dispute = invoiceDisputes.find((item) => item.id === input.disputeId);
  if (!dispute) return null;
  dispute.status = input.status;
  dispute.updatedAt = new Date().toISOString();
  dispute.resolutionNote = input.resolutionNote;
  return dispute;
}

export async function exportBillingInvoice(invoiceId: string, format: "csv" | "json" | "html" = "json") {
  await ensureBillingEngineSeed();
  const [invoices, lines, approvals] = await Promise.all([
    listBillingInvoices(),
    listBillingInvoiceLines(),
    listBillingInvoiceApprovals(),
  ]);
  const invoice = invoices.find((item) => item.id === invoiceId);
  if (!invoice) return null;
  const bundle = buildInvoiceExportBundles(invoice, lines, approvals).find((item) => item.format === format) ?? null;
  return bundle;
}

export async function queueBillingInvoiceErpPosting(args: { invoiceId: string; erpSystem?: "erpnext" | "lakehouse_finance" }) {
  await ensureBillingEngineSeed();
  const [accounts, invoices, lines, revenueShareRules] = await Promise.all([
    listBillingAccounts(),
    listBillingInvoices(),
    listBillingInvoiceLines(),
    listBillingRevenueShareRules(),
  ]);
  const invoice = invoices.find((item) => item.id === args.invoiceId);
  if (!invoice) return null;
  const account = accounts.find((item) => item.id === invoice.billingAccountId);
  const attempt: BillingErpPostingAttempt = {
    id: nextId("BEP", erpPostingAttempts.length),
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    tenantId: invoice.tenantId,
    status: "queued",
    erpSystem: args.erpSystem ?? "erpnext",
    reference: `${args.erpSystem ?? "erpnext"}-${invoice.invoiceNumber}`,
    payload: buildErpPostingPayload({
      invoice,
      account,
      lines,
      revenueShareRules,
    }),
    queuedAt: new Date().toISOString(),
  };
  erpPostingAttempts.unshift(attempt);
  return attempt;
}

export async function listBillingErpPostingAttempts() {
  return erpPostingAttempts;
}

export async function markBillingErpPostingResult(args: { attemptId: string; status: "posted" | "failed"; errorMessage?: string }) {
  const attempt = erpPostingAttempts.find((item) => item.id === args.attemptId);
  if (!attempt) return null;
  attempt.status = args.status;
  attempt.postedAt = new Date().toISOString();
  attempt.errorMessage = args.errorMessage;
  return attempt;
}

export async function generateBillingInvoicesWithMatrix(args: {
  billingAccountId?: string;
  periodType?: "monthly" | "quarterly" | "semi_annual" | "annual" | "custom";
  generatedBy: string;
}) {
  await ensureBillingEngineSeed();
  const base = await generateBillingInvoices(args);
  const matrices = await listBillingApprovalMatrices();
  const invoiceApprovals: BillingInvoiceApproval[] = [];

  for (const invoice of base.invoices) {
    const matrix = matrices.find(
      (item) => item.billingAccountId === invoice.billingAccountId && item.tenantId === invoice.tenantId && item.status === "active",
    );
    const approvals = buildInvoiceApprovalsFromMatrix({ invoice, matrix });
    invoice.approvalStepCount = approvals.length;
    if (approvals.length > 0) {
      invoice.status = approvals.every((item) => item.status === "approved") ? "approved" : "pending_approval";
      invoice.approvalStatus = approvals.every((item) => item.status === "approved") ? "approved" : "pending";
    }
    invoiceApprovals.push(...approvals);
  }

  return {
    ...base,
    invoiceApprovals,
  };
}

export async function ingestBillingUsageViaMiddleware(input: {
  tenantId: string;
  billingAccountId?: string;
  idempotencyKey?: string;
  sourceService: string;
  sourceEventType: string;
  meterKey: string;
  productKey: string;
  quantity: number;
  currency?: string;
  actorId?: string;
  resourceId?: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
  bridge?: "kafka" | "dapr" | "fluvio" | "tigerbeetle";
}) {
  const bridgeName = input.bridge ?? "kafka";
  const middleware =
    bridgeName === "dapr"
      ? ["Dapr", "Redis", "Postgres", "APISIX", "OpenAppSec"]
      : bridgeName === "fluvio"
        ? ["Fluvio", "Lakehouse", "Postgres"]
        : bridgeName === "tigerbeetle"
          ? ["TigerBeetle", "Kafka", "Postgres"]
          : ["Kafka", "Redis", "Postgres", "Lakehouse"];

  return createBillingUsageEvent({
    ...input,
    idempotencyKey: input.idempotencyKey ?? `${bridgeName}-${Date.now()}`,
    currency: input.currency ?? "NGN",
    eventTimestamp: new Date().toISOString(),
    payload: {
      ...(input.payload ?? {}),
      middleware,
      bridge: bridgeName,
      ingestionMode: "middleware_backed",
    },
  });
}

export async function getBillingExtendedDashboard() {
  await ensureBillingEngineSeed();
  const [dashboard, usageEvents, invoices, disputes, matrices, postings, overrides, discountRules, revenueShareRules] = await Promise.all([
    getBillingDashboard(),
    listBillingUsageEvents(200),
    listBillingInvoices(),
    listBillingInvoiceDisputes(),
    listBillingApprovalMatrices(),
    listBillingErpPostingAttempts(),
    listBillingContractOverrides(),
    listBillingDiscountRules(),
    listBillingRevenueShareRules(),
  ]);

  return {
    ...dashboard,
    liveIngestion: buildIngestionBridgeSummary(usageEvents),
    disputes,
    approvalMatrices: matrices,
    erpPostings: postings,
    controls: {
      overrideCount: overrides.length,
      discountRuleCount: discountRules.length,
      revenueShareRuleCount: revenueShareRules.length,
      disputeCount: disputes.length,
      matrixCount: matrices.length,
      queuedErpPostings: postings.filter((item) => item.status === "queued").length,
      issuedInvoices: invoices.filter((item) => item.status === "issued" || item.status === "approved").length,
    },
  };
}
