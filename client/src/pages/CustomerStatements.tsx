// Design philosophy: archive-first mobile transaction history.
// This page now behaves more like a production-ready history desk with searchable records,
// directional filters, and exportable statement evidence backed by the current runtime.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Clock3, Download, FileSpreadsheet, FileText, Mail, ReceiptText, Search, Wallet } from "lucide-react";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
import {
  formatCurrency,
  formatRelativeIso,
  getCustomerApprovalRequests,
  getCustomerStatementExports,
  getCustomerStatements,
  requestCustomerStatementExport,
  type CustomerApprovalRequest,
  type CustomerStatementRecord,
  type ExportJob,
} from "@/lib/platform";

function iconForType(type: string) {
  switch (type) {
    case "bill_payment":
      return ReceiptText;
    case "deposit":
      return Wallet;
    default:
      return ArrowUpRight;
  }
}

type StatementFilter = "all" | "credit" | "debit" | "transfer" | "bill_payment" | "workflow";
type StatementPeriod = "7d" | "30d" | "90d" | "365d";
type StatementFormat = "csv" | "xlsx";

export default function CustomerStatements() {
  const { activeCustomer, tenantConfiguration } = useCustomerSession();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatementFilter>("all");
  const [period, setPeriod] = useState<StatementPeriod>("30d");
  const [selectedFormat, setSelectedFormat] = useState<StatementFormat>("csv");
  const [message, setMessage] = useState<string | null>(null);
  const [statements, setStatements] = useState<CustomerStatementRecord[]>([]);
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [approvals, setApprovals] = useState<CustomerApprovalRequest[]>([]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        if (!activeCustomer?.id) return;
        const [statementResponse, exportResponse, approvalResponse] = await Promise.all([
          getCustomerStatements(activeCustomer.id),
          getCustomerStatementExports(activeCustomer.id),
          getCustomerApprovalRequests(activeCustomer.id),
        ]);
        if (!active) return;
        setStatements(statementResponse.items);
        setExports(exportResponse.items);
        setApprovals(approvalResponse.items.filter((item) => item.entityType === "statement_export"));
      } catch {
        if (!active) return;
        setMessage("Unable to refresh statement history right now.");
      }
    })();

    return () => {
      active = false;
    };
  }, [activeCustomer?.id]);

  const enabledFeatureKeys = new Set([
    ...(tenantConfiguration?.enabledModules ?? []),
    ...((tenantConfiguration?.featureFlags ?? []).filter((flag) => flag.enabled).map((flag) => flag.key)),
  ]);
  const statementsEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("statements");

  const visibleStatements = useMemo(() => {
    const now = Date.now();
    const periodWindow =
      period === "7d"
        ? 7
        : period === "30d"
          ? 30
          : period === "90d"
            ? 90
            : 365;

    const byPeriod = statements.filter((row) => {
      const ageDays = (now - new Date(row.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays <= periodWindow;
    });

    const byFilter =
      filter === "all"
        ? byPeriod
        : filter === "credit" || filter === "debit"
          ? byPeriod.filter((row) => row.direction === filter)
          : byPeriod.filter((row) => row.type === filter);

    const normalized = query.trim().toLowerCase();
    return normalized
      ? byFilter.filter((row) => [row.title, row.detail, row.reference, row.category].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized)))
      : byFilter;
  }, [filter, period, query, statements]);

  const totalOutflow = useMemo(
    () => statements.filter((row) => row.direction === "debit").reduce((sum, row) => sum + row.amount, 0),
    [statements],
  );
  const totalInflow = useMemo(
    () => statements.filter((row) => row.direction === "credit").reduce((sum, row) => sum + row.amount, 0),
    [statements],
  );
  const currentBalance = useMemo(() => Math.max(0, totalInflow - totalOutflow + (activeCustomer?.balance ?? 0)), [activeCustomer?.balance, totalInflow, totalOutflow]);
  const exportTimeline = useMemo(
    () => exports
      .map((job) => ({
        ...job,
        linkedApproval: approvals.find((approval) => approval.entityId === job.id),
      }))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [approvals, exports],
  );
  const pendingExportApprovals = useMemo(
    () => approvals.filter((approval) => approval.state === "pending"),
    [approvals],
  );
  const resolvedExportApprovals = useMemo(
    () => approvals.filter((approval) => approval.state !== "pending"),
    [approvals],
  );

  async function requestExport(format: StatementFormat) {
    if (!statementsEnabled) {
      setMessage("Statement exports are disabled for this tenant configuration.");
      return;
    }

    if (!activeCustomer?.id) {
      setMessage("Select a customer profile before requesting a statement export.");
      return;
    }

    try {
      const title = `Customer statement export ${activeCustomer.id} · ${filter} · ${period}`;
      await requestCustomerStatementExport({
        customerId: activeCustomer.id,
        format,
        rowCount: visibleStatements.length || statements.length || 12,
        title,
      });

      const [exportResponse, approvalResponse] = await Promise.all([
        getCustomerStatementExports(activeCustomer.id),
        getCustomerApprovalRequests(activeCustomer.id),
      ]);
      setExports(exportResponse.items);
      setApprovals(approvalResponse.items.filter((item) => item.entityType === "statement_export"));
      setMessage(`Queued a ${format.toUpperCase()} statement export for ${visibleStatements.length || statements.length} statement rows.`);
    } catch {
      setMessage("Unable to request a persisted statement export right now.");
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-28 text-stone-900 lg:pb-10">
      <header className="px-5 pb-8 pt-6 text-white" style={{ background: `linear-gradient(135deg, ${tenantConfiguration?.whiteLabel?.primaryColor ?? "#0369a1"} 0%, ${tenantConfiguration?.whiteLabel?.accentColor ?? "#1e3a8a"} 100%)` }}>
        <div className="flex items-center gap-3">
          <Link href="/customer/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">{tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"}</p>
            <h1 className="text-xl font-semibold">Statements</h1>
            <p className="mt-1 text-xs text-white/80">Review account history, filter records, and request exports from one mobile-first screen.</p>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 py-5">
        {!statementsEnabled ? (
          <section className="rounded-[1.4rem] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            Statement exports are currently disabled for this tenant profile. Read-only history remains visible for continuity while onboarding governance is completed.
          </section>
        ) : null}
        <section className="-mt-8 rounded-[1.7rem] bg-gradient-to-br from-sky-700 via-sky-600 to-indigo-800 p-6 text-white shadow-[0_18px_36px_rgba(15,23,42,0.18)]">
          <p className="text-sm text-white/75">Available balance</p>
          <p className="mt-2 text-3xl font-bold">{formatCurrency(currentBalance)}</p>
          <p className="mt-4 text-sm text-white/70">Account holder: {activeCustomer?.name ?? "54Bank customer"}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <article className="rounded-[1.2rem] bg-white/12 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Total outflow</p>
              <p className="mt-2 text-lg font-semibold">{formatCurrency(totalOutflow)}</p>
            </article>
            <article className="rounded-[1.2rem] bg-white/12 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Total inflow</p>
              <p className="mt-2 text-lg font-semibold">{formatCurrency(totalInflow)}</p>
            </article>
          </div>
        </section>

        <section className="rounded-[1.7rem] bg-white p-5 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <FileText size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Generate statement</h2>
              <p className="mt-1 text-sm text-stone-500">Choose a recent period, keep the history searchable, and request a statement in the format closest to the recovered mobile flow.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">Statement period</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {([
                  ["7d", "Last 7 days"],
                  ["30d", "Last 30 days"],
                  ["90d", "Last 3 months"],
                  ["365d", "Last 12 months"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPeriod(value)}
                    className={`rounded-2xl px-3 py-3 font-semibold ${period === value ? "bg-sky-700 text-white" : "bg-stone-100 text-stone-600"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">File format</span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {([
                  ["csv", "CSV"],
                  ["xlsx", "Excel"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedFormat(value)}
                    className={`rounded-2xl px-3 py-3 font-semibold ${selectedFormat === value ? "bg-sky-700 text-white" : "bg-stone-100 text-stone-600"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-[1.2rem] bg-stone-50 px-4 py-3">
            <Search className="text-stone-400" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
              placeholder="Search by title, detail, reference, or category"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => requestExport(selectedFormat)} disabled={!statementsEnabled} className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] bg-sky-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              <Download size={16} />
              Generate {selectedFormat.toUpperCase()}
            </button>
            <button type="button" onClick={() => setMessage(`Statement will be shared through the active customer contact record once ${selectedFormat.toUpperCase()} export delivery is enabled.`)} className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-700">
              <Mail size={16} />
              Email statement
            </button>
            <button type="button" onClick={() => setMessage("Monthly statement scheduling remains a compatible live enhancement and will reuse the active export lifecycle when enabled.")} className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-700">
              <Clock3 size={16} />
              Schedule monthly
            </button>
            <button type="button" onClick={() => setFilter("all")} className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-700">
              <FileSpreadsheet size={16} />
              View all history
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
            {(["all", "credit", "debit", "transfer", "bill_payment", "workflow"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-2 font-semibold ${filter === item ? "bg-sky-700 text-white" : "bg-stone-100 text-stone-600"}`}
              >
                {item.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-[1.2rem] bg-sky-50 p-3 text-xs text-sky-900">
            Enabled modules: {(tenantConfiguration?.enabledModules ?? []).join(", ") || "default runtime set"}
          </div>
          {message ? <div className="mt-4 rounded-[1.2rem] bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
        </section>

        <section className="rounded-[1.7rem] bg-white p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Recent statements</h2>
              <p className="mt-1 text-sm text-stone-500">Persisted export jobs remain visible here as a compatible runtime enhancement to the simpler archive-style statement history.</p>
            </div>
            <span className="rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">{exportTimeline.length} visible jobs</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <article className="rounded-[1.2rem] bg-amber-50 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-700">Pending approvals</p>
              <p className="mt-2 text-2xl font-bold text-amber-950">{pendingExportApprovals.length}</p>
              <p className="mt-2 text-sm text-amber-800">Exports that still require branch sign-off before customer download.</p>
            </article>
            <article className="rounded-[1.2rem] bg-emerald-50 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">Resolved approvals</p>
              <p className="mt-2 text-2xl font-bold text-emerald-950">{resolvedExportApprovals.length}</p>
              <p className="mt-2 text-sm text-emerald-800">Exports with a visible approval outcome already recorded in the lifecycle.</p>
            </article>
          </div>

          <div className="mt-4 space-y-3">
            {exportTimeline.length ? (
              exportTimeline.slice(0, 4).map((job) => (
                <article key={job.id} className="rounded-[1.3rem] border border-stone-100 bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{job.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-400">{job.format.toUpperCase()} · {job.rowCount} rows · requested {formatRelativeIso(job.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${job.approvalState === "Signed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {job.approvalState}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1rem] bg-white px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Prepared</p>
                      <p className="mt-2 text-sm font-semibold text-stone-900">{formatRelativeIso(job.createdAt)}</p>
                    </div>
                    <div className="rounded-[1rem] bg-white px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Approval outcome</p>
                      <p className="mt-2 text-sm font-semibold text-stone-900">{job.linkedApproval?.state ?? job.approvalState.toLowerCase()}</p>
                    </div>
                    <div className="rounded-[1rem] bg-white px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Download status</p>
                      <p className="mt-2 text-sm font-semibold text-stone-900">{job.status}</p>
                    </div>
                  </div>
                  {job.linkedApproval ? (
                    <p className="mt-3 text-sm leading-6 text-stone-500">
                      {job.linkedApproval.detail}
                      {job.linkedApproval.resolutionNote ? ` Resolution: ${job.linkedApproval.resolutionNote}` : ""}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-[1.3rem] bg-stone-50 p-4 text-sm text-stone-500">No statement export jobs are visible yet for this customer.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.7rem] bg-white p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Recent activity</h2>
              <p className="mt-1 text-sm text-stone-500">Showing {visibleStatements.length} records for the current search and filter state.</p>
            </div>
            <Link href={statementsEnabled ? "/customer/transfers" : "/customer/statements"} className={`rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 ${!statementsEnabled ? "pointer-events-none opacity-60" : ""}`}>
              Transfer
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {visibleStatements.length ? (
              visibleStatements.map((row) => {
                const Icon = iconForType(row.type);
                const isCredit = row.direction === "credit";
                return (
                  <article key={row.id} className="rounded-[1.3rem] border border-stone-100 bg-stone-50 p-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${isCredit ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                        {isCredit ? <ArrowDownLeft size={18} /> : <Icon size={18} className={row.type === "transfer" ? "rotate-180" : ""} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-900">{row.title}</p>
                        <p className="truncate text-xs text-stone-500">{row.detail}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-stone-400">{row.reference ?? row.type}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isCredit ? "text-emerald-700" : "text-stone-900"}`}>
                          {isCredit ? "+" : "-"}
                          {formatCurrency(row.amount).replace("₦", "")}
                        </p>
                        <p className="text-xs text-stone-500">{formatRelativeIso(row.timestamp)}</p>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.3rem] bg-stone-50 p-4 text-sm text-stone-500">No statement records match the current search and filter.</div>
            )}
          </div>
        </section>
      </main>

      <CustomerBottomNav />
    </div>
  );
}
