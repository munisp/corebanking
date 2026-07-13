import { usePermissions } from "@/_core/hooks/usePermissions";
import { BACKEND_URL } from "@/const";
import { tenantService } from "@/services/tenant";
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Download,
    FileSearch,
    Loader2,
    Shield,
    ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { useDashboardData } from "../../hooks/useDashboardData";

interface AuditLog {
  id: string;
  actor_id: string;
  event_type: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  timestamp: string;
  event_data: {
    type?: string;
    email?: string;
    payee?: string;
    payer?: string;
    amount?: string;
    transaction_id?: string;
    [key: string]: any;
  };
  tenant_id: string;
}

export default function AuditorDashboard() {
  const { transactions, users, metrics, loading: dashboardLoading } = useDashboardData();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const { hasPermission, checkPermissions } = usePermissions();

  useEffect(() => {
    checkPermissions([
      { resourceType: "tenants", permission: "view_audit_logs" },
      { resourceType: "tenants", permission: "export_audit_logs" },
      { resourceType: "tenants", permission: "reverse_transactions" },
      { resourceType: "tenants", permission: "flag_suspicious_activity" },
    ]);
  }, []);

  // Fetch audit logs
  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setAuditLoading(true);
        setAuditError(null);

        const tenantConfig = tenantService.getTenantConfig();
        const tenantId = tenantConfig?.tenant_id;

        if (!tenantId) {
          throw new Error("Tenant ID not found");
        }

        const response = await fetch(
          `${BACKEND_URL}/audit/audits/tenant/${tenantId}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
        }

        const data = await response.json();
        const logs = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.audits)
              ? data.audits
              : Array.isArray(data?.results)
                ? data.results
                : [];
        setAuditLogs(logs);
      } catch (err) {
        setAuditError(
          err instanceof Error ? err.message : "Failed to fetch audit logs",
        );
        console.error("Error fetching audit logs:", err);
      } finally {
        setAuditLoading(false);
      }
    };

    fetchAuditLogs();
  }, []);

  const loading = dashboardLoading || auditLoading;
  const totalAuditLogs = auditLogs.length;
  const successTxns = transactions.filter(
    (t) => t.status?.toLowerCase() === "success",
  ).length;
  const sampleSize = transactions.length;
  // Rate from sample; total count from metrics endpoint (transactions array is paginated)
  const complianceScore =
    sampleSize > 0
      ? ((successTxns / sampleSize) * 100).toFixed(0)
      : "0";
  const flaggedEvents = transactions.filter(
    (t) => t.status?.toLowerCase() === "failed",
  ).length;

  // Get recent audit events (last 5)
  const recentAuditEvents = [...auditLogs]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 5);

  // Get unique users from audit logs
  const uniqueAuditUsers = new Set(auditLogs.map((log) => log.actor_id)).size;

  // Format time ago
  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return "Just now";
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Dashboard"
          title="Auditor Dashboard"
          description="Welcome, Auditor! Review compliance and audit trails."
          icon={<ShieldCheck className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">

      {/* Error State */}
      {auditError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 font-medium">
            Error loading audit logs
          </p>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">
            {auditError}
          </p>
        </div>
      )}

      {/* Audit Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Audit Logs</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  totalAuditLogs.toLocaleString()
                )}
              </p>
              <p className="text-xs text-blue-600 mt-1">Total records</p>
            </div>
            <FileSearch className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Compliance Score</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `${complianceScore}%`
                )}
              </p>
              <p className="text-xs text-green-600 mt-1">Success rate</p>
            </div>
            <Shield className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Flagged Events</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  flaggedEvents
                )}
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
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-2xl font-bold mt-2">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  uniqueAuditUsers
                )}
              </p>
              <p className="text-xs text-purple-600 mt-1">From audit logs</p>
            </div>
            <Download className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Audit Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Recent Audit Events</h3>
          {auditLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recentAuditEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No audit events found
            </p>
          ) : (
            <div className="space-y-3">
              {recentAuditEvents.map((log) => {
                const getEventIcon = () => {
                  switch (log.event_type) {
                    case "LOGIN":
                      return <CheckCircle className="h-4 w-4 text-green-500" />;
                    case "TRANSFER":
                      return <Clock className="h-4 w-4 text-blue-500" />;
                    default:
                      return (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      );
                  }
                };

                return (
                  <div key={log.id} className="p-3 border rounded">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium">{log.event_type}</p>
                      {getEventIcon()}
                    </div>
                    {log.event_data.email && (
                      <p className="text-xs text-muted-foreground">
                        User: {log.event_data.email}
                      </p>
                    )}
                    {log.event_data.transaction_id && (
                      <p className="text-xs text-muted-foreground">
                        Transaction:{" "}
                        {log.event_data.transaction_id.slice(0, 20)}...
                      </p>
                    )}
                    {log.event_data.amount && (
                      <p className="text-xs text-muted-foreground">
                        Amount: ${log.event_data.amount}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Actor: {log.actor_id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getTimeAgo(log.timestamp)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {hasPermission("tenants", "export_audit_logs") && (
          <div className="bg-card border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Compliance Reports</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 border rounded hover:bg-accent cursor-pointer">
                <div>
                  <p className="text-sm font-medium">
                    AML Transaction Monitoring
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Monthly report - January 2024
                  </p>
                </div>
                <Download className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex justify-between items-center p-3 border rounded hover:bg-accent cursor-pointer">
                <div>
                  <p className="text-sm font-medium">KYC Compliance Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Quarterly report - Q4 2023
                  </p>
                </div>
                <Download className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex justify-between items-center p-3 border rounded hover:bg-accent cursor-pointer">
                <div>
                  <p className="text-sm font-medium">Security Audit Log</p>
                  <p className="text-xs text-muted-foreground">
                    Weekly digest - Week 3
                  </p>
                </div>
                <Download className="h-4 w-4 text-blue-500" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* System Activity */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">System Access Log</h3>
        {auditLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : auditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No system access logs found
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Timestamp</th>
                  <th className="text-left py-2 px-3">User</th>
                  <th className="text-left py-2 px-3">Event Type</th>
                  <th className="text-left py-2 px-3">Actor ID</th>
                  <th className="text-left py-2 px-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="border-b hover:bg-accent">
                    <td className="py-2 px-3 text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      {log.event_data.email || "N/A"}
                    </td>
                    <td className="py-2 px-3">{log.event_type}</td>
                    <td className="py-2 px-3 font-mono text-xs">
                      {log.actor_id.slice(0, 8)}...
                    </td>
                    <td className="py-2 px-3">
                      {log.event_data.transaction_id ? (
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          Transaction
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                          {log.event_type}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
