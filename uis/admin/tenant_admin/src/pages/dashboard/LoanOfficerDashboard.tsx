import { usePermissions } from "@/_core/hooks/usePermissions";
import {
    CheckCircle,
    Clock,
    CreditCard,
    DollarSign,
    FileText,
    TrendingUp,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function LoanOfficerDashboard() {
  const { transactions, users, metrics, loading } = useDashboardData();
  const { hasPermission, checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "applications" },
      { resourceType: "tenants", permission: "approve_loans" },
      { resourceType: "tenants", permission: "manage_loan_limits" },
      { resourceType: "tenants", permission: "view_analytics" },
    ]);
  }, []);

  const totalVolume = metrics.total_volume;

  // Derive loan-related figures from transaction data
  const allTxns = transactions;
  const pendingLoans = allTxns.filter(
    (t) =>
      t.status?.toLowerCase() === "pending" &&
      (t.type?.toLowerCase().includes("loan") ||
        t.description?.toLowerCase().includes("loan")),
  );
  const approvedToday = allTxns.filter((t) => {
    if (t.status?.toLowerCase() !== "success") return false;
    const d = new Date(t.created_at || t.timestamp || "");
    return d.toDateString() === new Date().toDateString();
  });
  const failedTxns = allTxns.filter(
    (t) => t.status?.toLowerCase() === "failed",
  );
  const successCount = allTxns.filter(
    (t) => t.status?.toLowerCase() === "success",
  ).length;
  const repaymentRate =
    allTxns.length > 0
      ? ((successCount / allTxns.length) * 100).toFixed(1)
      : "0.0";

  // User info from localStorage
  const authUserStr = localStorage.getItem("auth_user");
  let firstName = "Loan Officer";
  if (authUserStr) {
    try {
      const u = JSON.parse(authUserStr);
      firstName = u.first_name || u.name || "Loan Officer";
    } catch {}
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Loan Officer Dashboard"
          description="Welcome back. Review and manage loan applications and disbursements."
          icon={<FileText className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Pending Applications
              </p>
              <p className="text-2xl font-bold mt-2">
                {loading
                  ? "..."
                  : pendingLoans.length ||
                    allTxns.filter((t) => t.status?.toLowerCase() === "pending")
                      .length}
              </p>
              <p className="text-xs text-orange-600 mt-1">Awaiting review</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Approved Today</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : approvedToday.length}
              </p>
              <p className="text-xs text-green-600 mt-1">Disbursed today</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Portfolio</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `₦${(totalVolume / 1_000_000).toFixed(1)}M`}
              </p>
              <p className="text-xs text-blue-600 mt-1">Cumulative volume</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Repayment Rate</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `${repaymentRate}%`}
              </p>
              <p className="text-xs text-green-600 mt-1">Transaction success</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>
      {/* Quick Actions */}
      {hasPermission("tenants", "applications") && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "New Loan Application",
              href: "/loan-application",
              icon: FileText,
              color:
                "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
            },
            {
              label: "View All Loans",
              href: "/loans",
              icon: CreditCard,
              color:
                "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300",
            },
            {
              label: "Mortgage Applications",
              href: "/mortgage-application",
              icon: DollarSign,
              color:
                "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300",
            },
            {
              label: "Education Loans",
              href: "/education-banking",
              icon: FileText,
              color:
                "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300",
            },
          ].map(({ label, href, icon: Icon, color }) => (
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
      )}
      {/* Tables */}{" "}
      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> */}
      {/* Recent Applications */}
      {/* <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Transactions</h3>
            <Link href="/loans">
              <span className="text-xs text-primary cursor-pointer hover:underline">
                View all
              </span>
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded" />
              ))}
            </div>
          ) : allTxns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No transactions found
            </p>
          ) : (
            <div className="space-y-2">
              {allTxns.slice(0, 6).map((t, i) => (
                <div
                  key={t.id || i}
                  className="flex items-center justify-between p-3 border-b last:border-0"
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
                  <div className="text-right ml-3">
                    <p className="text-sm font-semibold">
                      ₦{(t.amount || 0).toLocaleString()}
                    </p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.status?.toLowerCase() === "success"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : t.status?.toLowerCase() === "pending"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      }`}
                    >
                      {t.status || "unknown"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div> */}
      {/* At-Risk / Failed */}
      {/* <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Failed / At-Risk Transactions
            </h3>
            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-2 py-0.5 rounded-full">
              {loading ? "—" : failedTxns.length} flagged
            </span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded" />
              ))}
            </div>
          ) : failedTxns.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">
                No failed transactions. Great performance!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {failedTxns.slice(0, 6).map((t, i) => (
                <div
                  key={t.id || i}
                  className="flex items-center justify-between p-3 border-l-4 border-red-400 bg-red-50 dark:bg-red-950 rounded-r"
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
                  <p className="text-sm font-semibold text-red-600 ml-3">
                    ₦{((t.amount || 0) / 100).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div> */}
      {/* </div> */}
      {/* Customer Summary */}
      <div className="mt-6 bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Customer Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {loading ? "—" : users.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total Customers
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {loading
                ? "—"
                : allTxns.filter((t) => t.status?.toLowerCase() === "success")
                    .length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Successful Txns
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {loading
                ? "—"
                : allTxns.filter((t) => t.status?.toLowerCase() === "pending")
                    .length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Pending Txns</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {loading ? "—" : failedTxns.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Failed Txns</p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
