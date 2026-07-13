import { usePermissions } from "@/_core/hooks/usePermissions";
import { AlertTriangle, CheckCircle, FileText, Shield } from "lucide-react";
import { useEffect } from "react";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function ComplianceOfficerDashboard() {
  const { transactions, users, metrics, loading } = useDashboardData();
  const { checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "verify_kyc" },
      { resourceType: "tenants", permission: "flag_suspicious_activity" },
      { resourceType: "tenants", permission: "dispute_management" },
      { resourceType: "tenants", permission: "manage_transaction_limits" },
      { resourceType: "tenants", permission: "approve_loans" },
      { resourceType: "tenants", permission: "view_audit_logs" },
      { resourceType: "tenants", permission: "view_analytics" },
    ]);
  }, []);

  const highValueTxns = transactions.filter(
    (t) => parseFloat(t.amount) > 1000000,
  );
  const successTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "success",
  );
  const failedTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "failed",
  );
  const pendingTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "pending",
  );
  // Rate from sample; total count from metrics endpoint (transactions array is paginated)
  const sampleSize = transactions.length;
  const complianceScore = sampleSize > 0
    ? ((successTxns.length / sampleSize) * 100).toFixed(1)
    : "0.0";
  const openRisks = failedTxns.length;

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Compliance Officer Dashboard"
          description="Welcome, Compliance Officer! Monitor compliance and risk assessments."
          icon={<CheckCircle className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* Compliance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Compliance Score</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : `${complianceScore}%`}
              </p>
              <p className="text-xs text-green-600 mt-1">Good standing</p>
            </div>
            <Shield className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Open Risks</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : openRisks}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Failed transactions
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">High Value Txns</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : highValueTxns.length}
              </p>
              <p className="text-xs text-green-600 mt-1">1M each</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? "..." : users.length}
              </p>
              <p className="text-xs text-orange-600 mt-1">This week</p>
            </div>
            <FileText className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Compliance Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Risk Assessment</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {failedTxns.length > 0 && (
                <div className="p-3 border-l-4 border-red-500 bg-red-50 dark:bg-red-950 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">Failed Transactions</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {failedTxns.length} transaction{failedTxns.length !== 1 ? "s" : ""} failed — require review
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded">High</span>
                  </div>
                </div>
              )}
              {pendingTxns.length > 0 && (
                <div className="p-3 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">Pending Transactions</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pendingTxns.length} transaction{pendingTxns.length !== 1 ? "s" : ""} awaiting processing
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded">Medium</span>
                  </div>
                </div>
              )}
              {highValueTxns.length > 0 && (
                <div className="p-3 border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">High Value Transactions</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {highValueTxns.length} transaction{highValueTxns.length !== 1 ? "s" : ""} above ₦1M threshold
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-orange-200 text-orange-800 rounded">Monitor</span>
                  </div>
                </div>
              )}
              {failedTxns.length === 0 && pendingTxns.length === 0 && highValueTxns.length === 0 && (
                <div className="flex flex-col items-center py-6 text-center">
                  <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
                  <p className="text-sm text-muted-foreground">No active risks detected</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Transaction Health</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-10 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <div>
                  <p className="text-sm font-medium">Total Transactions</p>
                  <p className="text-xs text-muted-foreground">All time</p>
                </div>
                <span className="text-sm font-bold">{metrics.total_count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Successful</p>
                <span className="text-sm font-bold text-green-600">{successTxns.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Failed</p>
                <span className="text-sm font-bold text-red-600">{failedTxns.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Pending</p>
                <span className="text-sm font-bold text-yellow-600">{pendingTxns.length.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
