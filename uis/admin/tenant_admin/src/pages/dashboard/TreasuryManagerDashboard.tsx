import { usePermissions } from "@/_core/hooks/usePermissions";
import {
    AlertTriangle,
    BarChart3,
    CheckCircle,
    DollarSign,
    Globe,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function TreasuryManagerDashboard() {
  const { transactions, metrics, loading } = useDashboardData();
  const { hasPermission, checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "vault_management" },
      { resourceType: "tenants", permission: "approve_or_reject" },
      { resourceType: "tenants", permission: "billing_management" },
      { resourceType: "tenants", permission: "coa_management" },
      { resourceType: "tenants", permission: "erp_management" },
      { resourceType: "tenants", permission: "view_analytics" },
    ]);
  }, []);

  const totalVolume = metrics.total_volume;
  const totalCount = metrics.total_count;

  const successTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "success",
  );
  const pendingTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "pending",
  );
  const failedTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "failed",
  );

  const liquidityRatio =
    totalCount > 0
      ? ((successTxns.length / totalCount) * 100).toFixed(1)
      : "0.0";

  // Monthly volume progression (last 6 months simulated from data)
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const nextD = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    const monthTxns = transactions.filter((t) => {
      const td = new Date(t.created_at || t.timestamp || "");
      return td >= d && td < nextD;
    });
    const vol = monthTxns.reduce((s, t) => s + (t.amount || 0), 0) / 100;
    return {
      month: d.toLocaleString("default", { month: "short" }),
      volume: vol,
      count: monthTxns.length,
    };
  });

  const maxVol = Math.max(...monthlyData.map((m) => m.volume), 1);

  // User info
  const authUserStr = localStorage.getItem("auth_user");
  let firstName = "Treasury Manager";
  if (authUserStr) {
    try {
      const u = JSON.parse(authUserStr);
      firstName = u.first_name || "Treasury Manager";
    } catch {}
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Treasury Manager Dashboard"
          description="Welcome back. Monitor liquidity, funds flow, and treasury performance."
          icon={<TrendingUp className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Assets Under Mgmt</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `₦${(totalVolume / 1_000_000).toFixed(2)}M`}
              </p>
              <p className="text-xs text-blue-600 mt-1">Total volume</p>
            </div>
            <Wallet className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Liquidity Ratio</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `${liquidityRatio}%`}
              </p>
              <p className="text-xs text-green-600 mt-1">Success rate proxy</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Funds</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : pendingTxns.length}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Awaiting settlement
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Failed Transfers</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : failedTxns.length}
              </p>
              <p className="text-xs text-red-600 mt-1">Needs attention</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Chart of Accounts",
            href: "/chart-of-accounts",
            icon: BarChart3,
            color:
              "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
            show: hasPermission("tenants", "coa_management"),
          },
          {
            label: "ERP Integration",
            href: "/erp-integration",
            icon: Globe,
            color:
              "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300",
            show: hasPermission("tenants", "erp_management"),
          },
          {
            label: "View Transactions",
            href: "/transactions",
            icon: DollarSign,
            color:
              "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300",
            show: true,
          },
          {
            label: "Analytics",
            href: "/admin/analytics",
            icon: TrendingUp,
            color:
              "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300",
            show: hasPermission("tenants", "view_analytics"),
          },
        ]
          .filter((item) => item.show)
          .map(({ label, href, icon: Icon, color }) => (
            <Link key={href} href={href}>
              <div
                className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${color}`}
              >
                <Icon className="h-5 w-5 mb-2" />
                <p className="text-sm font-medium">{label}</p>
              </div>
            </Link>
          ))}
      </div>

      {/* Charts + Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Trend (bar chart — CSS-based) */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Monthly Volume Trend
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-8 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {monthlyData.map(({ month, volume, count }) => (
                <div key={month} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">
                    {month}
                  </span>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${(volume / maxVol) * 100}%` }}
                    />
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold">
                      ₦{(volume / 1_000_000).toFixed(1)}M
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({count})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settlement Status */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Settlement Queue</h3>
            <Link href="/transactions">
              <span className="text-xs text-primary cursor-pointer hover:underline">
                View all
              </span>
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded" />
              ))}
            </div>
          ) : pendingTxns.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">
                All transfers settled!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTxns.slice(0, 6).map((t, i) => (
                <div
                  key={t.id || i}
                  className="flex items-center justify-between p-3 border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-950 rounded-r"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.reference || t.transaction_id || `TXN-${i + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleString()
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
      </div>

      {/* Treasury Summary */}
      <div className="mt-6 bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Treasury Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {loading ? "—" : totalCount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total Transactions
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {loading ? "—" : successTxns.length.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Settled</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">
              {loading ? "—" : pendingTxns.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {loading ? "—" : failedTxns.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Failed</p>
          </div>
        </div>

        {failedTxns.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">
              {failedTxns.length} failed transaction
              {failedTxns.length !== 1 ? "s" : ""} require investigation.{" "}
              <Link href="/transactions">
                <span className="underline cursor-pointer font-medium">
                  Review now
                </span>
              </Link>
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
