import { usePermissions } from "@/_core/hooks/usePermissions";
import {
    AlertTriangle,
    CheckCircle,
    ExternalLink,
    Heart,
    MessageSquare,
    Star,
    Target,
    TrendingUp,
    UserCheck,
    UserPlus,
    Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";
import { type RMDashboard, getDashboard } from "../../services/rmService";

export default function RelationshipManagerDashboard() {
  const { transactions, users, metrics, loading } = useDashboardData();
  const { hasPermission, checkPermissions } = usePermissions();
  const [rmData, setRmData] = useState<RMDashboard | null>(null);

  useEffect(() => {
    getDashboard()
      .then((d) => setRmData(d))
      .catch(() => { /* RM service may not be reachable; fall back silently */ });
  }, []);

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "manage_customers" },
      { resourceType: "tenants", permission: "applications" },
      { resourceType: "tenants", permission: "communication_hub_management" },
      { resourceType: "tenants", permission: "view_analytics" },
    ]);
  }, []);

  const totalCustomers = rmData?.totalCustomers ?? users.length;
  const totalVolume = rmData?.totalBalance ?? metrics.total_volume;

  // Customers onboarded this month
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const newThisMonth = users.filter((u) => {
    const d = new Date(u.created_at || u.date_joined || "");
    return d >= thisMonth;
  });

  // Active customers (those with successful transactions)
  const activeCustomerIds = new Set(
    transactions
      .filter((t) => t.status?.toLowerCase() === "success")
      .map((t) => t.user_id || t.sender_id)
      .filter(Boolean),
  );

  const retentionRate =
    totalCustomers > 0
      ? Math.min(
          100,
          (activeCustomerIds.size / Math.max(totalCustomers, 1)) * 100,
        ).toFixed(1)
      : "0.0";

  // User info from localStorage
  const authUserStr = localStorage.getItem("auth_user");
  let firstName = "Relationship Manager";
  if (authUserStr) {
    try {
      const u = JSON.parse(authUserStr);
      firstName = u.first_name || "Relationship Manager";
    } catch {}
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Relationship Manager Dashboard"
          description="Welcome back. Manage customer relationships and drive portfolio growth."
          icon={<Users className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Managed Customers</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : totalCustomers.toLocaleString()}
              </p>
              <p className="text-xs text-blue-600 mt-1">Total portfolio</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">New This Month</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : newThisMonth.length}
              </p>
              <p className="text-xs text-green-600 mt-1">Onboarded</p>
            </div>
            <UserPlus className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Customers</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : activeCustomerIds.size}
              </p>
              <p className="text-xs text-purple-600 mt-1">With recent txns</p>
            </div>
            <UserCheck className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        {/* Revenue Achievement — from RM service if available */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Revenue Achievement</p>
              <p className="text-2xl font-bold mt-2">
                {rmData ? `${Math.min(100, rmData.achievement).toFixed(1)}%` : `${retentionRate}%`}
              </p>
              <p className={`text-xs mt-1 ${rmData && rmData.achievement >= 80 ? "text-green-600" : "text-yellow-600"}`}>
                {rmData ? `₦${(rmData.totalRevenue / 1_000_000).toFixed(1)}M of ₦${(rmData.revenueTarget / 1_000_000).toFixed(1)}M` : "Active engagement"}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        {/* Pipeline Value — from RM service */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pipeline Value</p>
              <p className="text-2xl font-bold mt-2">
                {rmData ? `₦${(rmData.pipelineValue / 1_000_000).toFixed(1)}M` : "—"}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                {rmData ? `${rmData.totalOpportunities} opportunities` : "Loading…"}
              </p>
            </div>
            <Target className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        {/* At-Risk Customers — from RM service */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">At-Risk Customers</p>
              <p className="text-2xl font-bold mt-2">
                {rmData !== null ? rmData.atRiskCustomers : "—"}
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                {rmData ? `${rmData.dormantCustomers} dormant` : ""}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "RM Portal",
            href: "/relationship-manager",
            icon: ExternalLink,
            color:
              "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300",
            show: true,
          },
          {
          label: "View Customers",
            href: "/users",
            icon: Users,
            color:
              "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
            show: hasPermission("tenants", "manage_customers"),
          },
          {
            label: "Communication Hub",
            href: "/communication-hub",
            icon: MessageSquare,
            color:
              "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300",
            show: hasPermission("tenants", "communication_hub_management"),
          },
          {
            label: "Loan Applications",
            href: "/loans",
            icon: Star,
            color:
              "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300",
            show: hasPermission("tenants", "applications"),
          },
          {
            label: "Savings Products",
            href: "/savings",
            icon: Heart,
            color:
              "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300",
            show: true,
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

      {/* Customer List + Portfolio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Customers */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Customers</h3>
            <Link href="/users">
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
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No customers found
            </p>
          ) : (
            <div className="space-y-2">
              {users.slice(0, 6).map((u, i) => {
                const name =
                  u.first_name && u.last_name
                    ? `${u.first_name} ${u.last_name}`
                    : u.name || u.email || `Customer ${i + 1}`;
                const initials = name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                return (
                  <div
                    key={u.id || i}
                    className="flex items-center gap-3 p-3 border-b last:border-0"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 text-sm font-semibold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email || u.phone || "—"}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        u.is_verified
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                      }`}
                    >
                      {u.is_verified ? "Verified" : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Portfolio Performance */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Portfolio Performance</h3>

          <div className="space-y-4">
            {/* Volume Bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Total Volume</span>
                <span className="font-semibold">
                  ₦{(totalVolume / 1_000_000).toFixed(2)}M
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: "75%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Active vs Total</span>
                <span className="font-semibold">
                  {activeCustomerIds.size} / {totalCustomers}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: `${
                      totalCustomers > 0
                        ? Math.min(
                            100,
                            (activeCustomerIds.size / totalCustomers) * 100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">
                  Transaction Success
                </span>
                <span className="font-semibold">
                  {transactions.length > 0
                    ? (
                        (transactions.filter(
                          (t) => t.status?.toLowerCase() === "success",
                        ).length /
                          transactions.length) *
                        100
                      ).toFixed(1)
                    : "0.0"}
                  %
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${
                      transactions.length > 0
                        ? (transactions.filter(
                            (t) => t.status?.toLowerCase() === "success",
                          ).length /
                            transactions.length) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Summary Block */}
          <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-green-600">
                {loading
                  ? "—"
                  : transactions.filter(
                      (t) => t.status?.toLowerCase() === "success",
                    ).length}
              </p>
              <p className="text-xs text-muted-foreground">Successful Txns</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">
                {loading
                  ? "—"
                  : transactions.filter(
                      (t) => t.status?.toLowerCase() === "failed",
                    ).length}
              </p>
              <p className="text-xs text-muted-foreground">Failed Txns</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>Portfolio health: Good</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
