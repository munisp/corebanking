import { usePermissions } from "@/_core/hooks/usePermissions";
import { Activity, AlertTriangle, CheckCircle, Clock, Zap } from "lucide-react";
import { useEffect } from "react";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function OperationsOfficerDashboard() {
  const { transactions, loading } = useDashboardData();
  const { checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "initiate_transactions" },
      { resourceType: "tenants", permission: "teller_actions" },
      { resourceType: "tenants", permission: "card_management" },
      { resourceType: "tenants", permission: "view_analytics" },
      { resourceType: "tenants", permission: "manage_esusu" },
      { resourceType: "tenants", permission: "approve_or_reject" },
    ]);
  }, []);

  const pendingTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "pending",
  );
  const todayTxns = transactions.filter((t) => {
    const txnDate = new Date(t.created_at || t.timestamp);
    const today = new Date();
    return txnDate.toDateString() === today.toDateString();
  });
  const successTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "success",
  );
  const failedTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "failed",
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Operations Officer Dashboard"
          description="Welcome, Operations Officer! Monitor operations and manage workflows."
          icon={<Zap className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* Operations Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Tasks</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : pendingTxns.length}
              </p>
              <p className="text-xs text-orange-600 mt-1">Need processing</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed Today</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : todayTxns.length}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Today's transactions
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Successful</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : successTxns.length}
              </p>
              <p className="text-xs text-blue-600 mt-1">All time</p>
            </div>
            <Activity className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : failedTxns.length}
              </p>
              <p className="text-xs text-red-600 mt-1">Need attention</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Task Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Pending Transactions</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded" />
              ))}
            </div>
          ) : pendingTxns.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">No pending transactions!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTxns.slice(0, 5).map((t, i) => (
                <div key={t.id || i} className="p-3 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 rounded">
                  <p className="text-sm font-medium truncate">
                    {t.reference || t.transaction_id || `TXN-${i + 1}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ₦{((t.amount || 0) / 100).toLocaleString()} •{" "}
                    {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Recent Transactions</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((t, i) => (
                <div key={t.id || i} className="flex items-start gap-3 py-2 border-b last:border-0">
                  {t.status?.toLowerCase() === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{t.reference || t.transaction_id || `TXN-${i + 1}`}</p>
                    <p className="text-xs text-muted-foreground">
                      ₦{((t.amount || 0) / 100).toLocaleString()} •{" "}
                      {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                    </p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${t.status?.toLowerCase() === "success" ? "bg-green-100 text-green-700" : t.status?.toLowerCase() === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
