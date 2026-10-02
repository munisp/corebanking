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
import { ensureTables, storeDDL, storeSeed, storeList, storeGet, storeInsert, storeReplace } from "./lib/pgJsonStore";

// W12-C3-P0: approval matrices / invoice disputes / ERP posting attempts were
// module-level in-memory arrays (lost on restart). They are now
// Postgres-authoritative (billing_approval_matrices / invoice_disputes /
// erp_posting_attempts) via the server's drizzle pool; the former in-memory
// defaults are seeded once (ON CONFLICT DO NOTHING).

let ensured: Promise<void> | null = null;
function ensureBillingAutomationStore(): Promise<void> {
  if (!ensured) {
    ensured = ensureTables("billingAutomation", [
      ...storeDDL("billing_approval_matrices"),
      ...storeDDL("invoice_disputes"),
      ...storeDDL("erp_posting_attempts"),
    ])
      .then(async () => {
        await storeSeed("billing_approval_matrices", defaultBillingApprovalMatrices, (m: any) => m.tenantId ?? "");
        await storeSeed("invoice_disputes", defaultBillingInvoiceDisputes, (d: any) => d.tenantId ?? "");
      })
      .catch((err) => { ensured = null; throw err; });
  }
  return ensured;
}

const nextId = (prefix: string, length: number) => `${prefix}-${String(length + 1).padStart(3, "0")}-${Date.now()}`;

export async function listBillingApprovalMatrices() {
  await ensureBillingEngineSeed();
  await ensureBillingAutomationStore();
  return (await storeList<BillingApprovalMatrix>("billing_approval_matrices")).reverse();
}

export async function createBillingApprovalMatrix(input: Omit<BillingApprovalMatrix, "id" | "createdAt">) {
  await ensureBillingAutomationStore();
  const existing = await storeList<BillingApprovalMatrix>("billing_approval_matrices");
  const item: BillingApprovalMatrix = {
    id: nextId("BAM", existing.length),
    createdAt: new Date().toISOString(),
    ...input,
  };
  // W12-C3-P0: persists to Postgres (was memory-only unshift).
  await storeInsert("billing_approval_matrices", item.tenantId ?? "", item);
  return item;
}

export async function listBillingInvoiceDisputes() {
  await ensureBillingEngineSeed();
  await ensureBillingAutomationStore();
  return (await storeList<BillingInvoiceDispute>("invoice_disputes")).reverse();
}

export async function createBillingInvoiceDispute(input: Omit<BillingInvoiceDispute, "id" | "openedAt" | "updatedAt" | "status">) {
  await ensureBillingAutomationStore();
  const existing = await storeList<BillingInvoiceDispute>("invoice_disputes");
  const item: BillingInvoiceDispute = {
    id: nextId("BID", existing.length),
    status: "open",
    openedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...input,
  };
  // W12-C3-P0: persists to Postgres (was memory-only unshift).
  await storeInsert("invoice_disputes", item.tenantId ?? "", item);
  return item;
}

export async function resolveBillingInvoiceDispute(input: {
  disputeId: string;
  status: "under_review" | "resolved" | "rejected";
  resolutionNote?: string;
}) {
  await ensureBillingAutomationStore();
  const dispute = await storeGet<BillingInvoiceDispute>("invoice_disputes", input.disputeId);
  if (!dispute) return null;
  dispute.status = input.status;
  dispute.updatedAt = new Date().toISOString();
  dispute.resolutionNote = input.resolutionNote;
  // W12-C3-P0: resolution persists (was memory-only).
  await storeReplace("invoice_disputes", dispute.id, dispute);
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
  await ensureBillingAutomationStore();
  const existingAttempts = await storeList<BillingErpPostingAttempt>("erp_posting_attempts");
  const attempt: BillingErpPostingAttempt = {
    id: nextId("BEP", existingAttempts.length),
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
  // W12-C3-P0: persists to Postgres (was memory-only unshift).
  await storeInsert("erp_posting_attempts", attempt.tenantId ?? "", attempt);
  return attempt;
}

export async function listBillingErpPostingAttempts() {
  await ensureBillingAutomationStore();
  return (await storeList<BillingErpPostingAttempt>("erp_posting_attempts")).reverse();
}

export async function markBillingErpPostingResult(args: { attemptId: string; status: "posted" | "failed"; errorMessage?: string }) {
  await ensureBillingAutomationStore();
  const attempt = await storeGet<BillingErpPostingAttempt>("erp_posting_attempts", args.attemptId);
  if (!attempt) return null;
  attempt.status = args.status;
  attempt.postedAt = new Date().toISOString();
  attempt.errorMessage = args.errorMessage;
  // W12-C3-P0: posting result persists (was memory-only).
  await storeReplace("erp_posting_attempts", attempt.id, attempt);
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
