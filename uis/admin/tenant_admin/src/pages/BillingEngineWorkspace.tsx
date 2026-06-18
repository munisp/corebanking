import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Cable,
  FileDown,
  FileSpreadsheet,
  GitBranch,
  Landmark,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import AdminWorkspaceLayout from "@/components/AdminWorkspaceLayout";
import {
  createBillingApprovalMatrix,
  createBillingContractOverride,
  createBillingDispute,
  createBillingDiscountRule,
  createBillingRevenueShareRule,
  formatCurrency,
  formatRelativeIso,
  generateBillingInvoicesAdvanced,
  getBillingExtendedDashboard,
  getBillingInvoiceExportUrl,
  ingestBillingUsageEvent,
  queueBillingInvoiceErpPost,
  resolveBillingDispute,
  resolveBillingInvoiceApproval,
  type BillingApprovalMatrixRecord,
  type BillingExtendedDashboardResponse,
} from "@/lib/platform";

type ActingRole = "operations" | "treasury" | "compliance" | "branch";

type MeterPreset = {
  label: string;
  meterKey: string;
  productKey: string;
  sourceService: string;
  sourceEventType: string;
  quantity: number;
  bridge: "kafka" | "dapr" | "fluvio" | "tigerbeetle";
};

const meterPresets: MeterPreset[] = [
  {
    label: "Kafka payment transfer burst",
    meterKey: "transfer_posted",
    productKey: "payments",
    sourceService: "payment-service",
    sourceEventType: "transfer.posted",
    quantity: 2400,
    bridge: "kafka",
  },
  {
    label: "Dapr customer growth sync",
    meterKey: "active_customer",
    productKey: "customer",
    sourceService: "customer-service",
    sourceEventType: "customer.activated",
    quantity: 4000,
    bridge: "dapr",
  },
  {
    label: "TigerBeetle settlement finalization",
    meterKey: "transfer_posted",
    productKey: "payments",
    sourceService: "ledger-service",
    sourceEventType: "settlement.finalized",
    quantity: 1800,
    bridge: "tigerbeetle",
  },
  {
    label: "Fluvio lakehouse operational rollup",
    meterKey: "named_user",
    productKey: "operations",
    sourceService: "analytics-rollup",
    sourceEventType: "seat.rollup",
    quantity: 24,
    bridge: "fluvio",
  },
];

const roleOptions: ActingRole[] = ["operations", "treasury", "compliance", "branch"];

export default function BillingEngineWorkspace() {
  const [dashboard, setDashboard] = useState<BillingExtendedDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actingRole, setActingRole] = useState<ActingRole>("operations");
  const [invoicePeriodType, setInvoicePeriodType] = useState<"monthly" | "quarterly" | "semi_annual" | "annual" | "custom">("monthly");
  const [selectedPreset, setSelectedPreset] = useState<MeterPreset>(meterPresets[0]);
  const [matrixForm, setMatrixForm] = useState({
    name: "Treasury-first exception matrix",
    treasuryMinimum: 500000,
    complianceMinimum: 1500000,
  });
  const [disputeForm, setDisputeForm] = useState({
    title: "Usage variance requires review",
    detail: "Check transfer meter volume against treasury settlement totals before issuing the invoice.",
    severity: "medium" as "low" | "medium" | "high",
    assignedRole: "operations" as ActingRole,
  });

  async function refresh() {
    setLoading(true);
    try {
      const next = await getBillingExtendedDashboard();
      setDashboard(next);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load the billing control tower.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const primaryAccount = dashboard?.accounts[0] ?? null;
  const selectedInvoice = dashboard?.invoices[0] ?? null;
  const selectedApprovals = useMemo(
    () => dashboard?.invoiceApprovals.filter((item) => item.invoiceId === selectedInvoice?.id) ?? [],
    [dashboard?.invoiceApprovals, selectedInvoice?.id],
  );
  const selectedInvoiceLines = useMemo(
    () => dashboard?.invoiceLines.filter((item) => item.invoiceId === selectedInvoice?.id) ?? [],
    [dashboard?.invoiceLines, selectedInvoice?.id],
  );
  const activeMatrix = dashboard?.approvalMatrices.find((item) => item.status === "active") ?? null;

  async function handleAdvancedInvoiceRun() {
    if (!primaryAccount) return;
    setBusy("invoice-run");
    try {
      const generated = await generateBillingInvoicesAdvanced({
        billingAccountId: primaryAccount.id,
        periodType: invoicePeriodType,
      });
      setMessage(`Generated ${generated.total} invoice set(s) with tenant approval matrices for ${invoicePeriodType} billing.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate the advanced invoice run.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateMatrix() {
    if (!primaryAccount) return;
    setBusy("matrix");
    try {
      await createBillingApprovalMatrix({
        tenantId: primaryAccount.tenantId,
        billingAccountId: primaryAccount.id,
        name: matrixForm.name,
        status: "active",
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
            minimumAmount: Number(matrixForm.treasuryMinimum),
          },
          {
            stageKey: "compliance_release",
            actorRole: "compliance",
            label: "Compliance release",
            minimumAmount: Number(matrixForm.complianceMinimum),
          },
        ],
      });
      setMessage(`Saved ${matrixForm.name} as the latest approval matrix.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save approval matrix.");
    } finally {
      setBusy(null);
    }
  }

  async function handleApproval(approvalId: string, decision: "approve" | "reject") {
    if (!selectedInvoice) return;
    setBusy(`approval-${approvalId}`);
    try {
      await resolveBillingInvoiceApproval(
        selectedInvoice.id,
        approvalId,
        {
          decision,
          note:
            decision === "approve"
              ? `Approved in the billing control tower by ${actingRole}.`
              : `Rejected by ${actingRole} pending remediation.`,
        },
        actingRole,
      );
      setMessage(`Invoice ${selectedInvoice.invoiceNumber} ${decision === "approve" ? "advanced" : "returned"} in the approval lane.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to resolve billing approval.");
    } finally {
      setBusy(null);
    }
  }

  async function handleIngestUsage() {
    if (!primaryAccount) return;
    setBusy("ingest");
    try {
      await ingestBillingUsageEvent({
        tenantId: primaryAccount.tenantId,
        billingAccountId: primaryAccount.id,
        sourceService: selectedPreset.sourceService,
        sourceEventType: selectedPreset.sourceEventType,
        meterKey: selectedPreset.meterKey,
        productKey: selectedPreset.productKey,
        quantity: selectedPreset.quantity,
        bridge: selectedPreset.bridge,
        payload: {
          trigger: "billing-control-tower",
          posture: "live-demo",
        },
      });
      setMessage(`Ingested ${selectedPreset.label} through the ${selectedPreset.bridge.toUpperCase()} bridge.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to ingest usage event.");
    } finally {
      setBusy(null);
    }
  }

  async function handleQueueErpPost() {
    if (!selectedInvoice) return;
    setBusy("erp-post");
    try {
      const posted = await queueBillingInvoiceErpPost(selectedInvoice.id, { erpSystem: "erpnext" });
      setMessage(`Queued ${posted.invoiceNumber} for ${posted.erpSystem} posting.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue ERP posting.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRaiseDispute() {
    if (!selectedInvoice) return;
    setBusy("dispute");
    try {
      await createBillingDispute({
        invoiceId: selectedInvoice.id,
        tenantId: selectedInvoice.tenantId,
        title: disputeForm.title,
        detail: disputeForm.detail,
        severity: disputeForm.severity,
        assignedRole: disputeForm.assignedRole,
      });
      setMessage(`Opened dispute for invoice ${selectedInvoice.invoiceNumber}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to raise dispute.");
    } finally {
      setBusy(null);
    }
  }

  async function handleResolveDispute(disputeId: string) {
    setBusy(`resolve-${disputeId}`);
    try {
      await resolveBillingDispute(disputeId, {
        status: "resolved",
        resolutionNote: `Resolved by ${actingRole} from the billing control tower.`,
      });
      setMessage("Resolved the selected billing dispute.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to resolve billing dispute.");
    } finally {
      setBusy(null);
    }
  }

  async function seedCommercialControls() {
    if (!primaryAccount) return;
    setBusy("commercial-controls");
    try {
      await Promise.all([
        createBillingContractOverride({
          billingAccountId: primaryAccount.id,
          overrideType: "minimum_commit",
          valueNumber: 9000000,
          status: "active",
          notes: "Enterprise minimum commitment",
        }),
        createBillingDiscountRule({
          billingAccountId: primaryAccount.id,
          name: "Scale discount",
          discountType: "percentage",
          percentage: 3,
          status: "active",
        }),
        createBillingRevenueShareRule({
          billingAccountId: primaryAccount.id,
          name: "Partner share",
          target: "partner_bank",
          percentage: 12.5,
          beneficiaryName: "Partner commercial desk",
          settlementLedgerCode: "REV-SHARE-PARTNER",
          status: "active",
        }),
      ]);
      setMessage("Refreshed contract overrides, discounts, and revenue-share controls.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to seed commercial controls.");
    } finally {
      setBusy(null);
    }
  }

  const summaryCards = dashboard
    ? [
        {
          title: "Accrued exposure",
          value: formatCurrency(dashboard.summary.totalAccruedAmount, dashboard.summary.currency),
          detail: `${dashboard.summary.usageEventCount} usage events in current view`,
          icon: ReceiptText,
        },
        {
          title: "Pending approvals",
          value: String(dashboard.summary.pendingApprovalInvoiceCount),
          detail: `${dashboard.controls.matrixCount} active matrix definition(s)`,
          icon: ShieldCheck,
        },
        {
          title: "Open disputes",
          value: String(dashboard.controls.disputeCount),
          detail: `${dashboard.controls.queuedErpPostings} ERP posting(s) queued`,
          icon: AlertTriangle,
        },
        {
          title: "Live ingestion",
          value: String(dashboard.liveIngestion.serviceBreakdown.length),
          detail: `${dashboard.liveIngestion.middleware.join(", ") || "No middleware trace yet"}`,
          icon: Cable,
        },
      ]
    : [];

  return (
    <AdminWorkspaceLayout
      eyebrow="Next-generation billing engine"
      title="Billing Engine Control Tower"
      description="Run matrix-aware invoice automation, route invoices into ERP posting, govern disputes, and watch middleware-backed usage streams accumulate into billable exposure."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center rounded-full bg-white/10 px-3 py-2 text-sm text-white">
            Acting as
            <select
              value={actingRole}
              onChange={(event) => setActingRole(event.target.value as ActingRole)}
              className="ml-2 rounded-full border border-white/20 bg-transparent px-3 py-1 text-white outline-none"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role} className="text-stone-900">
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-950"
          >
            <RefreshCcw size={16} /> Refresh
          </button>
        </div>
      }
    >
      <div className="space-y-6 p-6 lg:p-8">
        {message ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">{message}</div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article key={card.title} className="rounded-[1.8rem] bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-500">{card.title}</span>
                <card.icon className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="mt-5 text-3xl font-semibold text-stone-950">{loading ? "…" : card.value}</div>
              <p className="mt-2 text-sm text-stone-500">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <article className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Live billing series</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-950">Accrual versus invoice momentum</h2>
              </div>
              <Waves className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="mt-6 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard?.summary.liveSeries ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="periodKey" stroke="#78716c" />
                  <YAxis stroke="#78716c" />
                  <Tooltip />
                  <Area type="monotone" dataKey="accruedAmount" stackId="1" stroke="#0f766e" fill="#99f6e4" name="Accrued" />
                  <Area type="monotone" dataKey="invoiceAmount" stackId="2" stroke="#1d4ed8" fill="#bfdbfe" name="Invoice" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Middleware posture</p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">Bridge visibility</h2>
              </div>
              <GitBranch className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(dashboard?.liveIngestion.middleware ?? []).map((item) => (
                <span key={item} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-stone-500">
              Last ingestion update {dashboard?.liveIngestion.lastIngestedAt ? formatRelativeIso(dashboard.liveIngestion.lastIngestedAt) : "not available yet"}.
            </p>
            <div className="mt-5 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard?.liveIngestion.meterBreakdown ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="meterKey" stroke="#78716c" />
                  <YAxis stroke="#78716c" />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#14b8a6" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr]">
          <article className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Automated invoice run</p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">Generate matrix-aware invoices</h2>
              </div>
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-stone-600">
                Billing period
                <select
                  value={invoicePeriodType}
                  onChange={(event) => setInvoicePeriodType(event.target.value as typeof invoicePeriodType)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi_annual">Semi-annual</option>
                  <option value="annual">Annual</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <div className="rounded-2xl border border-stone-200 p-4 text-sm text-stone-600">
                <p className="font-semibold text-stone-900">Active matrix</p>
                <p className="mt-1">{activeMatrix?.name ?? "Default approval path"}</p>
                <p className="mt-2 text-xs text-stone-500">{activeMatrix?.stages.length ?? 0} stage(s) currently shape the invoice approval lane.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleAdvancedInvoiceRun()}
                disabled={busy === "invoice-run" || !primaryAccount}
                className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "invoice-run" ? "Running…" : "Generate advanced invoice run"}
              </button>
              <button
                type="button"
                onClick={() => void seedCommercialControls()}
                disabled={busy === "commercial-controls" || !primaryAccount}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                Refresh contract controls
              </button>
            </div>
          </article>

          <article className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Approval matrix</p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">Tenant sign-off rules</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <input
                value={matrixForm.name}
                onChange={(event) => setMatrixForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                placeholder="Matrix name"
              />
              <input
                type="number"
                value={matrixForm.treasuryMinimum}
                onChange={(event) => setMatrixForm((current) => ({ ...current, treasuryMinimum: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                placeholder="Treasury threshold"
              />
              <input
                type="number"
                value={matrixForm.complianceMinimum}
                onChange={(event) => setMatrixForm((current) => ({ ...current, complianceMinimum: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                placeholder="Compliance threshold"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleCreateMatrix()}
              disabled={busy === "matrix" || !primaryAccount}
              className="mt-4 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "matrix" ? "Saving…" : "Save approval matrix"}
            </button>
          </article>

          <article className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Usage ingestion</p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">Push live meter events</h2>
              </div>
              <Cable className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="mt-5 space-y-3">
              <select
                value={selectedPreset.label}
                onChange={(event) => {
                  const next = meterPresets.find((item) => item.label === event.target.value);
                  if (next) setSelectedPreset(next);
                }}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm"
              >
                {meterPresets.map((preset) => (
                  <option key={preset.label} value={preset.label}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-stone-500">
                Route {selectedPreset.meterKey} through {selectedPreset.bridge.toUpperCase()} from {selectedPreset.sourceService}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleIngestUsage()}
              disabled={busy === "ingest" || !primaryAccount}
              className="mt-4 rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "ingest" ? "Ingesting…" : "Ingest usage event"}
            </button>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Invoice workspace</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-950">{selectedInvoice?.invoiceNumber ?? "No invoice selected"}</h2>
              </div>
              <ReceiptText className="h-6 w-6 text-emerald-600" />
            </div>
            {selectedInvoice ? (
              <>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-stone-200 p-4 text-sm">
                    <p className="text-stone-500">Total</p>
                    <p className="mt-2 text-xl font-semibold text-stone-950">{formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 p-4 text-sm">
                    <p className="text-stone-500">Status</p>
                    <p className="mt-2 text-xl font-semibold text-stone-950">{selectedInvoice.status}</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 p-4 text-sm">
                    <p className="text-stone-500">Due</p>
                    <p className="mt-2 text-xl font-semibold text-stone-950">{formatRelativeIso(selectedInvoice.dueAt)}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={getBillingInvoiceExportUrl(selectedInvoice.id, "json")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
                  >
                    <FileDown size={16} /> Export JSON
                  </a>
                  <a
                    href={getBillingInvoiceExportUrl(selectedInvoice.id, "csv")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
                  >
                    <FileDown size={16} /> Export CSV
                  </a>
                  <a
                    href={getBillingInvoiceExportUrl(selectedInvoice.id, "html")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
                  >
                    <FileDown size={16} /> Printable view
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleQueueErpPost()}
                    disabled={busy === "erp-post"}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <Landmark size={16} /> {busy === "erp-post" ? "Queueing…" : "Queue ERPNext post"}
                  </button>
                </div>
                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-3xl border border-stone-200 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Invoice lines</p>
                    <div className="mt-4 space-y-3">
                      {selectedInvoiceLines.map((line) => (
                        <div key={line.id} className="flex items-start justify-between gap-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm">
                          <div>
                            <p className="font-semibold text-stone-900">{line.description}</p>
                            <p className="text-stone-500">{line.lineType} · qty {line.quantity.toLocaleString("en-NG")}</p>
                          </div>
                          <span className="font-semibold text-stone-900">{formatCurrency(line.amount, selectedInvoice.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-stone-200 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Approval lane</p>
                    <div className="mt-4 space-y-3">
                      {selectedApprovals.map((approval) => (
                        <div key={approval.id} className="rounded-2xl bg-stone-50 px-4 py-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-stone-900">{approval.stageKey}</p>
                              <p className="text-stone-500">{approval.actorRole} · {approval.status}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleApproval(approval.id, "approve")}
                                disabled={busy === `approval-${approval.id}` || approval.status === "approved"}
                                className="rounded-full bg-emerald-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleApproval(approval.id, "reject")}
                                disabled={busy === `approval-${approval.id}` || approval.status === "rejected"}
                                className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-stone-500">Generate an advanced invoice run to activate invoice exports, ERP posting hooks, and approval workflows.</p>
            )}
          </article>

          <article className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Invoice disputes</p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">Govern billing exceptions</h2>
              </div>
              <ArrowRightLeft className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <input
                value={disputeForm.title}
                onChange={(event) => setDisputeForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                placeholder="Dispute title"
              />
              <textarea
                value={disputeForm.detail}
                onChange={(event) => setDisputeForm((current) => ({ ...current, detail: event.target.value }))}
                className="h-24 w-full rounded-2xl border border-stone-200 px-4 py-3"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={disputeForm.severity}
                  onChange={(event) => setDisputeForm((current) => ({ ...current, severity: event.target.value as typeof current.severity }))}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <select
                  value={disputeForm.assignedRole}
                  onChange={(event) => setDisputeForm((current) => ({ ...current, assignedRole: event.target.value as ActingRole }))}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleRaiseDispute()}
              disabled={busy === "dispute" || !selectedInvoice}
              className="mt-4 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "dispute" ? "Opening…" : "Open dispute"}
            </button>
            <div className="mt-5 space-y-3">
              {(dashboard?.disputes ?? []).map((dispute) => (
                <div key={dispute.id} className="rounded-2xl border border-stone-200 p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-900">{dispute.title}</p>
                      <p className="mt-1 text-stone-500">{dispute.status} · {dispute.reasonCode.replaceAll("_", " ")}</p>
                      <p className="mt-2 text-stone-600">{dispute.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleResolveDispute(dispute.id)}
                      disabled={busy === `resolve-${dispute.id}` || dispute.status === "resolved"}
                      className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">ERP posting queue</p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">Accounting hook readiness</h2>
              </div>
              <Landmark className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="mt-5 space-y-3">
              {(dashboard?.erpPostings ?? []).map((item) => (
                <div key={item.id} className="rounded-2xl bg-stone-50 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-900">{item.invoiceNumber}</p>
                      <p className="text-stone-500">{item.erpSystem} · {item.status} · {formatRelativeIso(item.queuedAt)}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700">{item.reference}</span>
                  </div>
                </div>
              ))}
              {dashboard?.erpPostings.length === 0 ? <p className="text-sm text-stone-500">No ERP posting attempts yet.</p> : null}
            </div>
          </article>

          <article className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Threshold alerts</p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">Meters requiring review</h2>
              </div>
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div className="mt-5 space-y-3">
              {(dashboard?.summary.thresholdAlerts ?? []).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-semibold">{alert.title}</p>
                  <p className="mt-1">{alert.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </AdminWorkspaceLayout>
  );
}
