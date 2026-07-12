import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
  Activity,
  Bell,
  Calendar,
  Clock,
  Download,
  Filter,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  // Bar,
  // BarChart,
  CartesianGrid,
  // Cell,
  Legend,
  // Pie,
  // PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import AlertHistory from "../components/AlertHistory";
import AlertPanel from "../components/AlertPanel";
import type { Alert as AnomalyAlert } from "../lib/anomalyDetection";
import { analyzeUsageData } from "../lib/anomalyDetection";
import { sendEmailNotification } from "../lib/emailNotification";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../services/api";
import { deliverAlert } from "../lib/webhookDelivery";

// const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];

export default function UsageAnalytics() {
  const [days, setDays] = useState(7);
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set(),
  );
  const [alertHistory, setAlertHistory] = useState<AnomalyAlert[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch usage data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["usage", "stats", days, selectedTenant],
    queryFn: () =>
      apiClient
        .get("/user/usage/stats", {
          params: {
            days,
            ...(selectedTenant !== "all" && { tenantId: selectedTenant }),
          },
        })
        .then((r) => r.data)
        .catch(() => null),
    refetchInterval: 10000,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["usage", "trends", days, selectedTenant],
    queryFn: () =>
      apiClient
        .get("/user/usage/trends", {
          params: {
            days,
            groupBy: days <= 7 ? "hour" : "day",
            ...(selectedTenant !== "all" && { tenantId: selectedTenant }),
          },
        })
        .then((r) => r.data)
        .catch(() => null),
    refetchInterval: 10000,
  });

  // Tenants are not relevant in a tenant-scoped admin — kept as empty for the filter dropdown
  const tenants = { tenants: [] as any[] };

  const isLoading = statsLoading || trendsLoading;

  // Analyze usage data for anomalies
  useEffect(() => {
    if (!stats || !trends || isLoading) return;

    const detectedAlerts = analyzeUsageData({
      trends: trends.map((t: any) => ({ date: t.date, count: t.count })),
      totalEvents: stats.totalEvents,
      byTenant: stats.byTenant?.map((t: any) => ({
        tenantId: t.tenantId,
        totalEvents: t.totalEvents,
        avgEvents:
          (stats as any).totalEvents / ((stats as any).byTenant?.length || 1), // Simple average
      })),
      errorCount: 0,
    });

    // Filter out dismissed alerts
    const newAlerts = detectedAlerts.filter(
      (alert) => !dismissedAlerts.has(alert.id),
    );

    // Show toast and deliver webhooks for critical alerts
    newAlerts.forEach(async (alert) => {
      if (
        alert.severity === "critical" &&
        !alerts.find((a) => a.id === alert.id)
      ) {
        toast.error(alert.title, {
          description: alert.message,
          duration: 10000,
        });

        // Deliver to configured webhooks
        const alertConfig = localStorage.getItem("alertConfig");
        if (alertConfig) {
          const config = JSON.parse(alertConfig);
          if (config.notifications?.webhook) {
            const webhookConfig = {
              slackWebhookUrl: config.slackWebhookUrl,
              pagerdutyKey: config.pagerdutyKey,
              teamsWebhookUrl: config.teamsWebhookUrl,
              genericWebhookUrl: config.webhookUrl,
            };

            const { success, results } = await deliverAlert(
              alert,
              webhookConfig,
            );
            if (success) {
              console.log("Alert delivered to webhooks:", results);
            } else {
              console.error("Some webhook deliveries failed:", results);
            }
          }

          // Send email notifications if configured
          if (config.notifications?.email && config.emailRecipients) {
            const recipients = config.emailRecipients
              .split(",")
              .map((email: string) => email.trim());
            const emailSent = await sendEmailNotification(alert, recipients);
            if (emailSent) {
              console.log("Email notification sent to:", recipients);
            } else {
              console.error("Failed to send email notification");
            }
          }
        }
      }
    });

    setAlerts(newAlerts);
  }, [stats, trends, isLoading, dismissedAlerts]);

  const handleDismissAlert = (alertId: string) => {
    const dismissedAlert = alerts.find((a) => a.id === alertId);
    if (dismissedAlert) {
      setAlertHistory((prev) => [dismissedAlert, ...prev].slice(0, 50)); // Keep last 50
    }
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    toast.success("Alert dismissed");
  };

  // Transform data for charts
  const apiCallsData =
    trends?.map((trend: any) => ({
      time: new Date(trend.date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: days <= 7 ? "numeric" : undefined,
      }),
      calls: trend.count,
      unique_tenants: trend.uniqueTenants || 0,
    })) || [];

  // const endpointData = stats?.byEndpoint?.slice(0, 10).map((endpoint: any) => ({
  //   endpoint: endpoint.endpoint.split('/').pop() || endpoint.endpoint,
  //   calls: endpoint.count,
  //   percentage: ((endpoint.count / (stats?.totalEvents || 1)) * 100).toFixed(1),
  // })) || [];

  // const eventTypeData = stats?.byEventType?.map((event: any) => ({
  //   name: event.eventType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
  //   value: event.count,
  //   percentage: ((event.count / (stats?.totalEvents || 1)) * 100).toFixed(1),
  // })) || [];

  const tenantActivityData =
    stats?.byTenant?.slice(0, 8).map((tenant: any) => ({
      tenant: tenant.tenantId,
      calls: tenant.totalEvents,
      percentage: (
        (tenant.totalEvents / (stats?.totalEvents || 1)) *
        100
      ).toFixed(1),
    })) || [];

  const handleExportExcel = () => {
    const data = apiCallsData.map((d: any) => ({
      Time: d.time,
      "API Calls": d.calls,
      "Unique Tenants": d.unique_tenants,
    }));
    exportToExcel(data, "usage-analytics");
  };

  const handleExportPDF = () => {
    const data = apiCallsData.map((d: any) => [
      d.time,
      d.calls.toString(),
      d.unique_tenants.toString(),
    ]);
    exportToPDF(
      ["Time", "API Calls", "Unique Tenants"],
      data,
      "usage-analytics-report",
      "Usage Analytics Report",
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background ">
      {/* Header */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-600" />
                Usage Analytics
              </h1>
              <p className="text-muted-foreground mt-1">
                Monitor API call patterns, endpoint usage, and tenant activity
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                disabled={isLoading}
              >
                <Download className="w-5 h-5" />
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                disabled={isLoading}
              >
                <Download className="w-5 h-5" />
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {/* Alert System */}
        {alerts.length > 0 && (
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-6 h-6 text-red-600 animate-pulse" />
              <h2 className="text-xl font-bold text-foreground">
                Active Alerts ({alerts.length})
              </h2>
            </div>
            <AlertPanel alerts={alerts} onDismiss={handleDismissAlert} />

            {/* Alert History Toggle */}
            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-sm font-semibold text-primary hover:underline flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                {showHistory ? "Hide" : "Show"} Alert History (
                {alertHistory.length})
              </button>

              {showHistory && (
                <div className="mt-4">
                  <AlertHistory alerts={alertHistory} />
                </div>
              )}
            </div>
          </div>
        )}
        {/* Filters */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option value={1}>Last 24 Hours</option>
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option value="all">All Tenants</option>
                {tenants?.tenants.map((tenant: any) => (
                  <option key={tenant.id} value={tenant.tenantId}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 w-24 bg-muted rounded mb-2"></div>
                <div className="h-8 w-32 bg-muted rounded mb-2"></div>
                <div className="h-4 w-28 bg-muted rounded"></div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">
                    Total API Calls
                  </div>
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {(stats?.totalEvents || 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Last {days} days
                </div>
              </>
            )}
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 w-24 bg-muted rounded mb-2"></div>
                <div className="h-8 w-32 bg-muted rounded mb-2"></div>
                <div className="h-4 w-28 bg-muted rounded"></div>
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground mb-2">
                  Unique Endpoints
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {stats?.byEndpoint?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Active endpoints
                </div>
              </>
            )}
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 w-24 bg-muted rounded mb-2"></div>
                <div className="h-8 w-32 bg-muted rounded mb-2"></div>
                <div className="h-4 w-28 bg-muted rounded"></div>
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground mb-2">
                  Active Tenants
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {stats?.byTenant?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Making API calls
                </div>
              </>
            )}
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 w-24 bg-muted rounded mb-2"></div>
                <div className="h-8 w-32 bg-muted rounded mb-2"></div>
                <div className="h-4 w-28 bg-muted rounded"></div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">
                    Avg Calls/Day
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {Math.round(
                    (stats?.totalEvents || 0) / days,
                  ).toLocaleString()}
                </div>
                <div className="text-sm text-primary mt-1">
                  +12.5% vs previous
                </div>
              </>
            )}
          </div>
        </div>

        {/* API Calls Trend */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h2 className="text-xl font-bold text-foreground mb-6">
            API Call Patterns
          </h2>
          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <Activity className="w-12 h-12 text-muted-foreground animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={apiCallsData}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTenants" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorCalls)"
                  name="API Calls"
                />
                <Area
                  type="monotone"
                  dataKey="unique_tenants"
                  stroke="#8b5cf6"
                  fillOpacity={1}
                  fill="url(#colorTenants)"
                  name="Unique Tenants"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bottom Row: Endpoint Usage & Event Types */}
        {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> */}
        {/* Top Endpoints */}
        {/* <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <h2 className="text-xl font-bold text-foreground mb-6">Top Endpoints</h2>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center">
                <Activity className="w-12 h-12 text-muted-foreground animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={endpointData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#64748b" />
                  <YAxis dataKey="endpoint" type="category" stroke="#64748b" width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f1f5f9' }}
                    formatter={(value: number | undefined, _name?: string, props?: any) => [
                      value !== undefined && props ? `${value.toLocaleString()} calls (${props.payload.percentage}%)` : '',
                      'Usage'
                    ]}
                  />
                  <Bar dataKey="calls" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div> */}

        {/* Event Type Distribution */}
        {/* <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <h2 className="text-xl font-bold text-foreground mb-6">Event Type Distribution</h2>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center">
                <Activity className="w-12 h-12 text-muted-foreground animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={eventTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => `${props.name}: ${props.percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {eventTypeData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f1f5f9' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div> */}
        {/* </div> */}

        {/* Tenant Activity Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">
              Tenant Activity
            </h2>
          </div>
          {isLoading ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">
                Loading tenant activity...
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Tenant
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      API Calls
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Share
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Activity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenantActivityData.map((tenant: any, index: number) => (
                    <tr
                      key={tenant.tenant}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {tenant.tenant}
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {tenant.calls.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                              style={{ width: `${tenant.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-12">
                            {tenant.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                          Active
                        </span>
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
