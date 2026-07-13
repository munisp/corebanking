import { usePermissions } from "@/_core/hooks/usePermissions";
import {
    Activity,
    AlertCircle,
    Building2,
    DollarSign,
    TrendingUp,
    Users,
} from "lucide-react";
import { useEffect } from "react";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function BankAdminDashboard() {
  const { transactions, users, metrics, loading } = useDashboardData();
  const { hasPermission, checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "view_branch_data" },
      { resourceType: "tenants", permission: "teller_management" },
      { resourceType: "tenants", permission: "approve_or_reject" },
      { resourceType: "tenants", permission: "manage_employees" },
      { resourceType: "tenants", permission: "view_analytics" },
    ]);
  }, []);

  const totalCustomers = users.length;
  const totalTransactions = metrics.total_count;
  const totalVolume = metrics.total_volume;
  const successTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "success",
  ).length;
  const systemHealth =
    totalTransactions > 0
      ? ((successTxns / totalTransactions) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Bank Admin Dashboard"
          description="Welcome, Bank Admin! Manage bank-wide settings and users."
          icon={<Building2 className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* Bank Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : totalCustomers.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 mt-1">Active users</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Total Transactions
              </p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : totalTransactions.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 mt-1">All time</p>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Transaction Volume
              </p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `₦${(totalVolume / 1000000).toFixed(1)}M`}
              </p>
              <p className="text-xs text-green-600 mt-1">Total processed</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">System Health</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `${systemHealth}%`}
              </p>
              <p className="text-xs text-green-600 mt-1">Excellent</p>
            </div>
            <Activity className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Management Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Transaction Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 border-b">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Successful</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-600">
                  {loading ? "..." : transactions.filter(t => t.status?.toLowerCase() === "success").length.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">transactions</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 border-b">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Pending</p>
                  <p className="text-xs text-muted-foreground">Awaiting processing</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-yellow-600">
                  {loading ? "..." : transactions.filter(t => t.status?.toLowerCase() === "pending").length.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">transactions</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-3">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">Total Volume</p>
                  <p className="text-xs text-muted-foreground">All time</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-600">
                  {loading ? "..." : `₦${(totalVolume / 1_000_000).toFixed(1)}M`}
                </p>
                <p className="text-xs text-muted-foreground">processed</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">System Status</h3>
          <div className="space-y-3">
            {transactions.filter(t => t.status?.toLowerCase() === "failed").length > 0 ? (
              <div className="p-3 border-l-4 border-red-500 bg-red-50 dark:bg-red-950 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">
                      {loading ? "..." : transactions.filter(t => t.status?.toLowerCase() === "failed").length} failed transactions
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Require attention
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="p-3 border-l-4 border-green-500 bg-green-50 dark:bg-green-950 rounded">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    {loading ? "..." : `${systemHealth}% success rate`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on transaction data
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950 rounded">
              <div className="flex items-start gap-2">
                <Activity className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    {loading ? "..." : `${totalCustomers.toLocaleString()} registered users`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total customer base
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hasPermission("tenants", "manage_employees") && (
            <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-left">
              <Users className="h-5 w-5 mb-2 text-blue-500" />
              <p className="text-sm font-medium">Create Admin User</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add administrator account
              </p>
            </button>
          )}
          <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-left">
            <Building2 className="h-5 w-5 mb-2 text-green-500" />
            <p className="text-sm font-medium">Bank Settings</p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure bank parameters
            </p>
          </button>
          {hasPermission("tenants", "view_analytics") && (
            <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-left">
              <Activity className="h-5 w-5 mb-2 text-purple-500" />
              <p className="text-sm font-medium">System Reports</p>
              <p className="text-xs text-muted-foreground mt-1">
                View detailed analytics
              </p>
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
