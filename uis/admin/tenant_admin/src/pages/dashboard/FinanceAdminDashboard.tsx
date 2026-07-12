import { usePermissions } from "@/_core/hooks/usePermissions";
import { CreditCard, DollarSign, TrendingUp } from "lucide-react";
import { useEffect } from "react";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function FinanceAdminDashboard() {
  const { transactions, metrics, loading } = useDashboardData();
  const { checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "billing_management" },
      { resourceType: "tenants", permission: "coa_management" },
      { resourceType: "tenants", permission: "approve_or_reject" },
      { resourceType: "tenants", permission: "view_analytics" },
      { resourceType: "tenants", permission: "lpo_management" },
    ]);
  }, []);

  const totalRevenue = metrics.total_volume;
  const successTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "success",
  );
  const failedTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "failed",
  );
  const pendingTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "pending",
  );
  const transactionFees = totalRevenue * 0.01;
  const successRate = transactions.length > 0
    ? ((successTxns.length / transactions.length) * 100).toFixed(1)
    : "0.0";
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Finance Admin Dashboard"
          description="Welcome, Finance Admin! Manage financial operations and accounting."
          icon={<DollarSign className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `₦${(totalRevenue / 1000000).toFixed(1)}M`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Transaction Fees (1%)</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `₦${(transactionFees / 1_000_000).toFixed(2)}M`}
              </p>
              <p className="text-xs text-green-600 mt-1">Est. from volume</p>
            </div>
            <CreditCard className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Successful Txns</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : successTxns.length.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 mt-1">{loading ? "..." : `${successRate}% success rate`}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Failed Txns</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : failedTxns.length.toLocaleString()}
              </p>
              <p className="text-xs text-orange-600 mt-1">Require review</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Financial Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Pending Transactions</h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-12 bg-muted rounded" />
              ))}
            </div>
          ) : pendingTxns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pending transactions</p>
          ) : (
            <div className="space-y-2">
              {pendingTxns.slice(0, 5).map((t, i) => (
                <div key={t.id || i} className="flex justify-between items-center p-3 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{t.reference || t.transaction_id || `TXN-${i + 1}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-yellow-600">
                    ₦{((t.amount || 0) / 100).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Recent Transactions</h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-12 bg-muted rounded" />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((t, i) => (
                <div key={t.id || i} className="flex justify-between items-center p-3 border-b last:border-0">
                  <div>
                    <p className="text-sm">{t.reference || t.transaction_id || `TXN-${i + 1}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${t.status?.toLowerCase() === "success" ? "text-green-600" : t.status?.toLowerCase() === "failed" ? "text-red-600" : "text-yellow-600"}`}>
                    ₦{((t.amount || 0) / 100).toLocaleString()}
                  </p>
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
