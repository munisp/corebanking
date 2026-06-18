import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  DollarSign,
  TrendingUp,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  type AuditLog,
  type BankAccount,
  type CashPosition,
  type DashboardMetrics,
  type ERPConnection,
  erpIntegrationApi,
  type Exception,
  type Invoice,
  type Loan,
  type NotificationConfig,
  type Payment,
  type RetryPolicyConfig,
  type SecurityConfig,
  type SyncConfig,
} from "../../api/erpIntegrationApi";

// Import tab components from existing dashboard
import {
  AccountMappingsTab,
  BankAccountsTab,
  CashPositionTab,
  ConnectionModal,
  ConnectionsTab,
  InvoicesTab,
  LoansTab,
  PaymentsTab,
  ReconciliationTab,
  ReportsTab,
  SyncOperationsTab,
  WebhooksTab,
} from "./ERPIntegrationDashboard";

interface EnterpriseERPDashboardProps {
  tenantId: string;
  customerId: string;
}

type TabType =
  | "overview"
  | "connections"
  | "accounts"
  | "reconciliation"
  | "payments"
  | "invoices"
  | "loans"
  | "cash"
  | "sync"
  | "mappings"
  | "webhooks"
  | "reports"
  | "exceptions"
  | "audit"
  | "settings";

export const EnterpriseERPDashboard: React.FC<EnterpriseERPDashboardProps> = ({
  tenantId,
  customerId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [connections, setConnections] = useState<ERPConnection[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [cashPosition, setCashPosition] = useState<CashPosition | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [metricsPeriod, setMetricsPeriod] = useState<
    "today" | "week" | "month" | "year"
  >("week");
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  // Configuration states
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [retryConfig, setRetryConfig] = useState<RetryPolicyConfig | null>(
    null,
  );
  const [notificationConfig, setNotificationConfig] =
    useState<NotificationConfig | null>(null);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig | null>(
    null,
  );

  const tabs = [
    {
      id: "overview" as const,
      label: "Overview",
      description: "Dashboard metrics and KPIs",
    },
    {
      id: "connections" as const,
      label: "Connections",
      description: "ERP system connections",
    },
    {
      id: "accounts" as const,
      label: "Bank Accounts",
      description: "Connected bank accounts",
    },
    {
      id: "reconciliation" as const,
      label: "Reconciliation",
      description: "Transaction matching",
    },
    {
      id: "payments" as const,
      label: "Payments",
      description: "Payment processing",
    },
    {
      id: "invoices" as const,
      label: "Invoices",
      description: "Invoice management",
    },
    { id: "loans" as const, label: "Loans", description: "Loan tracking" },
    {
      id: "cash" as const,
      label: "Cash Position",
      description: "Liquidity management",
    },
    // {
    //   id: "sync" as const,
    //   label: "Sync Operations",
    //   description: "Data synchronization",
    // },
    {
      id: "mappings" as const,
      label: "Account Mappings",
      description: "ERP-Bank mappings",
    },
    // {
    //   id: "webhooks" as const,
    //   label: "Webhooks",
    //   description: "Event notifications",
    // },
    {
      id: "reports" as const,
      label: "Reports",
      description: "Analytics and reports",
    },
    // {
    //   id: "exceptions" as const,
    //   label: "Exceptions",
    //   description: "Error management",
    // },
    {
      id: "audit" as const,
      label: "Audit Log",
      description: "Activity tracking",
    },
    // {
    //   id: "settings" as const,
    //   label: "Settings",
    //   description: "System configuration",
    // },
  ];

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadConnections(),
        loadDashboardMetrics(),
        loadExceptions(),
      ]);
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  };

  const loadConnections = async () => {
    try {
      const data = await erpIntegrationApi.listConnections(
        tenantId,
        customerId,
      );
      setConnections(data.connections || []);
    } catch (error) {
      console.error("Failed to load connections:", error);
    }
  };

  const loadDashboardMetrics = async () => {
    try {
      const data = await erpIntegrationApi.getDashboardMetrics(
        tenantId,
        customerId,
        metricsPeriod,
      );
      setMetrics(data);
    } catch (error) {
      console.error("Failed to load dashboard metrics:", error);
    }
  };

  const loadExceptions = async () => {
    try {
      const data = await erpIntegrationApi.listExceptions(
        tenantId,
        customerId,
        { status: "open" },
      );
      setExceptions(data.exceptions || []);
    } catch (error) {
      console.error("Failed to load exceptions:", error);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const data = await erpIntegrationApi.getAuditLogs(tenantId, customerId, {
        limit: 100,
      });
      setAuditLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to load audit logs:", error);
    }
  };

  const loadConfigurations = async () => {
    try {
      const [sync, retry, notification, security] = await Promise.all([
        erpIntegrationApi.getSyncConfig(tenantId, customerId),
        erpIntegrationApi.getRetryPolicyConfig(tenantId, customerId),
        erpIntegrationApi.getNotificationConfig(tenantId, customerId),
        erpIntegrationApi.getSecurityConfig(tenantId, customerId),
      ]);
      setSyncConfig(sync);
      setRetryConfig(retry);
      setNotificationConfig(notification);
      setSecurityConfig(security);
    } catch (error) {
      console.error("Failed to load configurations:", error);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const data = await erpIntegrationApi.listBankAccounts(
        tenantId,
        customerId,
      );
      setBankAccounts(data.accounts || []);
    } catch (error) {
      console.error("Failed to load bank accounts:", error);
    }
  };

  const loadPayments = async () => {
    try {
      const data = await erpIntegrationApi.listPayments(tenantId, customerId);
      setPayments(data.payments || []);
    } catch (error) {
      console.error("Failed to load payments:", error);
    }
  };

  const loadInvoices = async () => {
    if (connections.length > 0) {
      try {
        const data = await erpIntegrationApi.listInvoices(
          tenantId,
          customerId,
          connections[0].id,
        );
        setInvoices(data.invoices || []);
      } catch (error) {
        console.error("Failed to load invoices:", error);
      }
    }
  };

  const loadLoans = async () => {
    try {
      const data = await erpIntegrationApi.listLoans(tenantId, customerId);
      setLoans(data.loans || []);
    } catch (error) {
      console.error("Failed to load loans:", error);
    }
  };

  const loadCashPosition = async () => {
    try {
      const data = await erpIntegrationApi.getCashPosition(
        tenantId,
        customerId,
      );
      setCashPosition(data);
    } catch (error) {
      console.error("Failed to load cash position:", error);
    }
  };

  const testConnection = async (id: string) => {
    try {
      await erpIntegrationApi.testConnection(tenantId, customerId, id);
      alert("Connection test successful!");
      loadConnections();
    } catch (error) {
      console.error("Connection test failed:", error);
      alert("Connection test failed");
    }
  };

  const triggerSync = async (id: string) => {
    try {
      await erpIntegrationApi.triggerSync(tenantId, customerId, id, "full");
      alert("Sync triggered successfully!");
    } catch (error) {
      console.error("Sync trigger failed:", error);
      alert("Sync trigger failed");
    }
  };

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === "accounts" && bankAccounts.length === 0) {
      loadBankAccounts();
    } else if (activeTab === "payments" && payments.length === 0) {
      loadPayments();
    } else if (activeTab === "invoices" && invoices.length === 0) {
      loadInvoices();
    } else if (activeTab === "loans" && loans.length === 0) {
      loadLoans();
    } else if (activeTab === "cash" && !cashPosition) {
      loadCashPosition();
    } else if (activeTab === "audit") {
      loadAuditLogs();
    } else if (activeTab === "settings") {
      loadConfigurations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, customerId]);

  useEffect(() => {
    if (activeTab === "overview") {
      loadDashboardMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, metricsPeriod]);

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background p-6">
      {/* Header */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm rounded-xl mb-6">
        <div className="py-6 px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Database className="w-8 h-8 text-primary" />
                Enterprise ERP Integration Platform
              </h1>
              <p className="text-muted-foreground mt-1">
                Advanced banking integration with comprehensive monitoring and
                management
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowConnectionModal(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                Add Connection
              </button>
              <div className="text-right">
                <div className="text-2xl font-bold text-foreground">
                  {connections.filter((c) => c.status === "active").length}/
                  {connections.length}
                </div>
                <div style={{ fontSize: "13px", opacity: 0.9 }}></div>
                <p className="text-sm text-muted-foreground mt-1">
                  Active Connections
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Sync Success Rate"
            value={`${metrics.sync_performance.success_rate.toFixed(1)}%`}
            icon={<CheckCircle2 className="w-6 h-6 text-green-600" />}
            color="green"
          />
          <StatCard
            title="Reconciliation Accuracy"
            value={`${metrics.reconciliation.accuracy_rate.toFixed(1)}%`}
            icon={<Activity className="w-6 h-6 text-blue-600" />}
            color="blue"
          />
          <StatCard
            title="Transaction Volume"
            value={metrics.transaction_volume.total.toLocaleString()}
            trend={metrics.transaction_volume.trend}
            icon={<BarChart3 className="w-6 h-6 text-purple-600" />}
            color="purple"
          />
          <StatCard
            title="Open Exceptions"
            value={exceptions.length}
            icon={
              exceptions.length > 0 ? (
                <AlertCircle className="w-6 h-6 text-red-600" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              )
            }
            color={exceptions.length > 0 ? "red" : "green"}
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "audit") loadAuditLogs();
              if (activeTab === "audit") loadConfigurations();
            }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
            title={tab.description}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <OverviewTab
            metrics={metrics}
            period={metricsPeriod}
            setPeriod={setMetricsPeriod}
            exceptions={exceptions}
            tenantId={tenantId}
            customerId={customerId}
          />
        )}

        {activeTab === "exceptions" && (
          <ExceptionsTab
            exceptions={exceptions}
            tenantId={tenantId}
            customerId={customerId}
            onRefresh={loadExceptions}
          />
        )}

        {activeTab === "audit" && (
          <AuditLogTab
            logs={auditLogs}
            tenantId={tenantId}
            customerId={customerId}
            onRefresh={loadAuditLogs}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            tenantId={tenantId}
            customerId={customerId}
            syncConfig={syncConfig}
            retryConfig={retryConfig}
            notificationConfig={notificationConfig}
            securityConfig={securityConfig}
            onUpdate={loadConfigurations}
          />
        )}

        {activeTab === "connections" && (
          <ConnectionsTab
            connections={connections}
            onRefresh={loadConnections}
            onTest={testConnection}
            onSync={triggerSync}
          />
        )}

        {activeTab === "accounts" && (
          <BankAccountsTab accounts={bankAccounts} />
        )}

        {activeTab === "reconciliation" && (
          <ReconciliationTab
            tenantId={tenantId}
            customerId={customerId}
            connections={connections}
          />
        )}

        {activeTab === "payments" && (
          <PaymentsTab
            payments={payments}
            onNewPayment={() => {}}
            onRefresh={loadPayments}
          />
        )}

        {activeTab === "invoices" && <InvoicesTab invoices={invoices} />}

        {activeTab === "loans" && (
          <LoansTab loans={loans} tenantId={tenantId} customerId={customerId} />
        )}

        {activeTab === "cash" && (
          <CashPositionTab
            position={cashPosition}
            tenantId={tenantId}
            customerId={customerId}
          />
        )}

        {activeTab === "sync" && (
          <SyncOperationsTab
            tenantId={tenantId}
            customerId={customerId}
            connections={connections}
          />
        )}

        {activeTab === "mappings" && (
          <AccountMappingsTab
            tenantId={tenantId}
            customerId={customerId}
            connections={connections}
          />
        )}

        {activeTab === "webhooks" && (
          <WebhooksTab
            tenantId={tenantId}
            customerId={customerId}
            connections={connections}
          />
        )}

        {activeTab === "reports" && (
          <ReportsTab
            tenantId={tenantId}
            customerId={customerId}
            connections={connections}
          />
        )}
      </div>

      {/* Connection Modal */}
      {showConnectionModal && (
        <ConnectionModal
          tenantId={tenantId}
          customerId={customerId}
          onClose={() => setShowConnectionModal(false)}
          onCreated={() => {
            setShowConnectionModal(false);
            loadConnections();
          }}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: number;
}> = ({ title, value, icon, color, trend }) => {
  const colorClasses = {
    green: "bg-green-100 dark:bg-green-900/30",
    blue: "bg-primary/10 dark:bg-primary/20",
    purple: "bg-purple-100 dark:bg-purple-900/30",
    red: "bg-red-100 dark:bg-red-900/30",
    yellow: "bg-yellow-100 dark:bg-yellow-900/30",
  };

  return (
    <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`p-3 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue} rounded-lg`}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <span
            className={`text-sm font-semibold ${trend >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{title}</div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  metrics: DashboardMetrics | null;
  period: "today" | "week" | "month" | "year";
  setPeriod: (period: "today" | "week" | "month" | "year") => void;
  exceptions: Exception[];
  tenantId: string;
  customerId: string;
}> = ({ metrics, period, setPeriod, exceptions }) => {
  if (!metrics) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        Loading metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {(["today", "week", "month", "year"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Volume */}
        <MetricPanel
          title="Transaction Volume"
          icon={<BarChart3 className="w-5 h-5" />}
        >
          <div className="text-3xl font-bold text-purple-600 mb-4">
            {metrics.transaction_volume.total.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="font-semibold mb-2">By Type:</div>
            {Object.entries(metrics.transaction_volume.by_type).map(
              ([type, count]) => (
                <div key={type}>
                  • {type}: {count.toLocaleString()}
                </div>
              ),
            )}
          </div>
        </MetricPanel>

        {/* Sync Performance */}
        <MetricPanel
          title="Sync Performance"
          icon={<Activity className="w-5 h-5" />}
        >
          <div className="mb-3">
            <div className="text-2xl font-bold text-green-600">
              {metrics.sync_performance.success_rate.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Successful:{" "}
              {metrics.sync_performance.successful_syncs}
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" /> Failed:{" "}
              {metrics.sync_performance.failed_syncs}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Avg Duration:{" "}
              {metrics.sync_performance.avg_duration_seconds}s
            </div>
          </div>
        </MetricPanel>

        {/* Reconciliation Stats */}
        <MetricPanel
          title="Reconciliation"
          icon={<TrendingUp className="w-5 h-5" />}
        >
          <div className="mb-3">
            <div className="text-2xl font-bold text-primary">
              {metrics.reconciliation.accuracy_rate.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Accuracy Rate</div>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Matched:{" "}
              {metrics.reconciliation.matched.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" /> Unmatched:{" "}
              {metrics.reconciliation.unmatched.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" /> Exceptions:{" "}
              {metrics.reconciliation.exceptions}
            </div>
          </div>
        </MetricPanel>

        {/* Payment Summary */}
        <MetricPanel title="Payments" icon={<DollarSign className="w-5 h-5" />}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#059669",
              marginBottom: "10px",
            }}
          >
            ₦{metrics.payments.total_amount.toLocaleString()}
          </div>
          <div style={{ fontSize: "14px", color: "#6b7280" }}>
            <div>Pending: {metrics.payments.pending}</div>
            <div>Completed: {metrics.payments.completed}</div>
            <div>Failed: {metrics.payments.failed}</div>
          </div>
        </MetricPanel>

        {/* System Health */}
        <MetricPanel
          title="System Health"
          icon={<Activity className="w-5 h-5" />}
        >
          <div style={{ marginBottom: "15px" }}>
            <div
              style={{ fontSize: "24px", fontWeight: 700, color: "#f59e0b" }}
            >
              {metrics.system_health.api_response_time_ms}ms
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280" }}>
              API Response Time
            </div>
          </div>
          <div style={{ fontSize: "14px", color: "#6b7280" }}>
            <div>
              Active: {metrics.system_health.active_connections}/
              {metrics.system_health.total_connections}
            </div>
            <div>
              Error Rate: {metrics.system_health.error_rate.toFixed(2)}%
            </div>
          </div>
        </MetricPanel>

        {/* Recent Exceptions */}
        {/* <MetricPanel
          title="Recent Exceptions"
          icon={<AlertCircle className="w-5 h-5" />}
        >
          {exceptions.length === 0 ? (
            <div style={{ color: "#10b981", fontSize: "16px" }}>
              ✨ No open exceptions!
            </div>
          ) : (
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {exceptions.slice(0, 5).map((ex) => (
                <div
                  key={ex.id}
                  style={{
                    padding: "8px",
                    marginBottom: "8px",
                    background: "#fef2f2",
                    borderLeft: "3px solid #ef4444",
                    borderRadius: "4px",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#991b1b" }}>
                    {ex.title}
                  </div>
                  <div style={{ color: "#6b7280", marginTop: "2px" }}>
                    {ex.severity} • {ex.type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </MetricPanel> */}
      </div>
    </div>
  );
};

const MetricPanel: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
    <div className="flex items-center gap-3 mb-4">
      <div className="text-primary">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    </div>
    {children}
  </div>
);

// Exceptions Tab
const ExceptionsTab: React.FC<{
  exceptions: Exception[];
  tenantId: string;
  customerId: string;
  onRefresh: () => void;
}> = ({ exceptions, tenantId, customerId, onRefresh }) => {
  const [filter, setFilter] = useState<{
    severity?: string;
    type?: string;
    status?: string;
  }>({});

  const updateException = async (
    exceptionId: string,
    updates: Partial<Exception>,
  ) => {
    try {
      await erpIntegrationApi.updateException(
        tenantId,
        customerId,
        exceptionId,
        updates,
      );
      alert("Exception updated successfully!");
      onRefresh();
    } catch (error) {
      console.error("Failed to update exception:", error);
      alert("Failed to update exception");
    }
  };

  const filteredExceptions = exceptions.filter((ex) => {
    if (filter.severity && ex.severity !== filter.severity) return false;
    if (filter.type && ex.type !== filter.type) return false;
    if (filter.status && ex.status !== filter.status) return false;
    return true;
  });

  return (
    <div>
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <select
          value={filter.severity || ""}
          onChange={(e) =>
            setFilter({ ...filter, severity: e.target.value || undefined })
          }
          style={{
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
          }}
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filter.status || ""}
          onChange={(e) =>
            setFilter({ ...filter, status: e.target.value || undefined })
          }
          style={{
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
          }}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
        </select>

        <button
          onClick={onRefresh}
          style={{
            padding: "8px 16px",
            backgroundColor: "#059669",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Severity
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Title
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Type
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Created
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredExceptions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  No exceptions found
                </td>
              </tr>
            ) : (
              filteredExceptions.map((ex) => (
                <tr key={ex.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor:
                          ex.severity === "critical"
                            ? "#fef2f2"
                            : ex.severity === "high"
                              ? "#fff7ed"
                              : ex.severity === "medium"
                                ? "#fffbeb"
                                : "#f0fdf4",
                        color:
                          ex.severity === "critical"
                            ? "#991b1b"
                            : ex.severity === "high"
                              ? "#9a3412"
                              : ex.severity === "medium"
                                ? "#92400e"
                                : "#166534",
                      }}
                    >
                      {ex.severity.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "12px", fontWeight: 500 }}>
                    {ex.title}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontSize: "14px",
                      color: "#6b7280",
                    }}
                  >
                    {ex.type}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        backgroundColor:
                          ex.status === "resolved" ? "#d1fae5" : "#fef3c7",
                        color: ex.status === "resolved" ? "#065f46" : "#92400e",
                      }}
                    >
                      {ex.status}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontSize: "14px",
                      color: "#6b7280",
                    }}
                  >
                    {new Date(ex.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {ex.status === "open" && (
                      <button
                        onClick={() =>
                          updateException(ex.id, { status: "investigating" })
                        }
                        style={{
                          padding: "4px 12px",
                          backgroundColor: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                          marginRight: "5px",
                        }}
                      >
                        Investigate
                      </button>
                    )}
                    {ex.status === "investigating" && (
                      <button
                        onClick={() =>
                          updateException(ex.id, { status: "resolved" })
                        }
                        style={{
                          padding: "4px 12px",
                          backgroundColor: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Audit Log Tab
const AuditLogTab: React.FC<{
  logs: AuditLog[];
  tenantId: string;
  customerId: string;
  onRefresh: () => void;
}> = ({ logs, onRefresh }) => {
  return (
    <div>
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0 }}>Audit Log</h2>
        <button
          onClick={onRefresh}
          style={{
            padding: "8px 16px",
            backgroundColor: "#059669",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Timestamp
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                User
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Action
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Resource
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                IP Address
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px", fontSize: "14px" }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "12px", fontSize: "14px" }}>
                    {log.user_email}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    {log.action}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontSize: "14px",
                      color: "#6b7280",
                    }}
                  >
                    {log.resource_type}
                    {log.resource_id && (
                      <span> #{log.resource_id.slice(0, 8)}</span>
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        backgroundColor:
                          log.status === "success" ? "#d1fae5" : "#fee2e2",
                        color: log.status === "success" ? "#065f46" : "#991b1b",
                      }}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontSize: "14px",
                      color: "#6b7280",
                      fontFamily: "monospace",
                    }}
                  >
                    {log.ip_address || "N/A"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Settings Tab
const SettingsTab: React.FC<{
  tenantId: string;
  customerId: string;
  syncConfig: SyncConfig | null;
  retryConfig: RetryPolicyConfig | null;
  notificationConfig: NotificationConfig | null;
  securityConfig: SecurityConfig | null;
  onUpdate: () => void;
}> = ({
  tenantId,
  customerId,
  syncConfig,
  retryConfig,
  notificationConfig,
  securityConfig,
  onUpdate,
}) => {
  const [activeSection, setActiveSection] = useState<
    "sync" | "retry" | "notifications" | "security"
  >("sync");
  const [editingSyncConfig, setEditingSyncConfig] = useState<
    Partial<SyncConfig>
  >({});
  const [editingRetryConfig, setEditingRetryConfig] = useState<
    Partial<RetryPolicyConfig>
  >({});
  const [editingNotificationConfig, setEditingNotificationConfig] = useState<
    Partial<NotificationConfig>
  >({});
  const [editingSecurityConfig, setEditingSecurityConfig] = useState<
    Partial<SecurityConfig>
  >({});

  useEffect(() => {
    // Intentionally setting editing state from loaded config
    if (syncConfig) setEditingSyncConfig(syncConfig);
    if (retryConfig) setEditingRetryConfig(retryConfig);
    if (notificationConfig) setEditingNotificationConfig(notificationConfig);
    if (securityConfig) setEditingSecurityConfig(securityConfig);
  }, [syncConfig, retryConfig, notificationConfig, securityConfig]);

  const saveSyncConfig = async () => {
    try {
      await erpIntegrationApi.updateSyncConfig(
        tenantId,
        customerId,
        editingSyncConfig,
      );
      alert("Sync configuration saved successfully!");
      onUpdate();
    } catch (error) {
      console.error("Failed to save sync config:", error);
      alert("Failed to save sync configuration");
    }
  };

  const saveRetryConfig = async () => {
    try {
      await erpIntegrationApi.updateRetryPolicyConfig(
        tenantId,
        customerId,
        editingRetryConfig,
      );
      alert("Retry policy saved successfully!");
      onUpdate();
    } catch (error) {
      console.error("Failed to save retry config:", error);
      alert("Failed to save retry policy");
    }
  };

  const saveNotificationConfig = async () => {
    try {
      await erpIntegrationApi.updateNotificationConfig(
        tenantId,
        customerId,
        editingNotificationConfig,
      );
      alert("Notification settings saved successfully!");
      onUpdate();
    } catch (error) {
      console.error("Failed to save notification config:", error);
      alert("Failed to save notification settings");
    }
  };

  const saveSecurityConfig = async () => {
    try {
      await erpIntegrationApi.updateSecurityConfig(
        tenantId,
        customerId,
        editingSecurityConfig,
      );
      alert("Security settings saved successfully!");
      onUpdate();
    } catch (error) {
      console.error("Failed to save security config:", error);
      alert("Failed to save security settings");
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>System Configuration</h2>

      {/* Section Navigation */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveSection("sync")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeSection === "sync" ? "#2563eb" : "#f3f4f6",
            color: activeSection === "sync" ? "white" : "#374151",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Sync Settings
        </button>
        <button
          onClick={() => setActiveSection("retry")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeSection === "retry" ? "#2563eb" : "#f3f4f6",
            color: activeSection === "retry" ? "white" : "#374151",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Retry Policy
        </button>
        <button
          onClick={() => setActiveSection("notifications")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeSection === "notifications" ? "#2563eb" : "#f3f4f6",
            color: activeSection === "notifications" ? "white" : "#374151",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Notifications
        </button>
        <button
          onClick={() => setActiveSection("security")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeSection === "security" ? "#2563eb" : "#f3f4f6",
            color: activeSection === "security" ? "white" : "#374151",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Security
        </button>
      </div>

      {/* Sync Settings */}
      {activeSection === "sync" && (
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3>Synchronization Settings</h3>
          <div style={{ display: "grid", gap: "15px", marginTop: "20px" }}>
            <label>
              <input
                type="checkbox"
                checked={editingSyncConfig.auto_sync_enabled || false}
                onChange={(e) =>
                  setEditingSyncConfig({
                    ...editingSyncConfig,
                    auto_sync_enabled: e.target.checked,
                  })
                }
              />
              <span style={{ marginLeft: "8px" }}>
                Enable Automatic Synchronization
              </span>
            </label>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Sync Frequency
              </label>
              <select
                value={editingSyncConfig.sync_frequency || "hourly"}
                onChange={(e) =>
                  setEditingSyncConfig({
                    ...editingSyncConfig,
                    sync_frequency: e.target.value as
                      | "realtime"
                      | "5min"
                      | "15min"
                      | "30min"
                      | "hourly"
                      | "daily",
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              >
                <option value="realtime">Real-time</option>
                <option value="5min">Every 5 minutes</option>
                <option value="15min">Every 15 minutes</option>
                <option value="30min">Every 30 minutes</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Batch Size
              </label>
              <input
                type="number"
                value={editingSyncConfig.batch_size || 100}
                onChange={(e) =>
                  setEditingSyncConfig({
                    ...editingSyncConfig,
                    batch_size: parseInt(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Parallel Connections
              </label>
              <input
                type="number"
                value={editingSyncConfig.parallel_connections || 3}
                onChange={(e) =>
                  setEditingSyncConfig({
                    ...editingSyncConfig,
                    parallel_connections: parseInt(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Timeout (seconds)
              </label>
              <input
                type="number"
                value={editingSyncConfig.timeout_seconds || 30}
                onChange={(e) =>
                  setEditingSyncConfig({
                    ...editingSyncConfig,
                    timeout_seconds: parseInt(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <button
              onClick={saveSyncConfig}
              style={{
                padding: "12px 24px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                marginTop: "10px",
              }}
            >
              Save Sync Settings
            </button>
          </div>
        </div>
      )}

      {/* Retry Policy */}
      {activeSection === "retry" && (
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3>Retry Policy Configuration</h3>
          <div style={{ display: "grid", gap: "15px", marginTop: "20px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Maximum Retries
              </label>
              <input
                type="number"
                value={editingRetryConfig.max_retries || 3}
                onChange={(e) =>
                  setEditingRetryConfig({
                    ...editingRetryConfig,
                    max_retries: parseInt(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Initial Delay (seconds)
              </label>
              <input
                type="number"
                value={editingRetryConfig.initial_delay_seconds || 1}
                onChange={(e) =>
                  setEditingRetryConfig({
                    ...editingRetryConfig,
                    initial_delay_seconds: parseInt(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Maximum Delay (seconds)
              </label>
              <input
                type="number"
                value={editingRetryConfig.max_delay_seconds || 60}
                onChange={(e) =>
                  setEditingRetryConfig({
                    ...editingRetryConfig,
                    max_delay_seconds: parseInt(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Backoff Multiplier
              </label>
              <input
                type="number"
                step="0.1"
                value={editingRetryConfig.backoff_multiplier || 2.0}
                onChange={(e) =>
                  setEditingRetryConfig({
                    ...editingRetryConfig,
                    backoff_multiplier: parseFloat(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <button
              onClick={saveRetryConfig}
              style={{
                padding: "12px 24px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                marginTop: "10px",
              }}
            >
              Save Retry Policy
            </button>
          </div>
        </div>
      )}

      {/* Notification Settings */}
      {activeSection === "notifications" && (
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3>Notification Settings</h3>
          <div style={{ display: "grid", gap: "15px", marginTop: "20px" }}>
            <label>
              <input
                type="checkbox"
                checked={
                  editingNotificationConfig.email_notifications_enabled || false
                }
                onChange={(e) =>
                  setEditingNotificationConfig({
                    ...editingNotificationConfig,
                    email_notifications_enabled: e.target.checked,
                  })
                }
              />
              <span style={{ marginLeft: "8px" }}>
                Enable Email Notifications
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                checked={
                  editingNotificationConfig.notify_on_sync_failure || false
                }
                onChange={(e) =>
                  setEditingNotificationConfig({
                    ...editingNotificationConfig,
                    notify_on_sync_failure: e.target.checked,
                  })
                }
              />
              <span style={{ marginLeft: "8px" }}>Notify on Sync Failures</span>
            </label>

            <label>
              <input
                type="checkbox"
                checked={
                  editingNotificationConfig.notify_on_reconciliation_mismatch ||
                  false
                }
                onChange={(e) =>
                  setEditingNotificationConfig({
                    ...editingNotificationConfig,
                    notify_on_reconciliation_mismatch: e.target.checked,
                  })
                }
              />
              <span style={{ marginLeft: "8px" }}>
                Notify on Reconciliation Mismatches
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                checked={
                  editingNotificationConfig.notify_on_payment_failure || false
                }
                onChange={(e) =>
                  setEditingNotificationConfig({
                    ...editingNotificationConfig,
                    notify_on_payment_failure: e.target.checked,
                  })
                }
              />
              <span style={{ marginLeft: "8px" }}>
                Notify on Payment Failures
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                checked={
                  editingNotificationConfig.notify_on_high_value_transactions ||
                  false
                }
                onChange={(e) =>
                  setEditingNotificationConfig({
                    ...editingNotificationConfig,
                    notify_on_high_value_transactions: e.target.checked,
                  })
                }
              />
              <span style={{ marginLeft: "8px" }}>
                Notify on High-Value Transactions
              </span>
            </label>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                High-Value Threshold ($)
              </label>
              <input
                type="number"
                value={editingNotificationConfig.high_value_threshold || 10000}
                onChange={(e) =>
                  setEditingNotificationConfig({
                    ...editingNotificationConfig,
                    high_value_threshold: parseInt(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <button
              onClick={saveNotificationConfig}
              style={{
                padding: "12px 24px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                marginTop: "10px",
              }}
            >
              Save Notification Settings
            </button>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeSection === "security" && (
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3>Security Configuration</h3>
          <div style={{ display: "grid", gap: "15px", marginTop: "20px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Require Approval for Payments Above ($)
              </label>
              <input
                type="number"
                value={
                  editingSecurityConfig.require_approval_for_payments_above ||
                  5000
                }
                onChange={(e) =>
                  setEditingSecurityConfig({
                    ...editingSecurityConfig,
                    require_approval_for_payments_above: parseInt(
                      e.target.value,
                    ),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <label>
              <input
                type="checkbox"
                checked={
                  editingSecurityConfig.require_approval_for_config_changes ||
                  false
                }
                onChange={(e) =>
                  setEditingSecurityConfig({
                    ...editingSecurityConfig,
                    require_approval_for_config_changes: e.target.checked,
                  })
                }
              />
              <span style={{ marginLeft: "8px" }}>
                Require Approval for Configuration Changes
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                checked={editingSecurityConfig.mfa_required || false}
                onChange={(e) =>
                  setEditingSecurityConfig({
                    ...editingSecurityConfig,
                    mfa_required: e.target.checked,
                  })
                }
              />
              <span style={{ marginLeft: "8px" }}>
                Require Multi-Factor Authentication
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                checked={editingSecurityConfig.encryption_enabled || false}
                onChange={(e) =>
                  setEditingSecurityConfig({
                    ...editingSecurityConfig,
                    encryption_enabled: e.target.checked,
                  })
                }
              />
              <span style={{ marginLeft: "8px" }}>Enable Data Encryption</span>
            </label>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                value={editingSecurityConfig.session_timeout_minutes || 30}
                onChange={(e) =>
                  setEditingSecurityConfig({
                    ...editingSecurityConfig,
                    session_timeout_minutes: parseInt(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: 500,
                }}
              >
                Audit Log Retention (days)
              </label>
              <input
                type="number"
                value={editingSecurityConfig.audit_log_retention_days || 90}
                onChange={(e) =>
                  setEditingSecurityConfig({
                    ...editingSecurityConfig,
                    audit_log_retention_days: parseInt(e.target.value),
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  width: "200px",
                }}
              />
            </div>

            <button
              onClick={saveSecurityConfig}
              style={{
                padding: "12px 24px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                marginTop: "10px",
              }}
            >
              Save Security Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseERPDashboard;
