import { usePermissions } from "@/_core/hooks/usePermissions";
import { Activity, Cpu, Database, HardDrive, Server, Zap } from "lucide-react";
import { useEffect } from "react";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function TechnicalAdminDashboard() {
  const { transactions, users, metrics, loading } = useDashboardData();
  const { checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "manage_employees" },
      { resourceType: "tenants", permission: "temporal_access_management" },
      { resourceType: "tenants", permission: "erp_management" },
      { resourceType: "tenants", permission: "view_analytics" },
      { resourceType: "platform", permission: "enable_features" },
    ]);
  }, []);

  // Use metrics endpoint for the real all-time total (transactions array is paginated)
  const apiCalls = metrics.total_count;
  const successTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "success",
  ).length;
  const failedTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "failed",
  ).length;
  const pendingTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "pending",
  ).length;
  const sampleSize = transactions.length;
  const uptime =
    sampleSize > 0
      ? ((successTxns / sampleSize) * 100).toFixed(2)
      : "0.00";
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Technical Admin Dashboard"
          description="Welcome, Technical Admin! Monitor system health and manage integrations."
          icon={<Cpu className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* Infrastructure Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">API Calls</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : apiCalls.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 mt-1">Total requests</p>
            </div>
            <Cpu className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : users.length}
              </p>
              <p className="text-xs text-orange-600 mt-1">Registered</p>
            </div>
            <HardDrive className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">API Uptime</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `${uptime}%`}
              </p>
              <p className="text-xs text-green-600 mt-1">Success rate</p>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Failed Requests</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : failedTxns.toLocaleString()}
              </p>
              <p className="text-xs text-red-600 mt-1">Need attention</p>
            </div>
            <Zap className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* System Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Server className="h-5 w-5" />
            Transaction Status Breakdown
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-10 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 rounded hover:bg-accent">
                <span className="text-sm">Successful</span>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                  {successTxns.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded hover:bg-accent">
                <span className="text-sm">Pending</span>
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                  {pendingTxns.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded hover:bg-accent">
                <span className="text-sm">Failed</span>
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                  {failedTxns.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded hover:bg-accent">
                <span className="text-sm">Total</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  {apiCalls.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Database className="h-5 w-5" />
            User & Volume Stats
          </h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-8 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Registered Users</span>
                <span className="text-sm font-bold">{users.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">API Success Rate</span>
                <span className="text-sm font-bold text-green-600">{uptime}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Transactions</span>
                <span className="text-sm font-bold">{metrics.total_count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Failed Transactions</span>
                <span className={`text-sm font-bold ${failedTxns > 0 ? "text-red-600" : "text-green-600"}`}>
                  {failedTxns.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
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
              <div key={t.id || i} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <p className="text-sm font-medium">{t.reference || t.transaction_id || `TXN-${i + 1}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${t.status?.toLowerCase() === "success" ? "bg-green-100 text-green-700" : t.status?.toLowerCase() === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
