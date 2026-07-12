import { useEffect, useState } from "react";
import apiClient from "../services/api";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import PageHeader from "../components/PageHeader";
import {
  Activity,
  BookOpen,
  Filter,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface LedgerEntry {
  id: number;
  transaction_ref: string;
  transaction_type?: string;
  billing_model: string;
  gross_fee: string | number;
  platform_revenue?: string | number;
  platform_net_fee?: string | number;
  agent_commission: string | number;
  switch_fee: string | number;
  created_at: string;
}

interface LedgerResponse {
  entries?: LedgerEntry[];
  data?: LedgerEntry[];
  total?: number;
}

interface MetricsResponse {
  today?: Record<string, number>;
  thisMonth?: Record<string, number>;
}

function fmtNGN(n: number | string): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function padTwo(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

const BILLING_MODELS = ["", "revenue_share", "subscription", "hybrid"];

export default function BillingLedger() {
  const { primaryColor } = useTenantBranding();
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(
    `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-01`,
  );
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [billingModel, setBillingModel] = useState("");
  const [page, setPage] = useState(1);

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        page: String(page),
        page_size: "50",
        ...(billingModel ? { billing_model: billingModel } : {}),
      });

      const [ledgerRes, metricsRes] = await Promise.allSettled([
        apiClient.get<LedgerResponse>(
          `/tenant-management/billing/ledger?${params}`,
        ),
        apiClient.get<MetricsResponse>(
          `/tenant-management/billing/ledger/metrics`,
        ),
      ]);

      if (ledgerRes.status === "fulfilled") {
        const d = ledgerRes.value.data;
        const rows = Array.isArray(d)
          ? d
          : (d as any)?.entries ?? (d as any)?.data ?? [];
        setEntries(rows);
        setTotal((d as any)?.total ?? rows.length);
      } else {
        toast.error("Failed to load ledger entries");
      }

      if (metricsRes.status === "fulfilled") {
        setMetrics(metricsRes.value.data as MetricsResponse);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const applyFilters = () => {
    setPage(1);
    fetchData();
  };

  const today = metrics?.today ?? {};
  const month = metrics?.thisMonth ?? {};

  const totalGross = entries.reduce(
    (s, e) => s + Number(e.gross_fee || 0),
    0,
  );
  const totalPlatform = entries.reduce(
    (s, e) => s + Number(e.platform_revenue ?? e.platform_net_fee ?? 0),
    0,
  );
  const totalAgent = entries.reduce(
    (s, e) => s + Number(e.agent_commission || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Billing"
          title="Transaction Ledger"
          description="Fee splits and revenue records per transaction"
          icon={<BookOpen className="w-8 h-8" />}
        />
      </div>

      <div className="container space-y-6 pb-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Today Gross Fees", value: fmtNGN((today as any).grossFees ?? (today as any).gross_fees ?? 0) },
            { label: "Today Transactions", value: String((today as any).transactionCount ?? (today as any).transaction_count ?? 0) },
            { label: "MTD Gross Fees", value: fmtNGN((month as any).grossFees ?? (month as any).gross_fees ?? 0) },
            { label: "MTD Platform Revenue", value: fmtNGN((month as any).platformShare ?? (month as any).platform_share ?? 0) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-card rounded-xl shadow-lg p-5 border border-border"
            >
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl shadow-lg border border-border p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Billing Model
              </label>
              <select
                value={billingModel}
                onChange={(e) => setBillingModel(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {BILLING_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m ? m.replace(/_/g, " ") : "All Models"}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={applyFilters}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: primaryColor }}
            >
              <Filter className="w-4 h-4" />
              {loading ? "Loading..." : "Apply"}
            </button>
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Gross Fees (page)", value: fmtNGN(totalGross), color: "text-foreground" },
            { label: "Platform Revenue (page)", value: fmtNGN(totalPlatform), color: "text-green-600" },
            { label: "Agent Commissions (page)", value: fmtNGN(totalAgent), color: "text-blue-600" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-card rounded-xl shadow-lg border border-border p-5"
            >
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              {label.includes("Gross") && (
                <p className="text-xs text-muted-foreground mt-1">
                  {entries.length} entries shown
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              Ledger Entries
            </h3>
            <span className="text-sm text-muted-foreground">
              Total: {total}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading entries...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No entries found for the selected period
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {[
                      "Tx Ref",
                      "Type",
                      "Model",
                      "Gross Fee",
                      "Platform Rev",
                      "Agent Comm",
                      "Switch Fee",
                      "Date",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-6 py-4 text-sm font-semibold text-foreground ${
                          ["Gross Fee", "Platform Rev", "Agent Comm", "Switch Fee"].includes(h)
                            ? "text-right"
                            : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((e, i) => (
                    <tr
                      key={e.id ?? i}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-primary">
                        {e.transaction_ref}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {e.transaction_type ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {e.billing_model?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-right">
                        {fmtNGN(e.gross_fee)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-green-600">
                        {fmtNGN(e.platform_revenue ?? e.platform_net_fee ?? 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-blue-600">
                        {fmtNGN(e.agent_commission)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-muted-foreground">
                        {fmtNGN(e.switch_fee)}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {e.created_at
                          ? new Date(e.created_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-4 py-2 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={entries.length < 50 || loading}
              className="px-4 py-2 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
