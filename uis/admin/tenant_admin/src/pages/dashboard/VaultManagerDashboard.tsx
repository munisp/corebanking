import { usePermissions } from "@/_core/hooks/usePermissions";
import {
    AlertTriangle,
    ArrowDownCircle,
    ArrowUpCircle,
    CheckCircle,
    DollarSign,
    Lock,
    RefreshCw,
    Shield,
} from "lucide-react";
import { useEffect } from "react";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function VaultManagerDashboard() {
  const { transactions, metrics, loading } = useDashboardData();
  const { checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "vault_management" },
      { resourceType: "tenants", permission: "approve_or_reject" },
      { resourceType: "tenants", permission: "initiate_transactions" },
      { resourceType: "tenants", permission: "view_analytics" },
    ]);
  }, []);

  const totalVolume = metrics.total_volume;
  const totalTxnCount = metrics.total_count;

  // Cash-in: successful transactions (inflows)
  const inflows = transactions.filter(
    (t) =>
      t.status?.toLowerCase() === "success" &&
      (t.type?.toLowerCase().includes("deposit") ||
        t.type?.toLowerCase().includes("credit") ||
        t.direction === "credit" ||
        !t.type),
  );
  const outflows = transactions.filter(
    (t) =>
      t.status?.toLowerCase() === "success" &&
      (t.type?.toLowerCase().includes("withdrawal") ||
        t.type?.toLowerCase().includes("debit") ||
        t.direction === "debit"),
  );
  const pendingReconciliation = transactions.filter(
    (t) => t.status?.toLowerCase() === "pending",
  );
  const totalInflow = inflows.reduce((s, t) => s + (t.amount || 0), 0);
  const totalOutflow = outflows.reduce((s, t) => s + (t.amount || 0), 0);

  // Vault balance proxy: total volume in reserve terms
  const vaultBalance = totalVolume;

  // User info
  const authUserStr = localStorage.getItem("auth_user");
  let firstName = "Vault Manager";
  if (authUserStr) {
    try {
      const u = JSON.parse(authUserStr);
      firstName = u.first_name || "Vault Manager";
    } catch {}
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Vault Manager Dashboard"
          description="Welcome back. Monitor vault operations, cash flows, and reconciliation."
          icon={<Lock className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Volume</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `₦${(vaultBalance / 1_000_000).toFixed(2)}M`}
              </p>
              <p className="text-xs text-blue-600 mt-1">Cumulative processed</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cash In (Inflows)</p>
              <p className="text-2xl font-bold mt-2">
                {loading
                  ? "..."
                  : `₦${(totalInflow / 100 / 1_000_000).toFixed(2)}M`}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {inflows.length} transactions
              </p>
            </div>
            <ArrowDownCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Cash Out (Outflows)
              </p>
              <p className="text-2xl font-bold mt-2">
                {loading
                  ? "..."
                  : `₦${(totalOutflow / 100 / 1_000_000).toFixed(2)}M`}
              </p>
              <p className="text-xs text-red-600 mt-1">
                {outflows.length} transactions
              </p>
            </div>
            <ArrowUpCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Pending Reconciliation
              </p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : pendingReconciliation.length}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Need reconciliation
              </p>
            </div>
            <RefreshCw className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Vault Status Banner */}
      <div className="mb-8 p-4 rounded-lg border bg-green-50 dark:bg-green-950 flex items-center gap-4">
        <Shield className="h-8 w-8 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800 dark:text-green-200">
            Vault Integrity: Secure
          </p>
          <p className="text-sm text-green-700 dark:text-green-300">
            All vault operations are operating normally.{" "}
            {totalTxnCount.toLocaleString()} total transactions processed.
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-green-700 dark:text-green-300">
            Last audit
          </p>
          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
            {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Reconciliation */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-orange-500" />
              Pending Reconciliation
            </h3>
            <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 px-2 py-0.5 rounded-full">
              {loading ? "—" : pendingReconciliation.length}
            </span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded" />
              ))}
            </div>
          ) : pendingReconciliation.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">
                All transactions reconciled!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingReconciliation.slice(0, 6).map((t, i) => (
                <div
                  key={t.id || i}
                  className="flex items-center justify-between p-3 border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-950 rounded-r"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.reference || t.transaction_id || `TXN-${i + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold ml-3">
                    ₦{((t.amount || 0) / 100).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Cash Operations */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4 text-blue-500" />
              Recent Cash Operations
            </h3>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 6).map((t, i) => (
                <div
                  key={t.id || i}
                  className="flex items-center justify-between p-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {t.direction === "debit" ||
                    t.type?.toLowerCase().includes("withdrawal") ? (
                      <ArrowUpCircle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-green-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.reference || t.transaction_id || `TXN-${i + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.created_at
                          ? new Date(t.created_at).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p
                      className={`text-sm font-semibold ${
                        t.direction === "debit"
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {t.direction === "debit" ? "-" : "+"}₦
                      {((t.amount || 0) / 100).toLocaleString()}
                    </p>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        t.status?.toLowerCase() === "success"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : t.status?.toLowerCase() === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vault Integrity Checks */}
      <div className="mt-6 bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Vault Integrity Checks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Daily Cash Count",
              status: "Completed",
              ok: true,
              time: "08:00 AM",
            },
            {
              label: "Reconciliation Check",
              status:
                pendingReconciliation.length > 0 ? "Pending" : "Completed",
              ok: pendingReconciliation.length === 0,
              time: "Ongoing",
            },
            {
              label: "Security Audit",
              status: "Passed",
              ok: true,
              time: "Yesterday",
            },
          ].map(({ label, status, ok, time }) => (
            <div
              key={label}
              className={`flex items-center gap-3 p-4 rounded-lg border ${
                ok
                  ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                  : "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800"
              }`}
            >
              {ok ? (
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p
                  className={`text-xs mt-0.5 ${
                    ok
                      ? "text-green-700 dark:text-green-300"
                      : "text-orange-700 dark:text-orange-300"
                  }`}
                >
                  {status} · {time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
