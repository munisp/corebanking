import { useEffect, useState, useCallback } from "react";
import { Activity, Server, Zap, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { monitoringApi } from "@/api/complianceAuditMonitoringApi";
import type { SystemHealthStatus, MonitoringAlert } from "@/api/complianceAuditMonitoringApi";

const REFRESH_MS = 30_000;

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function statusDotClass(status: string): string {
  switch (status) {
    case "healthy":  return "bg-green-500 animate-pulse";
    case "degraded": return "bg-yellow-500 animate-pulse";
    case "down":     return "bg-red-500";
    default:         return "bg-gray-400";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "healthy":  return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "degraded": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "down":     return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:         return "bg-muted text-foreground";
  }
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "warning":  return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "info":     return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    default:         return "bg-muted text-foreground";
  }
}

export default function Monitoring() {
  const [services, setServices] = useState<SystemHealthStatus[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [alertTotal, setAlertTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [health, alertsRes] = await Promise.all([
        monitoringApi.getSystemHealth(),
        monitoringApi.listAlerts({ limit: 20, status: "open" }),
      ]);
      setServices(health.services ?? []);
      setAlerts(alertsRes.alerts ?? []);
      setAlertTotal(alertsRes.total ?? alertsRes.alerts?.length ?? 0);
      setLastRefreshed(new Date());
    } catch {
      // keep existing state on transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

  const healthyCount   = services.filter((s) => s.status === "healthy").length;
  const unhealthyCount = services.filter((s) => s.status === "degraded" || s.status === "down").length;
  const overallOk      = unhealthyCount === 0;
  const overallStatus  = overallOk
    ? "All Systems Operational"
    : `${unhealthyCount} Service${unhealthyCount > 1 ? "s" : ""} Degraded`;

  const avgLatency = services.length > 0
    ? Math.round(services.reduce((sum, s) => sum + (s.latency_ms ?? 0), 0) / services.length)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      {/* Header */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-600" />
                System Monitoring
              </h1>
              <p className="text-muted-foreground mt-1">Real-time platform health and performance metrics</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {lastRefreshed && (
                <span>Updated {formatRelativeTime(lastRefreshed.toISOString())}</span>
              )}
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-foreground"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading monitoring data…
          </div>
        ) : (
          <>
            {/* Overall Status Banner */}
            <div
              className={`bg-gradient-to-r ${
                overallOk ? "from-green-500 to-emerald-500" : "from-yellow-500 to-orange-500"
              } rounded-xl shadow-lg p-6 mb-8 text-white`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="w-8 h-8" />
                    <h2 className="text-2xl font-bold">{overallStatus}</h2>
                  </div>
                  <p className={overallOk ? "text-green-100" : "text-yellow-100"}>
                    {healthyCount} of {services.length} services healthy
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">{services.length}</div>
                  <div className={overallOk ? "text-green-100" : "text-yellow-100"}>Total Services</div>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg w-fit mb-3">
                  <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-foreground">—</div>
                <div className="text-sm text-muted-foreground mt-1">Transactions/sec</div>
              </div>

              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg w-fit mb-3">
                  <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {avgLatency != null ? `${avgLatency}ms` : "—"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Avg Response Time</div>
              </div>

              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg w-fit mb-3">
                  <Server className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-foreground">{healthyCount}</div>
                <div className="text-sm text-muted-foreground mt-1">Healthy Services</div>
              </div>

              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg w-fit mb-3">
                  <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-foreground">{alertTotal}</div>
                <div className="text-sm text-muted-foreground mt-1">Open Alerts</div>
              </div>
            </div>

            {/* Services Grid */}
            {services.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {services.map((svc) => (
                  <div key={svc.name} className="bg-card rounded-xl shadow-lg p-6 border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${statusDotClass(svc.status)}`} />
                        <h3 className="text-lg font-semibold text-foreground">{svc.name}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(svc.status)}`}>
                        {svc.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Latency</div>
                        <div className="text-lg font-semibold text-foreground">
                          {svc.latency_ms != null ? `${svc.latency_ms}ms` : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Error Rate</div>
                        <div className="text-lg font-semibold text-foreground">
                          {svc.error_rate != null ? `${svc.error_rate}%` : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Last Checked</div>
                        <div className="text-sm font-medium text-foreground">
                          {formatRelativeTime(svc.last_check)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Alerts */}
            <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Open Alerts
                {alertTotal > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">({alertTotal})</span>
                )}
              </h3>

              {alerts.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 py-4">
                  <CheckCircle className="w-5 h-5" />
                  <span>No open alerts</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.name} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${severityBadgeClass(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{alert.service}</div>
                        <div className="text-sm text-muted-foreground mt-1">{alert.message}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                          {formatRelativeTime(alert.started_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
