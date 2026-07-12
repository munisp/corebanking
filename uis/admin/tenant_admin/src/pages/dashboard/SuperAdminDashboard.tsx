import { usePermissions } from "@/_core/hooks/usePermissions";
import {
    Activity,
    AlertCircle,
    Crown,
    Server,
    Shield,
    TrendingUp,
    Users,
} from "lucide-react";
import { useEffect } from "react";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function SuperAdminDashboard() {
  const { transactions, users, metrics, loading } = useDashboardData();
  const { hasPermission, checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "view_all_data" },
      { resourceType: "tenants", permission: "manage_employees" },
      { resourceType: "tenants", permission: "view_analytics" },
      { resourceType: "tenants", permission: "temporal_access_management" },
      { resourceType: "tenants", permission: "emergency_override" },
      { resourceType: "tenants", permission: "view_audit_logs" },
    ]);
  }, []);

  const totalUsers = users.length;
  // Use metrics endpoint for the real all-time total (transactions array is paginated)
  const totalTxns = metrics.total_count;
  const successfulTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "success",
  ).length;
  const sampleSize = transactions.length;
  const uptime =
    sampleSize > 0
      ? ((successfulTxns / sampleSize) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Super Admin Dashboard"
          description="Welcome, Super Admin! Full access to all features and settings."
          icon={<Crown className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* System Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">System Uptime</p>
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
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : totalUsers.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 mt-1">Registered users</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : totalTxns.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 mt-1">All time</p>
            </div>
            <Server className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `${uptime}%`}
              </p>
              <p className="text-xs text-green-600 mt-1">Transaction health</p>
            </div>
            <Shield className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* System Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Transaction Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 border-b">
              <span className="text-sm">Total Transactions</span>
              <span className="text-sm font-bold text-green-600">
                {loading ? "..." : totalTxns.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 border-b">
              <span className="text-sm">Successful <span className="text-xs text-muted-foreground">(recent)</span></span>
              <span className="text-sm font-bold text-green-600">
                {loading ? "..." : successfulTxns.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 border-b">
              <span className="text-sm">Failed <span className="text-xs text-muted-foreground">(recent)</span></span>
              <span className="text-sm font-bold text-red-600">
                {loading ? "..." : transactions.filter(t => t.status?.toLowerCase() === "failed").length.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-3">
              <span className="text-sm">Pending <span className="text-xs text-muted-foreground">(recent)</span></span>
              <span className="text-sm font-bold text-yellow-600">
                {loading ? "..." : transactions.filter(t => t.status?.toLowerCase() === "pending").length.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">System Alerts</h3>
          <div className="space-y-3">
            <div className="p-3 border-l-4 border-green-500 bg-green-50 dark:bg-green-950 rounded">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">All systems operational</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No issues detected
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950 rounded">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Scheduled maintenance</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Database backup at 2 AM
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950 rounded">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-purple-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Security scan completed</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No vulnerabilities found
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {hasPermission("tenants", "manage_employees") && (
            <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-left">
              <Users className="h-5 w-5 mb-2 text-blue-500" />
              <p className="text-sm font-medium">Manage Users</p>
              <p className="text-xs text-muted-foreground mt-1">
                View all users
              </p>
            </button>
          )}
          <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-left">
            <Server className="h-5 w-5 mb-2 text-green-500" />
            <p className="text-sm font-medium">Server Status</p>
            <p className="text-xs text-muted-foreground mt-1">
              Monitor servers
            </p>
          </button>
          {hasPermission("tenants", "emergency_override") && (
            <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-left">
              <Shield className="h-5 w-5 mb-2 text-purple-500" />
              <p className="text-sm font-medium">Security Settings</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure security
              </p>
            </button>
          )}
          {hasPermission("tenants", "view_audit_logs") && (
            <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-left">
              <Activity className="h-5 w-5 mb-2 text-orange-500" />
              <p className="text-sm font-medium">System Logs</p>
              <p className="text-xs text-muted-foreground mt-1">
                View activity logs
              </p>
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
