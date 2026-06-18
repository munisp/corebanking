import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { Bell, Clock, Download, Search, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AlertAcknowledgment from "../components/AlertAcknowledgment";
import PageHeader from "../components/PageHeader";
import {
  getAlertColor,
  getAlertIcon,
  type Alert,
} from "../lib/anomalyDetection";
import apiClient from "../services/api";
import { tenantService } from "../services/tenant";

interface ComplianceAlert {
  id: string;
  type?: string;
  severity?: string;
  title: string;
  message: string;
  timestamp?: Date | string;
  metric?: string;
  value?: number;
  threshold?: number;
  status?: string;
  acknowledgedAt?: Date | string;
  acknowledgedBy?: string;
  assignedTo?: string;
  resolvedAt?: Date | string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

interface ComplianceAlertsResponse {
  tenant_id: string;
  alerts: ComplianceAlert[];
  total: number;
}

export default function Alerts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<ComplianceAlert | null>(
    null,
  );
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch compliance alerts for tenant
  useEffect(() => {
    const fetchComplianceAlerts = async (setLoading = true) => {
      if (setLoading) {
        setAlertsLoading(true);
      }
      try {
        const tenantConfig = tenantService.getTenantConfig();
        const tenantId = tenantConfig?.tenant_id || (tenantConfig as any)?.id;

        if (!tenantId) {
          console.warn("Tenant ID not available for fetching alerts");
          if (setLoading) {
            setAlertsLoading(false);
          }
          return;
        }

        const response = await apiClient.get<ComplianceAlertsResponse>(
          `/compliance/api/v1/compliance/alerts/tenant/${tenantId}`,
          { params: { page, limit } },
        );
        const data = response.data;

        // Handle the response structure: { tenant_id, alerts: [], total: 0 }
        const alertsData = Array.isArray(data.alerts) ? data.alerts : [];
        // Convert timestamp strings to Date objects if needed
        const processedAlerts = alertsData.map((alert) => ({
          ...alert,
          timestamp: alert.timestamp ? new Date(alert.timestamp) : new Date(),
        }));
        setAlerts(processedAlerts);
        setAlertsTotal(data.total || 0);
      } catch (error) {
        console.error("Error fetching compliance alerts:", error);
        if (setLoading) {
          setAlerts([]);
          setAlertsTotal(0);
        }
      } finally {
        if (setLoading) {
          setAlertsLoading(false);
        }
      }
    };

    fetchComplianceAlerts(true);
    // Refresh every 30 seconds (silently in background)
    const interval = setInterval(() => fetchComplianceAlerts(false), 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleAcknowledge = (alertId: string, assignedTo: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              status: "acknowledged",
              acknowledgedAt: new Date(),
              acknowledgedBy: "Current User",
              assignedTo,
            }
          : alert,
      ),
    );
  };

  const handleResolve = (alertId: string, notes: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              status: "resolved",
              resolvedAt: new Date(),
              resolvedBy: "Current User",
              resolutionNotes: notes,
            }
          : alert,
      ),
    );
  };

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch =
        alert.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.message?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeverity =
        severityFilter === "all" || alert.severity === severityFilter;
      const matchesType = typeFilter === "all" || alert.type === typeFilter;
      return matchesSearch && matchesSeverity && matchesType;
    });
  }, [alerts, searchTerm, severityFilter, typeFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const last24h = alerts.filter((a) => {
      const timestamp =
        a.timestamp instanceof Date
          ? a.timestamp
          : new Date(a.timestamp || now);
      return now.getTime() - timestamp.getTime() < 24 * 60 * 60 * 1000;
    });
    const last7d = alerts.filter((a) => {
      const timestamp =
        a.timestamp instanceof Date
          ? a.timestamp
          : new Date(a.timestamp || now);
      return now.getTime() - timestamp.getTime() < 7 * 24 * 60 * 60 * 1000;
    });

    const criticalAlerts = alerts.filter((a) => a.severity === "critical");
    // Calculate average resolution time from resolved alerts
    const resolvedAlerts = alerts.filter(
      (a) => a.status === "resolved" && a.resolvedAt && a.acknowledgedAt,
    );
    const avgResolutionTime =
      resolvedAlerts.length > 0
        ? resolvedAlerts.reduce((sum, alert) => {
            const resolved =
              alert.resolvedAt instanceof Date
                ? alert.resolvedAt
                : new Date(alert.resolvedAt || now);
            const acknowledged =
              alert.acknowledgedAt instanceof Date
                ? alert.acknowledgedAt
                : new Date(alert.acknowledgedAt || now);
            return (
              sum + (resolved.getTime() - acknowledged.getTime()) / (1000 * 60)
            ); // minutes
          }, 0) / resolvedAlerts.length
        : 0;

    return {
      total: alertsTotal || alerts.length,
      last24h: last24h.length,
      last7d: last7d.length,
      critical: criticalAlerts.length,
      mttr: Math.round(avgResolutionTime),
    };
  }, [alerts, alertsTotal]);

  // Alert trends data (last 7 days)
  const trendsData = useMemo(() => {
    const days = 7;
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayAlerts = alerts.filter((a) => {
        const timestamp =
          a.timestamp instanceof Date
            ? a.timestamp
            : new Date(a.timestamp || now);
        const alertDate = new Date(timestamp);
        alertDate.setHours(0, 0, 0, 0);
        return alertDate.getTime() === date.getTime();
      });

      data.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        total: dayAlerts.length,
        critical: dayAlerts.filter((a) => a.severity === "critical").length,
        high: dayAlerts.filter((a) => a.severity === "high").length,
        medium: dayAlerts.filter((a) => a.severity === "medium").length,
      });
    }

    return data;
  }, [alerts]);

  // Alert type distribution
  const typeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    alerts.forEach((alert) => {
      const type = alert.type || "threshold";
      distribution[type] = (distribution[type] || 0) + 1;
    });

    return Object.entries(distribution).map(([name, value]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      value,
    }));
  }, [alerts]);

  // Severity distribution
  const severityDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    alerts.forEach((alert) => {
      const severity = alert.severity || "medium";
      distribution[severity] = (distribution[severity] || 0) + 1;
    });

    return [
      { name: "Critical", value: distribution.critical || 0, color: "#ef4444" },
      { name: "High", value: distribution.high || 0, color: "#f59e0b" },
      { name: "Medium", value: distribution.medium || 0, color: "#eab308" },
      { name: "Low", value: distribution.low || 0, color: "#3b82f6" },
    ];
  }, [alerts]);

  const handleExport = (format: "excel" | "pdf") => {
    const data = filteredAlerts.map((alert) => ({
      "Alert ID": alert.id,
      Type: alert.type,
      Severity: alert.severity,
      Title: alert.title,
      Message: alert.message,
      Metric: alert.metric,
      Value: alert.value,
      Threshold: alert.threshold || "N/A",
      Timestamp: alert.timestamp
        ? (alert.timestamp instanceof Date
            ? alert.timestamp
            : new Date(alert.timestamp)
          ).toLocaleString()
        : "N/A",
    }));

    if (format === "excel") {
      exportToExcel(data, "alert-history");
    } else {
      const columns = [
        "Alert ID",
        "Type",
        "Severity",
        "Title",
        "Message",
        "Metric",
        "Value",
        "Threshold",
        "Timestamp",
      ];
      exportToPDF(data, columns, "alert-history", "Alert History Report");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Alert Monitoring"
          title="Alert Analytics"
          description="Monitor alert trends, patterns, and resolution metrics"
          icon={<Bell className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => handleExport("excel")}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Total Alerts
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {stats.total}
                </p>
              </div>
              <Bell className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Last 24 Hours
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {stats.last24h}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Last 7 Days
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {stats.last7d}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Critical Alerts
                </p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {stats.critical}
                </p>
              </div>
              <Bell className="w-12 h-12 text-red-600 opacity-20" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  MTTR (Minutes)
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {stats.mttr}
                </p>
              </div>
              <Clock className="w-12 h-12 text-orange-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alert Trends */}
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <h2 className="text-xl font-bold text-foreground mb-6">
              Alert Trends (Last 7 Days)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="critical"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                />
                <Area
                  type="monotone"
                  dataKey="high"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                />
                <Area
                  type="monotone"
                  dataKey="medium"
                  stackId="1"
                  stroke="#eab308"
                  fill="#eab308"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Severity Distribution */}
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <h2 className="text-xl font-bold text-foreground mb-6">
              Severity Distribution
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={severityDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {severityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Alert Type Distribution */}
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border lg:col-span-2">
            <h2 className="text-xl font-bold text-foreground mb-6">
              Alert Type Distribution
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search alerts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>
            </div>

            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as Alert["severity"] | "all")
              }
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as Alert["type"] | "all")
              }
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            >
              <option value="all">All Types</option>
              <option value="spike">Spike</option>
              <option value="drop">Drop</option>
              <option value="threshold">Threshold</option>
              <option value="unusual_pattern">Unusual Pattern</option>
              <option value="error_rate">Error Rate</option>
            </select>

            <div className="text-sm text-muted-foreground">
              Showing {filteredAlerts.length} of {alertsTotal} alerts
            </div>
          </div>
        </div>

        {/* Alert List */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Alert
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {alertsLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      Loading alerts...
                    </td>
                  </tr>
                ) : filteredAlerts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No alerts found
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => {
                    const timestamp =
                      alert.timestamp instanceof Date
                        ? alert.timestamp
                        : new Date(alert.timestamp || new Date());
                    return (
                      <tr key={alert.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-2">
                            <span className="text-xl mt-0.5">
                              {getAlertIcon(
                                (alert.type || "threshold") as
                                  | "spike"
                                  | "drop"
                                  | "threshold"
                                  | "unusual_pattern"
                                  | "error_rate",
                              )}
                            </span>
                            <div>
                              <p className="font-semibold text-foreground">
                                {alert.title || "Untitled Alert"}
                              </p>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {alert.message || ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getAlertColor((alert.severity || "medium") as "critical" | "high" | "medium" | "low")}`}
                          >
                            {alert.severity || "medium"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground capitalize">
                          {alert.type ? alert.type.replace(/_/g, " ") : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {alert.value ? alert.value.toLocaleString() : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {timestamp.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedAlert(alert)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.max(1, Math.ceil(alertsTotal / limit))} ({alertsTotal} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >Previous</button>
              <button
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                disabled={page >= Math.ceil(alertsTotal / limit)}
                onClick={() => setPage(p => p + 1)}
              >Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Acknowledgment Modal */}
      {selectedAlert && (
        <AlertAcknowledgment
          alert={selectedAlert}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}
