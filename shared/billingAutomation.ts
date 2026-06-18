import type {
  BillingAccount,
  BillingInvoice,
  BillingInvoiceApproval,
  BillingInvoiceLine,
  BillingRevenueShareRule,
  BillingUsageEvent,
} from "./billingEngine";

export type BillingApprovalMatrixStage = {
  stageKey: string;
  actorRole: "operations" | "treasury" | "compliance" | "branch";
  label: string;
  minimumAmount?: number;
  maximumAmount?: number;
  autoApprove?: boolean;
};

export type BillingApprovalMatrix = {
  id: string;
  tenantId: string;
  billingAccountId: string;
  name: string;
  status: "draft" | "active" | "retired";
  stages: BillingApprovalMatrixStage[];
  createdBy: string;
  createdAt: string;
};

export type BillingInvoiceDispute = {
  id: string;
  invoiceId: string;
  tenantId: string;
  status: "open" | "under_review" | "resolved" | "rejected";
  severity: "low" | "medium" | "high";
  reasonCode: "usage_dispute" | "pricing_dispute" | "tax_dispute" | "contract_dispute" | "duplicate_invoice";
  title: string;
  detail: string;
  openedBy: string;
  assignedRole: "operations" | "treasury" | "compliance" | "branch";
  openedAt: string;
  updatedAt: string;
  resolutionNote?: string;
};

export type BillingInvoiceExportBundle = {
  invoiceId: string;
  invoiceNumber: string;
  format: "csv" | "json" | "html";
  fileName: string;
  contentType: string;
  body: string;
};

export type BillingErpPostingAttempt = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  status: "queued" | "posted" | "failed";
  erpSystem: "erpnext" | "lakehouse_finance";
  reference: string;
  payload: Record<string, unknown>;
  queuedAt: string;
  postedAt?: string;
  errorMessage?: string;
};

export type BillingIngestionBridgeSummary = {
  middleware: Array<"Kafka" | "Dapr" | "Redis" | "Fluvio" | "TigerBeetle" | "Lakehouse" | "APISIX" | "OpenAppSec">;
  lastIngestedAt?: string;
  serviceBreakdown: Array<{
    sourceService: string;
    eventCount: number;
    quantity: number;
  }>;
  meterBreakdown: Array<{
    meterKey: string;
    productKey: string;
    eventCount: number;
    quantity: number;
  }>;
};

export const defaultBillingApprovalMatrices: BillingApprovalMatrix[] = [
  {
    id: "BAM-001",
    tenantId: "54bank-platform-prod",
    billingAccountId: "BAC-001",
    name: "Enterprise monthly invoice controls",
    status: "active",
    createdBy: "commercial.ops",
    createdAt: "2026-05-09T08:00:00.000Z",
    stages: [
      {
        stageKey: "operations_review",
        actorRole: "operations",
        label: "Operations review",
        minimumAmount: 0,
      },
      {
        stageKey: "treasury_signoff",
        actorRole: "treasury",
        label: "Treasury sign-off",
        minimumAmount: 500000,
      },
      {
        stageKey: "compliance_release",
        actorRole: "compliance",
        label: "Compliance release",
        minimumAmount: 1000000,
      },
    ],
  },
];

export const defaultBillingInvoiceDisputes: BillingInvoiceDispute[] = [
  {
    id: "BID-001",
    invoiceId: "BINV-001",
    tenantId: "54bank-platform-prod",
    status: "under_review",
    severity: "medium",
    reasonCode: "usage_dispute",
    title: "Transfer volume variance review",
    detail: "Treasury requested a review of transfer meter volume against TigerBeetle settlement totals before invoice issue.",
    openedBy: "treasury.controller",
    assignedRole: "operations",
    openedAt: "2026-05-09T09:30:00.000Z",
    updatedAt: "2026-05-09T10:00:00.000Z",
  },
];

export function buildInvoiceCsv(invoice: BillingInvoice, lines: BillingInvoiceLine[]) {
  const header = "invoiceNumber,period,currency,lineType,description,quantity,unitPrice,amount\n";
  const rows = lines
    .filter((line) => line.invoiceId === invoice.id)
    .map(
      (line) =>
        `${invoice.invoiceNumber},${invoice.billingPeriodKey},${invoice.currency},${line.lineType},${escapeCsv(line.description)},${line.quantity},${line.unitPrice},${line.amount}`,
    )
    .join("\n");
  return `${header}${rows}\n`;
}

export function buildInvoiceHtml(invoice: BillingInvoice, lines: BillingInvoiceLine[], approvals: BillingInvoiceApproval[]) {
  const invoiceLines = lines.filter((line) => line.invoiceId === invoice.id);
  const approvalRows = approvals.filter((approval) => approval.invoiceId === invoice.id);
  const lineRows = invoiceLines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.lineType)}</td>
          <td>${escapeHtml(line.description)}</td>
          <td>${line.quantity.toLocaleString("en-NG")}</td>
          <td>${line.unitPrice.toLocaleString("en-NG", { maximumFractionDigits: 2 })}</td>
          <td>${line.amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}</td>
        </tr>`,
    )
    .join("");
  const approvalList = approvalRows
    .map((approval) => `<li>${escapeHtml(approval.stageKey)} — ${escapeHtml(approval.actorRole)} — ${escapeHtml(approval.status)}</li>`)
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(invoice.invoiceNumber)}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #0f172a; }
      h1, h2 { margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
      .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
      .summary div { padding: 12px; border: 1px solid #cbd5e1; }
    </style>
  </head>
  <body>
    <h1>Billing Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
    <p>Billing period: ${escapeHtml(invoice.billingPeriodKey)} | Currency: ${escapeHtml(invoice.currency)}</p>
    <div class="summary">
      <div><strong>Subtotal</strong><br/>${invoice.subtotalAmount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}</div>
      <div><strong>Tax</strong><br/>${invoice.taxAmount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}</div>
      <div><strong>Total</strong><br/>${invoice.totalAmount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}</div>
    </div>
    <h2>Invoice lines</h2>
    <table>
      <thead>
        <tr><th>Type</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>
    <h2>Approval workflow</h2>
    <ul>${approvalList}</ul>
  </body>
</html>`;
}

export function buildInvoiceExportBundles(
  invoice: BillingInvoice,
  lines: BillingInvoiceLine[],
  approvals: BillingInvoiceApproval[],
): BillingInvoiceExportBundle[] {
  const invoiceLines = lines.filter((line) => line.invoiceId === invoice.id);
  const invoiceApprovals = approvals.filter((approval) => approval.invoiceId === invoice.id);
  const jsonBody = JSON.stringify({ invoice, lines: invoiceLines, approvals: invoiceApprovals }, null, 2);

  return [
    {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      format: "json",
      fileName: `${invoice.invoiceNumber}.json`,
      contentType: "application/json",
      body: jsonBody,
    },
    {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      format: "csv",
      fileName: `${invoice.invoiceNumber}.csv`,
      contentType: "text/csv",
      body: buildInvoiceCsv(invoice, lines),
    },
    {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      format: "html",
      fileName: `${invoice.invoiceNumber}.html`,
      contentType: "text/html",
      body: buildInvoiceHtml(invoice, lines, approvals),
    },
  ];
}

export function buildInvoiceApprovalsFromMatrix(args: {
  invoice: BillingInvoice;
  matrix?: BillingApprovalMatrix;
}): BillingInvoiceApproval[] {
  const stages = (args.matrix?.stages ?? defaultBillingApprovalMatrices[0]?.stages ?? []).filter((stage) => {
    if (typeof stage.minimumAmount === "number" && args.invoice.totalAmount < stage.minimumAmount) return false;
    if (typeof stage.maximumAmount === "number" && args.invoice.totalAmount > stage.maximumAmount) return false;
    return true;
  });

  return stages.map((stage, index) => ({
    id: `BAP-${args.invoice.id}-${index + 1}`,
    invoiceId: args.invoice.id,
    stageKey: stage.stageKey,
    actorRole: stage.actorRole,
    status: stage.autoApprove ? "approved" : "pending",
    actedAt: stage.autoApprove ? new Date().toISOString() : undefined,
    note: stage.autoApprove ? "Auto-approved by matrix rule." : undefined,
  }));
}

export function applyApprovalOutcome(
  invoice: BillingInvoice,
  approvals: BillingInvoiceApproval[],
): BillingInvoice {
  const invoiceApprovals = approvals.filter((approval) => approval.invoiceId === invoice.id);
  const hasRejected = invoiceApprovals.some((approval) => approval.status === "rejected");
  const allApproved = invoiceApprovals.length > 0 && invoiceApprovals.every((approval) => approval.status === "approved" || approval.status === "skipped");

  if (hasRejected) {
    return { ...invoice, approvalStatus: "rejected", status: "rejected" };
  }
  if (allApproved) {
    return { ...invoice, approvalStatus: "approved", status: "approved", issuedAt: new Date().toISOString() };
  }
  return { ...invoice, approvalStatus: "pending", status: "pending_approval" };
}

export function buildErpPostingPayload(args: {
  invoice: BillingInvoice;
  account?: BillingAccount;
  lines: BillingInvoiceLine[];
  revenueShareRules?: BillingRevenueShareRule[];
}) {
  const invoiceLines = args.lines.filter((line) => line.invoiceId === args.invoice.id);
  const revenueShares = (args.revenueShareRules ?? []).map((rule) => ({
    beneficiaryName: rule.beneficiaryName,
    percentage: rule.percentage,
    target: rule.target,
    settlementLedgerCode: rule.settlementLedgerCode,
  }));

  return {
    documentType: "Sales Invoice",
    invoiceNumber: args.invoice.invoiceNumber,
    customer: args.account?.accountName ?? args.invoice.tenantId,
    company: "54Bank Platform",
    currency: args.invoice.currency,
    postingDate: args.invoice.generatedAt.slice(0, 10),
    dueDate: args.invoice.dueAt.slice(0, 10),
    billingPeriodKey: args.invoice.billingPeriodKey,
    totalAmount: args.invoice.totalAmount,
    lines: invoiceLines.map((line) => ({
      itemCode: `${line.productKey ?? "platform"}-${line.meterKey ?? line.lineType}`,
      description: line.description,
      qty: line.quantity,
      rate: line.unitPrice,
      amount: line.amount,
    })),
    revenueShares,
  } satisfies Record<string, unknown>;
}

export function buildIngestionBridgeSummary(usageEvents: BillingUsageEvent[]): BillingIngestionBridgeSummary {
  const middleware = new Set<BillingIngestionBridgeSummary["middleware"][number]>();
  const services = new Map<string, { sourceService: string; eventCount: number; quantity: number }>();
  const meters = new Map<string, { meterKey: string; productKey: string; eventCount: number; quantity: number }>();
  let lastIngestedAt: string | undefined;

  for (const event of usageEvents) {
    const eventMiddleware = Array.isArray(event.payload?.middleware) ? event.payload.middleware : [];
    for (const item of eventMiddleware) {
      if (
        item === "Kafka" ||
        item === "Dapr" ||
        item === "Redis" ||
        item === "Fluvio" ||
        item === "TigerBeetle" ||
        item === "Lakehouse" ||
        item === "APISIX" ||
        item === "OpenAppSec"
      ) {
        middleware.add(item);
      }
    }
    const service = services.get(event.sourceService) ?? { sourceService: event.sourceService, eventCount: 0, quantity: 0 };
    service.eventCount += 1;
    service.quantity += event.quantity;
    services.set(event.sourceService, service);

    const meterKey = `${event.meterKey}:${event.productKey}`;
    const meter = meters.get(meterKey) ?? { meterKey: event.meterKey, productKey: event.productKey, eventCount: 0, quantity: 0 };
    meter.eventCount += 1;
    meter.quantity += event.quantity;
    meters.set(meterKey, meter);

    if (!lastIngestedAt || event.ingestedAt > lastIngestedAt) {
      lastIngestedAt = event.ingestedAt;
    }
  }

  return {
    middleware: Array.from(middleware),
    lastIngestedAt,
    serviceBreakdown: Array.from(services.values()).sort((a, b) => b.eventCount - a.eventCount),
    meterBreakdown: Array.from(meters.values()).sort((a, b) => b.quantity - a.quantity),
  };
}

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
