import { BarChart3, DollarSign, TrendingUp, Users } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function AnalystDashboard() {
  const { transactions, users, metrics, loading } = useDashboardData();

  const totalTransactions = metrics.total_count;
  const activeCustomers = users.length;
  const totalVolume = metrics.total_volume;
  const successfulTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "success",
  ).length;
  const successRate =
    totalTransactions > 0
      ? ((successfulTxns / totalTransactions) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Analyst Dashboard"
          description="Welcome, Analyst! View analytics, reports, and key metrics."
          icon={<BarChart3 className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* Analytics Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Total Transactions
              </p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : totalTransactions.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Customers</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : activeCustomers.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Registered users
              </p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
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
              <p className="text-xs text-muted-foreground mt-1">
                Total processed
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `${successRate}%`}
              </p>
              <p className="text-xs text-green-600 mt-1">Transaction success</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Reports Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Recent Transactions</h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-10 bg-muted rounded" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((t, i) => (
                <div key={t.id || i} className="flex justify-between items-center p-3 border-b last:border-0 hover:bg-accent">
                  <span className="text-sm truncate">{t.reference || t.transaction_id || `TXN-${i + 1}`}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${t.status?.toLowerCase() === "success" ? "bg-green-100 text-green-700" : t.status?.toLowerCase() === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Key Insights</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {transactions.filter(t => t.status?.toLowerCase() === "success").length} successful transactions
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Out of {transactions.length} total — {successRate}% success rate
                </p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  {activeCustomers.toLocaleString()} registered customers
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Total volume: ₦{(totalVolume / 1_000_000).toFixed(2)}M processed
                </p>
              </div>
              {transactions.filter(t => t.status?.toLowerCase() === "failed").length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    {transactions.filter(t => t.status?.toLowerCase() === "failed").length} failed transactions
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    Require investigation
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
