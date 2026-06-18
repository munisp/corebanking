import React, { useEffect, useState } from "react";
import {
  erpIntegrationApi,
  type BankAccount,
  type CashPosition,
  type ERPConnection,
  type ERPProvider,
  type Invoice,
  type Loan,
  type Payment,
} from "../../api/erpIntegrationApi";

interface ERPIntegrationDashboardProps {
  tenantId: string;
  customerId: string;
}

type TabType =
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
  | "reports";

export const ERPIntegrationDashboard: React.FC<
  ERPIntegrationDashboardProps
> = ({ tenantId, customerId }) => {
  const [activeTab, setActiveTab] = useState<TabType>("connections");
  const [connections, setConnections] = useState<ERPConnection[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [cashPosition, setCashPosition] = useState<CashPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const loadConnections = async () => {
    setLoading(true);
    try {
      console.log("Loading ERP connections for:", { tenantId, customerId });
      const data = await erpIntegrationApi.listConnections(
        tenantId,
        customerId,
      );
      console.log("ERP connections response:", data);
      setConnections(data.connections || []);
      if (!data.connections || data.connections.length === 0) {
        console.warn("No ERP connections found");
      }
    } catch (error) {
      console.error("Failed to load connections:", error);
      alert("Failed to load ERP connections. Check console for details.");
    }
    setLoading(false);
  };

  const loadBankAccounts = async () => {
    try {
      console.log("Loading bank accounts for:", { tenantId, customerId });
      const data = await erpIntegrationApi.listBankAccounts(
        tenantId,
        customerId,
      );
      console.log("Bank accounts response:", data);
      setBankAccounts(data.accounts || []);
    } catch (error) {
      console.error("Failed to load bank accounts:", error);
    }
  };

  const loadPayments = async () => {
    try {
      console.log("Loading payments for:", { tenantId, customerId });
      const data = await erpIntegrationApi.listPayments(tenantId, customerId);
      console.log("Payments response:", data);
      setPayments(data.payments || []);
    } catch (error) {
      console.error("Failed to load payments:", error);
    }
  };

  const loadInvoices = async () => {
    if (connections.length > 0) {
      try {
        console.log("Loading invoices for connection:", connections[0].id);
        const data = await erpIntegrationApi.listInvoices(
          tenantId,
          customerId,
          connections[0].id,
        );
        console.log("Invoices response:", data);
        setInvoices(data.invoices || []);
      } catch (error) {
        console.error("Failed to load invoices:", error);
      }
    } else {
      console.warn("Cannot load invoices: No ERP connection available");
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
      console.log("Loading cash position for:", { tenantId, customerId });
      const data = await erpIntegrationApi.getCashPosition(
        tenantId,
        customerId,
      );
      console.log("Cash position response:", data);
      setCashPosition(data);
    } catch (error) {
      console.error("Failed to load cash position:", error);
    }
  };

  const testConnection = async (connectionId: string) => {
    try {
      const result = await erpIntegrationApi.testConnection(
        tenantId,
        customerId,
        connectionId,
      );
      alert(
        result.success
          ? "Connection successful!"
          : `Connection failed: ${result.error}`,
      );
      loadConnections();
    } catch (error) {
      alert("Connection test failed");
    }
  };

  const triggerSync = async (connectionId: string) => {
    try {
      await erpIntegrationApi.triggerSync(
        tenantId,
        customerId,
        connectionId,
        "full",
      );
      alert("Sync started successfully");
    } catch (error) {
      alert("Failed to start sync");
    }
  };

  useEffect(() => {
    loadConnections();
    loadBankAccounts();
    loadCashPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, customerId]);

  useEffect(() => {
    if (activeTab === "payments") loadPayments();
    if (activeTab === "invoices") loadInvoices();
    if (activeTab === "loans") loadLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, connections]);

  const tabs: { id: TabType; label: string }[] = [
    { id: "connections", label: "ERP Connections" },
    { id: "accounts", label: "Bank Accounts" },
    { id: "reconciliation", label: "Reconciliation" },
    { id: "payments", label: "Payments" },
    { id: "invoices", label: "Invoices" },
    { id: "loans", label: "Loans" },
    { id: "cash", label: "Cash Position" },
    // { id: "sync", label: "Sync Operations" },
    { id: "mappings", label: "Account Mappings" },
    { id: "webhooks", label: "Webhooks" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      {/* Admin Info Banner */}
      <div
        style={{
          padding: "15px 20px",
          backgroundColor: "#eff6ff",
          borderLeft: "4px solid #2563eb",
          borderRadius: "6px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>ℹ️</span>
          <div>
            <h3
              style={{
                margin: "0 0 5px 0",
                fontSize: "14px",
                fontWeight: 600,
                color: "#1e40af",
              }}
            >
              Admin View: ERP Integration Management
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#3b82f6" }}>
              Full access to manage ERP integrations: Create and configure
              connections, manage bank accounts, initiate payments, test
              connections, trigger syncs, and monitor reconciliation status.
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600 }}>
            ERP Integration
          </h1>
          <p
            style={{ margin: "5px 0 0 0", color: "#6b7280", fontSize: "14px" }}
          >
            Manage ERP connections, payments, invoices, and reconciliations
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowConnectionModal(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            + Add Connection
          </button>
          <button
            onClick={loadConnections}
            style={{
              padding: "10px 20px",
              backgroundColor: "#059669",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            🔄 Refresh All Data
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "10px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px",
              backgroundColor: activeTab === tab.id ? "#2563eb" : "transparent",
              color: activeTab === tab.id ? "white" : "#374151",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px" }}>Loading...</div>
      )}

      {!loading && activeTab === "connections" && (
        <ConnectionsTab
          connections={connections}
          onTest={testConnection}
          onSync={triggerSync}
          onRefresh={loadConnections}
        />
      )}

      {!loading && activeTab === "accounts" && (
        <BankAccountsTab accounts={bankAccounts} />
      )}

      {!loading && activeTab === "reconciliation" && (
        <ReconciliationTab
          tenantId={tenantId}
          customerId={customerId}
          connections={connections}
        />
      )}

      {!loading && activeTab === "payments" && (
        <PaymentsTab
          payments={payments}
          onNewPayment={() => setShowPaymentModal(true)}
          onRefresh={loadPayments}
        />
      )}

      {!loading && activeTab === "invoices" && (
        <InvoicesTab invoices={invoices} />
      )}

      {!loading && activeTab === "loans" && (
        <LoansTab loans={loans} tenantId={tenantId} customerId={customerId} />
      )}

      {!loading && activeTab === "cash" && (
        <CashPositionTab
          position={cashPosition}
          tenantId={tenantId}
          customerId={customerId}
        />
      )}

      {!loading && activeTab === "sync" && (
        <SyncOperationsTab
          tenantId={tenantId}
          customerId={customerId}
          connections={connections}
        />
      )}

      {!loading && activeTab === "mappings" && (
        <AccountMappingsTab
          tenantId={tenantId}
          customerId={customerId}
          connections={connections}
        />
      )}

      {!loading && activeTab === "webhooks" && (
        <WebhooksTab
          tenantId={tenantId}
          customerId={customerId}
          connections={connections}
        />
      )}

      {!loading && activeTab === "reports" && (
        <ReportsTab
          tenantId={tenantId}
          customerId={customerId}
          connections={connections}
        />
      )}

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

      {showPaymentModal && (
        <PaymentModal
          tenantId={tenantId}
          customerId={customerId}
          connections={connections}
          bankAccounts={bankAccounts}
          onClose={() => setShowPaymentModal(false)}
          onCreated={() => {
            setShowPaymentModal(false);
            loadPayments();
          }}
        />
      )}
    </div>
  );
};

const ConnectionsTab: React.FC<{
  connections: ERPConnection[];
  onTest: (id: string) => void;
  onSync: (id: string) => void;
  onRefresh: () => void;
}> = ({ connections, onTest, onSync, onRefresh }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#10b981";
      case "error":
        return "#ef4444";
      case "pending":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "15px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>ERP Connections</h2>
        <button
          onClick={onRefresh}
          style={{
            padding: "6px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {connections.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#6b7280" }}>
            No ERP connections configured yet. Click "Add Connection" to create
            your first ERP integration.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "15px" }}>
          {connections.map((conn) => (
            <div
              key={conn.id}
              style={{
                padding: "20px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                backgroundColor: "white",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "5px",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "16px" }}>
                      {conn.name || conn.connection_name || "Unnamed Connection"}
                    </h3>
                    <span
                      style={{
                        padding: "2px 8px",
                        backgroundColor: getStatusColor(conn.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      {conn.status}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      color: "#6b7280",
                      fontSize: "14px",
                    }}
                  >
                    🌐 {conn.base_url || conn.credentials?.base_url || "No URL configured"}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto auto auto",
                      gap: "15px",
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500 }}>Provider:</span>{" "}
                      <span
                        style={{ textTransform: "uppercase", color: "#374151" }}
                      >
                        {conn.erp_type || conn.provider || "unknown"}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontWeight: 500 }}>Sync:</span>{" "}
                      <span style={{ color: "#374151" }}>
                        {conn.sync_frequency || conn.sync_settings?.sync_frequency || "manual"}
                      </span>
                    </div>
                    {(conn.last_sync_at || conn.sync_settings?.last_sync_at) && (
                      <div>
                        <span style={{ fontWeight: 500 }}>Last sync:</span>{" "}
                        <span style={{ color: "#059669" }}>
                          {new Date(
                            conn.last_sync_at || conn.sync_settings!.last_sync_at!,
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => onTest(conn.id)}
                    style={{
                      padding: "6px 12px",
                      border: "1px solid #059669",
                      backgroundColor: "#ecfdf5",
                      color: "#059669",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                    title="Test connection health"
                  >
                    🔍 Test Connection
                  </button>
                  <button
                    onClick={() => onSync(conn.id)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                    title="Trigger manual sync"
                  >
                    🔄 Sync Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BankAccountsTab: React.FC<{ accounts: BankAccount[] }> = ({
  accounts,
}) => {
  const formatCurrency = (amount: number, currency: string) => {
    const validCurrency = currency && currency.trim() !== "" ? currency : "NGN";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: validCurrency,
    }).format(amount);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>Bank Accounts</h2>
      <div
        style={{
          display: "grid",
          gap: "15px",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        }}
      >
        {accounts.map((account) => (
          <div
            key={account.id}
            style={{
              padding: "20px",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              backgroundColor: "white",
            }}
          >
            <h3 style={{ margin: "0 0 5px 0", fontSize: "16px" }}>
              {account.account_name}
            </h3>
            <p
              style={{
                margin: "0 0 10px 0",
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              {account.institution_name || "Bank"} - {account.account_number}
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "5px",
              }}
            >
              <span style={{ color: "#6b7280" }}>Balance:</span>
              <span style={{ fontWeight: 600 }}>
                {formatCurrency(account.balance, account.currency)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>Available:</span>
              <span style={{ fontWeight: 600, color: "#10b981" }}>
                {formatCurrency(account.available_balance, account.currency)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReconciliationTab: React.FC<{
  tenantId: string;
  customerId: string;
  connections: ERPConnection[];
}> = ({ tenantId, customerId, connections }) => {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    if (connections.length > 0) {
      loadReconciliationStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  const loadReconciliationStatus = async () => {
    if (connections.length === 0) return;

    try {
      console.log(
        "Loading reconciliation status for connection:",
        connections[0].id,
      );
      const data = await erpIntegrationApi.getReconciliationStatus(
        tenantId,
        customerId,
        connections[0].id,
      );
      console.log("Reconciliation status response:", data);
      setStatus(data);
    } catch (error) {
      console.error("Failed to load reconciliation status:", error);
    }
  };

  const runAutoReconcile = async () => {
    if (connections.length === 0) {
      alert("No ERP connection configured");
      return;
    }

    try {
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 1);
      await erpIntegrationApi.autoReconcile(tenantId, customerId, {
        connection_id: connections[0].id,
        account_id: "ACC001",
        start_date: fromDate.toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
      });
      alert("Auto-reconciliation completed");
      loadReconciliationStatus();
    } catch (error) {
      alert("Auto-reconciliation failed");
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "15px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>Bank Reconciliation</h2>
        <button
          onClick={runAutoReconcile}
          style={{
            padding: "8px 16px",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Auto-Reconcile
        </button>
      </div>

      {status && (
        <div
          style={{
            display: "grid",
            gap: "15px",
            gridTemplateColumns: "repeat(4, 1fr)",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              padding: "20px",
              backgroundColor: "#f0f9ff",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "24px", fontWeight: 600, color: "#2563eb" }}
            >
              {status.total_transactions}
            </div>
            <div style={{ color: "#6b7280", fontSize: "14px" }}>
              Total Transactions
            </div>
          </div>
          <div
            style={{
              padding: "20px",
              backgroundColor: "#f0fdf4",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "24px", fontWeight: 600, color: "#10b981" }}
            >
              {status.reconciled_count}
            </div>
            <div style={{ color: "#6b7280", fontSize: "14px" }}>Reconciled</div>
          </div>
          <div
            style={{
              padding: "20px",
              backgroundColor: "#fef2f2",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "24px", fontWeight: 600, color: "#ef4444" }}
            >
              {status.unreconciled_count}
            </div>
            <div style={{ color: "#6b7280", fontSize: "14px" }}>
              Unreconciled
            </div>
          </div>
          <div
            style={{
              padding: "20px",
              backgroundColor: "#fefce8",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "24px", fontWeight: 600, color: "#eab308" }}
            >
              {status.reconciliation_rate?.toFixed(1)}%
            </div>
            <div style={{ color: "#6b7280", fontSize: "14px" }}>Match Rate</div>
          </div>
        </div>
      )}

      {!status && connections.length > 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#6b7280", margin: 0 }}>
            No reconciliation data available. Click "Auto-Reconcile" to start.
          </p>
        </div>
      )}

      {connections.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#6b7280", margin: 0 }}>
            No ERP connection configured. Please configure an ERP connection
            first.
          </p>
        </div>
      )}
    </div>
  );
};

const PaymentsTab: React.FC<{
  payments: Payment[];
  onNewPayment: () => void;
  onRefresh: () => void;
}> = ({ payments, onNewPayment, onRefresh }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#10b981";
      case "failed":
        return "#ef4444";
      case "pending":
        return "#f59e0b";
      case "processing":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const validCurrency = currency && currency.trim() !== "" ? currency : "NGN";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: validCurrency,
    }).format(amount);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "15px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "18px" }}>Payments</h2>
          <p
            style={{ margin: "5px 0 0 0", color: "#6b7280", fontSize: "12px" }}
          >
            Manage payments and track transaction status
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onRefresh}
            style={{
              padding: "6px 12px",
              border: "1px solid #059669",
              backgroundColor: "#ecfdf5",
              color: "#059669",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {payments.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#6b7280", margin: 0 }}>
            No payments found. Payments will appear here once transactions are
            processed.
          </p>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f9fafb" }}>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Reference
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Beneficiary
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "right",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Amount
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Type
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td
                  style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}
                >
                  {payment.reference_number || payment.id}
                </td>
                <td
                  style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}
                >
                  {payment.description || "N/A"}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "right",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {formatCurrency(payment.amount, payment.currency)}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <span
                    style={{ textTransform: "uppercase", fontSize: "12px" }}
                  >
                    {payment.payment_type}
                  </span>
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      backgroundColor: getStatusColor(payment.status),
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "12px",
                      textTransform: "uppercase",
                    }}
                  >
                    {payment.status}
                  </span>
                </td>
                <td
                  style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}
                >
                  {new Date(payment.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const InvoicesTab: React.FC<{ invoices: Invoice[] }> = ({ invoices }) => {
  const formatCurrency = (amount: number, currency: string) => {
    const validCurrency = currency && currency.trim() !== "" ? currency : "NGN";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: validCurrency,
    }).format(amount);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>
        Outstanding Invoices
      </h2>
      {invoices.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#6b7280", margin: 0 }}>
            No invoices found. Invoices will appear here once synced from your
            ERP system.
          </p>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f9fafb" }}>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Invoice #
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Customer
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "right",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Amount
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "right",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Outstanding
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Due Date
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td
                  style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}
                >
                  {invoice.invoice_number}
                </td>
                <td
                  style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}
                >
                  {invoice.customer_name}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "right",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {formatCurrency(invoice.amount, invoice.currency)}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "right",
                    borderBottom: "1px solid #e5e7eb",
                    color: "#ef4444",
                  }}
                >
                  {formatCurrency(invoice.amount_due, invoice.currency)}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {new Date(invoice.due_date).toLocaleDateString()}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {invoice.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const LoansTab: React.FC<{
  loans: Loan[];
  tenantId: string;
  customerId: string;
}> = ({ loans }) => {
  const formatCurrency = (amount: number, currency: string) => {
    const validCurrency = currency && currency.trim() !== "" ? currency : "NGN";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: validCurrency,
    }).format(amount);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>Loan Accounts</h2>
      <div style={{ display: "grid", gap: "15px" }}>
        {loans.map((loan) => (
          <div
            key={loan.id}
            style={{
              padding: "20px",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              backgroundColor: "white",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "16px" }}>
                  {loan.loan_type}
                </h3>
                <p
                  style={{
                    margin: "0 0 10px 0",
                    color: "#6b7280",
                    fontSize: "14px",
                  }}
                >
                  Account: {loan.loan_number}
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "20px",
                  }}
                >
                  <div>
                    <div style={{ color: "#6b7280", fontSize: "12px" }}>
                      Principal
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {formatCurrency(loan.principal_amount, loan.currency)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#6b7280", fontSize: "12px" }}>
                      Outstanding
                    </div>
                    <div style={{ fontWeight: 600, color: "#ef4444" }}>
                      {formatCurrency(loan.outstanding_balance, loan.currency)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#6b7280", fontSize: "12px" }}>
                      Interest Rate
                    </div>
                    <div style={{ fontWeight: 600 }}>{loan.interest_rate}%</div>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#6b7280", fontSize: "12px" }}>
                  Next Payment
                </div>
                <div style={{ fontWeight: 600 }}>
                  {formatCurrency(
                    loan.next_payment_amount || loan.monthly_payment,
                    loan.currency,
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  Due:{" "}
                  {loan.next_payment_date
                    ? new Date(loan.next_payment_date).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CashPositionTab: React.FC<{
  position: CashPosition | null;
  tenantId: string;
  customerId: string;
}> = ({ position, tenantId, customerId }) => {
  const [forecast, setForecast] = useState<any>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  useEffect(() => {
    loadForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadForecast = async () => {
    setLoadingForecast(true);
    setForecastError(null);
    try {
      const data = await erpIntegrationApi.getCashForecast(
        tenantId,
        customerId,
        30,
      );
      console.log("Cash forecast data:", data);
      setForecast(data);
    } catch (error) {
      console.error("Failed to load forecast:", error);
      setForecastError("Failed to load cash forecast");
    } finally {
      setLoadingForecast(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "NGN") => {
    const validCurrency = currency && currency.trim() !== "" ? currency : "NGN";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: validCurrency,
    }).format(amount);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>Cash Position</h2>

      {position && (
        <div style={{ marginBottom: "30px" }}>
          <div
            style={{
              padding: "30px",
              backgroundColor: "#f0f9ff",
              borderRadius: "8px",
              textAlign: "center",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                color: "#6b7280",
                fontSize: "14px",
                marginBottom: "5px",
              }}
            >
              Total Cash Position
            </div>
            <div
              style={{ fontSize: "36px", fontWeight: 700, color: "#2563eb" }}
            >
              {formatCurrency(
                position.total_cash,
                position.currency || "NGN",
              )}
            </div>
            <div style={{ color: "#6b7280", fontSize: "12px" }}>
              As of {new Date(position.as_of_date).toLocaleString()}
            </div>
          </div>

          <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
            Accounts ({position.accounts_breakdown?.length || 0} accounts)
          </h3>
          <div
            style={{
              display: "grid",
              gap: "10px",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {position.accounts_breakdown?.map((acc: any, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: "15px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  backgroundColor: acc.balance < 0 ? "#fef2f2" : "white",
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: "3px" }}>
                  {acc.account_name}
                </div>
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: "12px",
                    marginBottom: "5px",
                  }}
                >
                  {acc.bank_name} • ID: {acc.account_id}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "8px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#6b7280",
                        marginBottom: "2px",
                      }}
                    >
                      Balance
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: acc.balance < 0 ? "#ef4444" : "#059669",
                      }}
                    >
                      {formatCurrency(acc.balance, acc.currency)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#6b7280",
                        marginBottom: "2px",
                      }}
                    >
                      Available
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color:
                          acc.available_balance < 0 ? "#ef4444" : "#059669",
                      }}
                    >
                      {formatCurrency(acc.available_balance, acc.currency)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Forecast Section */}
      <div style={{ marginTop: "30px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px" }}>30-Day Cash Forecast</h3>
          <button
            onClick={loadForecast}
            disabled={loadingForecast}
            style={{
              padding: "6px 12px",
              border: "1px solid #059669",
              backgroundColor: "#ecfdf5",
              color: "#059669",
              borderRadius: "4px",
              cursor: loadingForecast ? "not-allowed" : "pointer",
              fontWeight: 500,
              opacity: loadingForecast ? 0.6 : 1,
            }}
          >
            {loadingForecast ? "⏳ Loading..." : "🔄 Refresh Forecast"}
          </button>
        </div>

        {loadingForecast && (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
            }}
          >
            Loading forecast data...
          </div>
        )}

        {forecastError && (
          <div
            style={{
              padding: "20px",
              backgroundColor: "#fef2f2",
              border: "1px solid #ef4444",
              borderRadius: "8px",
              color: "#ef4444",
            }}
          >
            {forecastError}
          </div>
        )}

        {!loadingForecast && !forecastError && forecast && (
          <div>
            <div
              style={{
                padding: "20px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#6b7280", fontSize: "12px" }}>
                    Opening Balance
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      color:
                        forecast.opening_balance < 0 ? "#ef4444" : "#374151",
                    }}
                  >
                    {formatCurrency(forecast.opening_balance)}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#6b7280", fontSize: "12px" }}>
                    Total Projected Inflows
                  </div>
                  <div style={{ fontWeight: 600, color: "#10b981" }}>
                    +
                    {formatCurrency(
                      forecast.projections?.reduce(
                        (sum: number, p: any) => sum + p.expected_inflows,
                        0,
                      ) || 0,
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#6b7280", fontSize: "12px" }}>
                    Total Projected Outflows
                  </div>
                  <div style={{ fontWeight: 600, color: "#ef4444" }}>
                    -
                    {formatCurrency(
                      forecast.projections?.reduce(
                        (sum: number, p: any) => sum + p.expected_outflows,
                        0,
                      ) || 0,
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#6b7280", fontSize: "12px" }}>
                    Ending Balance
                  </div>
                  <div style={{ fontWeight: 600, color: "#2563eb" }}>
                    {formatCurrency(
                      forecast.projections?.[forecast.projections.length - 1]
                        ?.projected_balance || 0,
                    )}
                  </div>
                </div>
              </div>

              {/* Daily Forecast Chart */}
              <div style={{ marginTop: "20px" }}>
                <h4
                  style={{
                    margin: "0 0 10px 0",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  Daily Projections
                </h4>
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "12px",
                    }}
                  >
                    <thead
                      style={{
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#f9fafb",
                        zIndex: 1,
                      }}
                    >
                      <tr>
                        <th
                          style={{
                            padding: "8px",
                            textAlign: "left",
                            borderBottom: "2px solid #e5e7eb",
                          }}
                        >
                          Date
                        </th>
                        <th
                          style={{
                            padding: "8px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                          }}
                        >
                          Inflows
                        </th>
                        <th
                          style={{
                            padding: "8px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                          }}
                        >
                          Outflows
                        </th>
                        <th
                          style={{
                            padding: "8px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                          }}
                        >
                          Net Flow
                        </th>
                        <th
                          style={{
                            padding: "8px",
                            textAlign: "right",
                            borderBottom: "2px solid #e5e7eb",
                          }}
                        >
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.projections?.map((proj: any, idx: number) => (
                        <tr
                          key={idx}
                          style={{ borderBottom: "1px solid #f3f4f6" }}
                        >
                          <td style={{ padding: "8px" }}>
                            {new Date(proj.date).toLocaleDateString()}
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              textAlign: "right",
                              color: "#10b981",
                              fontWeight: 500,
                            }}
                          >
                            +{formatCurrency(proj.expected_inflows)}
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              textAlign: "right",
                              color: "#ef4444",
                              fontWeight: 500,
                            }}
                          >
                            -{formatCurrency(proj.expected_outflows)}
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              textAlign: "right",
                              fontWeight: 500,
                              color:
                                proj.net_cash_flow >= 0 ? "#10b981" : "#ef4444",
                            }}
                          >
                            {proj.net_cash_flow >= 0 ? "+" : ""}
                            {formatCurrency(proj.net_cash_flow)}
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              textAlign: "right",
                              fontWeight: 600,
                              color:
                                proj.projected_balance < 0
                                  ? "#ef4444"
                                  : "#2563eb",
                            }}
                          >
                            {formatCurrency(proj.projected_balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loadingForecast && !forecastError && !forecast && (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
            }}
          >
            No forecast data available
          </div>
        )}
      </div>
    </div>
  );
};

const ConnectionModal: React.FC<{
  tenantId: string;
  customerId: string;
  onClose: () => void;
  onCreated: () => void;
}> = ({ tenantId, customerId, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    connection_name: "",
    provider: "erpnext" as ERPProvider,
    credentials: {
      base_url: "",
      api_key: "",
      api_secret: "",
    },
    sync_settings: {
      auto_sync_enabled: true,
      sync_frequency: "hourly" as "realtime" | "hourly" | "daily" | "weekly",
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await erpIntegrationApi.createConnection(tenantId, customerId, formData);
      onCreated();
    } catch (error) {
      alert("Failed to create connection");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "8px",
          width: "500px",
          maxWidth: "90%",
        }}
      >
        <h2 style={{ margin: "0 0 20px 0" }}>Add ERP Connection</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              Connection Name
            </label>
            <input
              type="text"
              value={formData.connection_name}
              onChange={(e) =>
                setFormData({ ...formData, connection_name: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
              required
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              ERP Provider
            </label>
            <select
              value={formData.provider}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  provider: e.target.value as ERPProvider,
                })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
            >
              <option value="quickbooks">QuickBooks</option>
              <option value="xero">Xero</option>
              <option value="sage">Sage</option>
              <option value="netsuite">NetSuite</option>
              <option value="dynamics365">Dynamics 365</option>
              <option value="sap">SAP</option>
              <option value="erpnext">ERPNext</option>
            </select>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              ERP URL
            </label>
            <input
              type="url"
              value={formData.credentials.base_url}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  credentials: {
                    ...formData.credentials,
                    base_url: e.target.value,
                  },
                })
              }
              placeholder="https://your-erp.example.com"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
              required
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              API Key
            </label>
            <input
              type="text"
              value={formData.credentials.api_key}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  credentials: {
                    ...formData.credentials,
                    api_key: e.target.value,
                  },
                })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              API Secret
            </label>
            <input
              type="password"
              value={formData.credentials.api_secret}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  credentials: {
                    ...formData.credentials,
                    api_secret: e.target.value,
                  },
                })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
            />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              Sync Frequency
            </label>
            <select
              value={formData.sync_settings.sync_frequency}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sync_settings: {
                    ...formData.sync_settings,
                    sync_frequency: e.target.value as
                      | "realtime"
                      | "hourly"
                      | "daily"
                      | "weekly",
                  },
                })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
            >
              <option value="realtime">Real-time (Webhooks)</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div
            style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 20px",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Create Connection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PaymentModal: React.FC<{
  tenantId: string;
  customerId: string;
  connections: ERPConnection[];
  bankAccounts: BankAccount[];
  onClose: () => void;
  onCreated: () => void;
}> = ({
  tenantId,
  customerId,
  connections,
  bankAccounts,
  onClose,
  onCreated,
}) => {
  const [formData, setFormData] = useState({
    connection_id: connections[0]?.id || "",
    payment_type: "nip",
    amount: "",
    currency: "NGN",
    source_account: bankAccounts[0]?.id || "",
    dest_account: "",
    dest_bank_code: "",
    beneficiary_name: "",
    narration: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await erpIntegrationApi.initiatePayment(tenantId, customerId, {
        ...formData,
        amount: parseFloat(formData.amount),
        payment_type: (formData.payment_type || "payment") as "deposit" | "payment" | "transfer" | "withdrawal",
      });
      onCreated();
    } catch (error) {
      alert("Failed to initiate payment");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "8px",
          width: "500px",
          maxWidth: "90%",
        }}
      >
        <h2 style={{ margin: "0 0 20px 0" }}>New Payment</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              Payment Type
            </label>
            <select
              value={formData.payment_type}
              onChange={(e) =>
                setFormData({ ...formData, payment_type: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
            >
              <option value="internal">Internal Transfer</option>
              <option value="nip">NIP (Instant)</option>
              <option value="neft">NEFT</option>
              <option value="rtgs">RTGS</option>
              <option value="swift">SWIFT (International)</option>
            </select>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              Source Account
            </label>
            <select
              value={formData.source_account}
              onChange={(e) =>
                setFormData({ ...formData, source_account: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
            >
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name} - {acc.account_number}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              Beneficiary Name
            </label>
            <input
              type="text"
              value={formData.beneficiary_name}
              onChange={(e) =>
                setFormData({ ...formData, beneficiary_name: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
              required
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              Destination Account
            </label>
            <input
              type="text"
              value={formData.dest_account}
              onChange={(e) =>
                setFormData({ ...formData, dest_account: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
              required
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              Amount (NGN)
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
              required
            />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{ display: "block", marginBottom: "5px", fontWeight: 500 }}
            >
              Narration
            </label>
            <input
              type="text"
              value={formData.narration}
              onChange={(e) =>
                setFormData({ ...formData, narration: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
              }}
            />
          </div>
          <div
            style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 20px",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Initiate Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ERPIntegrationDashboard;

// Sync Operations Tab
const SyncOperationsTab: React.FC<{
  tenantId: string;
  customerId: string;
  connections: ERPConnection[];
}> = ({ tenantId, customerId, connections }) => {
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadSyncData = async () => {
    if (connections.length === 0) return;

    setLoading(true);
    try {
      const history = await erpIntegrationApi.getSyncHistory(
        tenantId,
        customerId,
        connections[0].id,
      );
      setSyncHistory(history.syncs || []);

      const status = await erpIntegrationApi.getSyncStatus(
        tenantId,
        customerId,
        connections[0].id,
      );
      setSyncStatus(status);
    } catch (error) {
      console.error("Failed to load sync data:", error);
    }
    setLoading(false);
  };

  const handleSyncAccounts = async () => {
    if (connections.length === 0) {
      alert("No ERP connection configured");
      return;
    }

    try {
      await erpIntegrationApi.syncAccounts(
        tenantId,
        customerId,
        connections[0].id,
      );
      alert("Account sync started successfully");
      loadSyncData();
    } catch (error) {
      alert("Failed to start account sync");
    }
  };

  const handleSyncTransactions = async () => {
    if (connections.length === 0) {
      alert("No ERP connection configured");
      return;
    }

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 1);
    const toDate = new Date();

    try {
      await erpIntegrationApi.syncTransactions(
        tenantId,
        customerId,
        connections[0].id,
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0],
      );
      alert("Transaction sync started successfully");
      loadSyncData();
    } catch (error) {
      alert("Failed to start transaction sync");
    }
  };

  const handleSyncInvoices = async () => {
    if (connections.length === 0) {
      alert("No ERP connection configured");
      return;
    }

    try {
      await erpIntegrationApi.syncInvoicesData(
        tenantId,
        customerId,
        connections[0].id,
      );
      alert("Invoice sync started successfully");
      loadSyncData();
    } catch (error) {
      alert("Failed to start invoice sync");
    }
  };

  useEffect(() => {
    loadSyncData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>Sync Operations</h2>
        <button
          onClick={loadSyncData}
          style={{
            padding: "6px 12px",
            border: "1px solid #059669",
            backgroundColor: "#ecfdf5",
            color: "#059669",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Sync Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "15px",
          marginBottom: "30px",
        }}
      >
        <button
          onClick={handleSyncAccounts}
          style={{
            padding: "20px",
            backgroundColor: "#eff6ff",
            border: "1px solid #2563eb",
            borderRadius: "8px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#2563eb",
              marginBottom: "5px",
            }}
          >
            💳 Sync Accounts
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            Sync all bank accounts from ERP
          </div>
        </button>

        <button
          onClick={handleSyncTransactions}
          style={{
            padding: "20px",
            backgroundColor: "#f0fdf4",
            border: "1px solid #10b981",
            borderRadius: "8px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#10b981",
              marginBottom: "5px",
            }}
          >
            📊 Sync Transactions
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            Sync transactions from last 30 days
          </div>
        </button>

        <button
          onClick={handleSyncInvoices}
          style={{
            padding: "20px",
            backgroundColor: "#fef2f2",
            border: "1px solid #ef4444",
            borderRadius: "8px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#ef4444",
              marginBottom: "5px",
            }}
          >
            📄 Sync Invoices
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            Sync all outstanding invoices
          </div>
        </button>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div
          style={{
            padding: "20px",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 15px 0", fontSize: "16px" }}>
            Current Sync Status
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "15px",
            }}
          >
            <div>
              <div style={{ color: "#6b7280", fontSize: "12px" }}>Status</div>
              <div style={{ fontWeight: 600, textTransform: "uppercase" }}>
                {syncStatus.status || "idle"}
              </div>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: "12px" }}>
                Last Sync
              </div>
              <div style={{ fontWeight: 600 }}>
                {syncStatus.last_sync_at
                  ? new Date(syncStatus.last_sync_at).toLocaleString()
                  : "Never"}
              </div>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: "12px" }}>
                Records Synced
              </div>
              <div style={{ fontWeight: 600 }}>
                {syncStatus.records_synced || 0}
              </div>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: "12px" }}>
                Next Sync
              </div>
              <div style={{ fontWeight: 600 }}>
                {syncStatus.next_sync_at
                  ? new Date(syncStatus.next_sync_at).toLocaleString()
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync History */}
      <h3 style={{ margin: "0 0 15px 0", fontSize: "16px" }}>Sync History</h3>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Loading...</div>
      ) : syncHistory.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          No sync history available
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f9fafb" }}>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Sync ID
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Type
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "right",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Records
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Started
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Completed
              </th>
            </tr>
          </thead>
          <tbody>
            {syncHistory.map((sync) => (
              <tr key={sync.sync_id}>
                <td
                  style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}
                >
                  {sync.sync_id}
                </td>
                <td
                  style={{
                    padding: "12px",
                    borderBottom: "1px solid #e5e7eb",
                    textTransform: "uppercase",
                  }}
                >
                  {sync.sync_type}
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      backgroundColor:
                        sync.status === "completed"
                          ? "#10b981"
                          : sync.status === "failed"
                            ? "#ef4444"
                            : "#f59e0b",
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "12px",
                      textTransform: "uppercase",
                    }}
                  >
                    {sync.status}
                  </span>
                </td>
                <td
                  style={{
                    padding: "12px",
                    textAlign: "right",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {sync.records_synced}
                </td>
                <td
                  style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}
                >
                  {new Date(sync.started_at).toLocaleString()}
                </td>
                <td
                  style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}
                >
                  {sync.completed_at
                    ? new Date(sync.completed_at).toLocaleString()
                    : "In Progress"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// Account Mappings Tab
const AccountMappingsTab: React.FC<{
  tenantId: string;
  customerId: string;
  connections: ERPConnection[];
}> = ({ tenantId, customerId, connections }) => {
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMappings = async () => {
    if (connections.length === 0) return;

    setLoading(true);
    try {
      const data = await erpIntegrationApi.listAccountMappings(
        tenantId,
        customerId,
        connections[0].id,
      );
      setMappings(data.mappings || []);
    } catch (error) {
      console.error("Failed to load mappings:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>Account Mappings</h2>
        <button
          onClick={loadMappings}
          style={{
            padding: "6px 12px",
            border: "1px solid #059669",
            backgroundColor: "#ecfdf5",
            color: "#059669",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Loading...</div>
      ) : mappings.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          No account mappings configured
        </div>
      ) : (
        <div style={{ display: "grid", gap: "15px" }}>
          {mappings.map((mapping) => (
            <div
              key={mapping.id}
              style={{
                padding: "20px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                backgroundColor: "white",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                }}
              >
                <div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    Bank Account
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {mapping.bank_account_name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    {mapping.bank_account_number}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    ERP Account
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {mapping.erp_account_name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    {mapping.erp_account_code}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Webhooks Tab
const WebhooksTab: React.FC<{
  tenantId: string;
  customerId: string;
  connections: ERPConnection[];
}> = ({ tenantId, customerId, connections }) => {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadWebhooks = async () => {
    if (connections.length === 0) return;

    setLoading(true);
    try {
      const data = await erpIntegrationApi.listWebhooks(
        tenantId,
        customerId,
        connections[0].id,
      );
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error("Failed to load webhooks:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>Webhooks Configuration</h2>
        <button
          onClick={loadWebhooks}
          style={{
            padding: "6px 12px",
            border: "1px solid #059669",
            backgroundColor: "#ecfdf5",
            color: "#059669",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Loading...</div>
      ) : webhooks.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#6b7280" }}>No webhooks configured</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "15px" }}>
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              style={{
                padding: "20px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                backgroundColor: "white",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 5px 0", fontSize: "16px" }}>
                    {webhook.event_type}
                  </h3>
                  <p
                    style={{
                      margin: "0 0 10px 0",
                      color: "#6b7280",
                      fontSize: "14px",
                    }}
                  >
                    {webhook.url}
                  </p>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    Status:{" "}
                    <span
                      style={{
                        color: webhook.active ? "#10b981" : "#ef4444",
                        fontWeight: 600,
                      }}
                    >
                      {webhook.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Reports Tab
const ReportsTab: React.FC<{
  tenantId: string;
  customerId: string;
  connections: ERPConnection[];
}> = ({ tenantId, customerId, connections }) => {
  const [activeReport, setActiveReport] = useState<
    "reconciliation" | "cashflow" | "payment" | null
  >(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async (
    reportType: "reconciliation" | "cashflow" | "payment",
  ) => {
    if (connections.length === 0) {
      alert("No ERP connection configured");
      return;
    }

    setLoading(true);
    setActiveReport(reportType);

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 1);
    const toDate = new Date();

    try {
      let data;
      if (reportType === "reconciliation") {
        data = await erpIntegrationApi.getReconciliationReport(
          tenantId,
          customerId,
          connections[0].id,
          fromDate.toISOString().split("T")[0],
          toDate.toISOString().split("T")[0],
        );
      } else if (reportType === "cashflow") {
        data = await erpIntegrationApi.getCashFlowReport(
          tenantId,
          customerId,
          fromDate.toISOString().split("T")[0],
          toDate.toISOString().split("T")[0],
        );
      } else {
        data = await erpIntegrationApi.getPaymentSummaryReport(
          tenantId,
          customerId,
          fromDate.toISOString().split("T")[0],
          toDate.toISOString().split("T")[0],
        );
      }
      setReportData(data);
    } catch (error) {
      console.error(`Failed to generate ${reportType} report:`, error);
      alert(`Failed to generate ${reportType} report`);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "18px" }}>Reports</h2>

      {/* Report Selection */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "15px",
          marginBottom: "30px",
        }}
      >
        <button
          onClick={() => generateReport("reconciliation")}
          style={{
            padding: "20px",
            backgroundColor: "#eff6ff",
            border: "1px solid #2563eb",
            borderRadius: "8px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#2563eb",
              marginBottom: "5px",
            }}
          >
            📊 Reconciliation Report
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            View reconciliation status and unmatched transactions
          </div>
        </button>

        <button
          onClick={() => generateReport("cashflow")}
          style={{
            padding: "20px",
            backgroundColor: "#f0fdf4",
            border: "1px solid #10b981",
            borderRadius: "8px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#10b981",
              marginBottom: "5px",
            }}
          >
            💰 Cash Flow Report
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            Analyze cash inflows and outflows
          </div>
        </button>

        <button
          onClick={() => generateReport("payment")}
          style={{
            padding: "20px",
            backgroundColor: "#fef2f2",
            border: "1px solid #ef4444",
            borderRadius: "8px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#ef4444",
              marginBottom: "5px",
            }}
          >
            💳 Payment Summary
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            Summary of all payment activities
          </div>
        </button>
      </div>

      {/* Report Display */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          Generating report...
        </div>
      ) : reportData ? (
        <div
          style={{
            padding: "20px",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            backgroundColor: "white",
          }}
        >
          <h3
            style={{
              margin: "0 0 15px 0",
              fontSize: "16px",
              textTransform: "capitalize",
            }}
          >
            {activeReport} Report
          </h3>
          <pre
            style={{ fontSize: "12px", overflow: "auto", maxHeight: "500px" }}
          >
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          Select a report type above to generate
        </div>
      )}
    </div>
  );
};

// Export tab components for reuse in EnterpriseERPDashboard
export {
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
  WebhooksTab
};

