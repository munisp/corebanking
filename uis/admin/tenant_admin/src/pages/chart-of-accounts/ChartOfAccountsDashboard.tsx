import React, { useCallback, useEffect, useState } from "react";
import {
  accountsApi,
  approvalsApi,
  categoriesApi,
  cbnApi,
  journalEntriesApi,
  mappingsApi,
  periodsApi,
  reconciliationApi,
  reportsApi,
  STANDARD_MAPPING_KEYS,
  type Account,
  type AccountCategory,
  type AccountHierarchyNode,
  type AccountingPeriod,
  type AccountType,
  type ApprovalRequest,
  type ApprovalWorkflow,
  type BalanceSheet,
  type CBNReportType,
  type COAMapping,
  type IncomeStatement,
  type JournalEntry,
  type JournalEntryWithApproval,
  type PeriodCloseResult,
  type PeriodSummary,
  type ReconciliationStatus,
  type TrialBalance,
} from "../../api/chartOfAccountsApi";

interface ChartOfAccountsDashboardProps {
  tenantId: string;
}

// Helper function to determine user role from localStorage
const getUserRole = (): string => {
  try {
    const authUser = localStorage.getItem("auth_user") || localStorage.getItem("admin_data");
    if (authUser) {
      const user = JSON.parse(authUser);
      const accessLevel = user.access_level || user.user_role || user.role || "0";

      // Named v2.perm tenant roles (current backend)
      const namedRoleMap: Record<string, string> = {
        super_admin: "super_admin",
        branch_manager: "bank_admin",
        operations_manager: "finance_admin",
        treasury_manager: "finance_admin",
        trade_finance_admin: "finance_admin",
        vault_manager: "finance_admin",
        loan_officer: "finance_admin",
        risk_manager: "read_only",
        internal_auditor: "read_only",
        compliance_officer: "read_only",
        it_admin: "read_only",
        relationship_manager: "read_only",
        support_agent: "read_only",
      };
      if (namedRoleMap[accessLevel]) return namedRoleMap[accessLevel];

      // Legacy numeric access levels
      const legacyNumericMap: Record<string, string> = {
        "0": "read_only",
        "1": "read_only",
        "2": "finance_admin",
        "3": "finance_admin",
        "4": "read_only",
        "5": "read_only",
        "6": "bank_admin",
        "7": "super_admin",
        "8": "super_admin",
      };
      return legacyNumericMap[accessLevel] || "read_only";
    }
  } catch (error) {
    console.error("Failed to get user role:", error);
  }
  return "read_only";
};

const canManageAccounts = (role: string): boolean => {
  return ["bank_admin", "super_admin", "finance_admin"].includes(role);
};

const canManageTenants = (role: string): boolean => {
  return role === "super_admin";
};

const formatCurrency = (amount: number, currency: string = "NGN"): string => {
  const koboAmount = amount / 100; // Convert from kobo to naira
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency,
  }).format(koboAmount);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const ChartOfAccountsDashboard: React.FC<
  ChartOfAccountsDashboardProps
> = ({ tenantId }) => {
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [hierarchy, setHierarchy] = useState<AccountHierarchyNode[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [incomeStatement, setIncomeStatement] =
    useState<IncomeStatement | null>(null);
  const [reconciliationStatus, setReconciliationStatus] =
    useState<ReconciliationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [userRole] = useState(getUserRole());

  // Mappings state
  const [mappings, setMappings] = useState<COAMapping[]>([]);
  const [mappingModal, setMappingModal] = useState<{
    open: boolean;
    key: string;
    accountId: string;
    description: string;
    isEdit: boolean;
  }>({ open: false, key: "", accountId: "", description: "", isEdit: false });
  const [mappingSearch, setMappingSearch] = useState("");

  // Journal Entries state
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryWithApproval | null>(null);
  const [entryDetailOpen, setEntryDetailOpen] = useState(false);
  const [jeFilter, setJeFilter] = useState<"all" | "draft" | "pending" | "posted" | "rejected" | "reversed">("all");
  const [jeSearch, setJeSearch] = useState("");
  const [createJEModal, setCreateJEModal] = useState(false);
  const [jeTemplate, setJeTemplate] = useState<string>("");
  const emptyJE = { description: "", reference: "", date: new Date().toISOString().slice(0, 10), lines: [{ account_id: "", debit_amount: 0, credit_amount: 0, description: "" }, { account_id: "", debit_amount: 0, credit_amount: 0, description: "" }] };
  const [newJE, setNewJE] = useState(emptyJE);
  const [jeSubmitting, setJeSubmitting] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string }>({ open: false, requestId: "" });
  const [rejectComment, setRejectComment] = useState("");

  // Periods state
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null);
  const [periodFiscalYear, setPeriodFiscalYear] = useState(new Date().getFullYear());
  const [createFYModal, setCreateFYModal] = useState(false);
  const [newFYYear, setNewFYYear] = useState(new Date().getFullYear());
  const [newFYStartMonth, setNewFYStartMonth] = useState(1);
  const [periodActionLoading, setPeriodActionLoading] = useState<string>("");

  // Approvals state
  const [approvalWorkflows, setApprovalWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [approvalFilter, setApprovalFilter] = useState<"" | "pending" | "approved" | "rejected">("pending");

  // CBN state
  const [cbnReportTypes, setCbnReportTypes] = useState<CBNReportType[]>([]);
  const [cbnReportDate, setCbnReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [cbnReport, setCbnReport] = useState<any>(null);
  const [cbnReportLoading, setCbnReportLoading] = useState(false);

  // Load accounts
  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountsApi.listAccounts(tenantId);
      setAccounts(data);
    } catch (err: any) {
      console.error("Failed to load accounts:", err);
      // Handle 401 errors gracefully to prevent logout
      if (err.response?.status === 401) {
        setError(
          "Chart of Accounts service is not accessible. The service may not be running or you may not have the required permissions.",
        );
      } else if (err.response?.status === 404) {
        setError(
          "Chart of Accounts service not found. Please ensure the service is deployed and accessible.",
        );
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load accounts",
        );
      }
      // Prevent error from bubbling to global interceptor
      return;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const data = await categoriesApi.listCategories(tenantId);
      setCategories(data);
    } catch (err: any) {
      console.error("Failed to load categories:", err);
      // Silently fail for categories as they're not critical
      // Prevent error from bubbling to global interceptor
      return;
    }
  }, [tenantId]);

  // Load hierarchy
  const loadHierarchy = useCallback(async () => {
    try {
      setLoading(true);
      const data = await accountsApi.getAccountHierarchy(tenantId);
      setHierarchy(data);
    } catch (err: any) {
      console.error("Failed to load hierarchy:", err);
      // Prevent error from bubbling to global interceptor
      if (err.response?.status === 401 || err.response?.status === 404) {
        setError("Chart of Accounts service is not accessible.");
      }
      return;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Load trial balance
  const loadTrialBalance = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reportsApi.getTrialBalance(tenantId);
      setTrialBalance(data);
    } catch (err: any) {
      console.error("Failed to load trial balance:", err);
      // Prevent error from bubbling to global interceptor
      if (err.response?.status === 401 || err.response?.status === 404) {
        setError("Chart of Accounts service is not accessible.");
      }
      return;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Load balance sheet
  const loadBalanceSheet = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reportsApi.getBalanceSheet(tenantId);
      setBalanceSheet(data);
    } catch (err: any) {
      console.error("Failed to load balance sheet:", err);
      // Prevent error from bubbling to global interceptor
      if (err.response?.status === 401 || err.response?.status === 404) {
        setError("Chart of Accounts service is not accessible.");
      }
      return;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Load income statement
  const loadIncomeStatement = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reportsApi.getIncomeStatement(tenantId);
      setIncomeStatement(data);
    } catch (err: any) {
      console.error("Failed to load income statement:", err);
      // Prevent error from bubbling to global interceptor
      if (err.response?.status === 401 || err.response?.status === 404) {
        setError("Chart of Accounts service is not accessible.");
      }
      return;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Load reconciliation status
  const loadReconciliationStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reconciliationApi.getReconciliationStatus(tenantId);
      setReconciliationStatus(data);
    } catch (err: any) {
      console.error("Failed to load reconciliation status:", err);
      // Prevent error from bubbling to global interceptor
      if (err.response?.status === 401 || err.response?.status === 404) {
        setError("Chart of Accounts service is not accessible.");
      }
      return;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadMappings = useCallback(async () => {
    try {
      const data = await mappingsApi.list(tenantId);
      setMappings(data);
    } catch (err: any) {
      console.error("Failed to load COA mappings:", err);
    }
  }, [tenantId]);

  const handleSaveMapping = async () => {
    if (!mappingModal.key || !mappingModal.accountId) {
      alert("Mapping key and account are required");
      return;
    }
    try {
      await mappingsApi.upsert(
        tenantId,
        { mapping_key: mappingModal.key, account_id: mappingModal.accountId, description: mappingModal.description },
        userRole,
      );
      setMappingModal({ open: false, key: "", accountId: "", description: "", isEdit: false });
      loadMappings();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to save mapping");
    }
  };

  const handleDeleteMapping = async (mappingKey: string) => {
    if (!confirm(`Remove mapping for "${mappingKey}"?`)) return;
    try {
      await mappingsApi.remove(tenantId, mappingKey, userRole);
      loadMappings();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to delete mapping");
    }
  };

  // Load journal entries
  const loadJournalEntries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await journalEntriesApi.listJournalEntries(tenantId);
      setJournalEntries(data ?? []);
    } catch (err: any) {
      console.error("Failed to load journal entries:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Load periods
  const loadPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const data = await periodsApi.listPeriods(tenantId, periodFiscalYear || undefined);
      setPeriods(data ?? []);
    } catch (err: any) {
      console.error("Failed to load periods:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, periodFiscalYear]);

  // Load approvals
  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const [wfs, reqs] = await Promise.all([
        approvalsApi.listWorkflows(tenantId),
        approvalsApi.listRequests(tenantId, { entity_type: "journal_entry", status: approvalFilter || undefined }),
      ]);
      setApprovalWorkflows(wfs ?? []);
      setApprovalRequests(reqs ?? []);
    } catch (err: any) {
      console.error("Failed to load approvals:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, approvalFilter]);

  // Load CBN report types
  const loadCBNReportTypes = useCallback(async () => {
    try {
      const data = await cbnApi.listReportTypes(tenantId);
      setCbnReportTypes(data ?? []);
    } catch (err: any) {
      console.error("Failed to load CBN report types:", err);
    }
  }, [tenantId]);

  const handleCreateJournalEntry = async () => {
    if (!newJE.description || newJE.lines.length < 2) {
      alert("Description and at least 2 journal lines are required");
      return;
    }
    const totalDebit = newJE.lines.reduce((s, l) => s + (l.debit_amount || 0), 0);
    const totalCredit = newJE.lines.reduce((s, l) => s + (l.credit_amount || 0), 0);
    if (totalDebit !== totalCredit) {
      alert(`Entry is not balanced: debits ${totalDebit} ≠ credits ${totalCredit}`);
      return;
    }
    try {
      setJeSubmitting(true);
      await journalEntriesApi.createJournalEntry({ description: newJE.description, reference: newJE.reference, date: newJE.date, lines: newJE.lines }, tenantId, userRole);
      setCreateJEModal(false);
      setJeTemplate("");
      setNewJE(emptyJE);
      loadJournalEntries();
    } catch (err: any) {
      alert(err.response?.data || err.message || "Failed to create journal entry");
    } finally {
      setJeSubmitting(false);
    }
  };

  const handleSubmitForApproval = async (entryId: string) => {
    try {
      await approvalsApi.submitJournalForApproval(tenantId, entryId, userRole);
      loadJournalEntries();
      alert("Submitted for approval");
    } catch (err: any) {
      alert(err.response?.data || err.message || "Failed to submit");
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await approvalsApi.approve(tenantId, requestId, "", userRole);
      loadApprovals();
      loadJournalEntries();
    } catch (err: any) {
      alert(err.response?.data || err.message || "Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectComment) { alert("Please provide a reason"); return; }
    try {
      await approvalsApi.reject(tenantId, rejectModal.requestId, rejectComment, userRole);
      setRejectModal({ open: false, requestId: "" });
      setRejectComment("");
      loadApprovals();
      loadJournalEntries();
    } catch (err: any) {
      alert(err.response?.data || err.message || "Failed to reject");
    }
  };

  const handlePeriodAction = async (periodId: string, action: "soft-close" | "hard-close" | "lock" | "reopen", reason?: string) => {
    try {
      setPeriodActionLoading(periodId);
      if (action === "soft-close") await periodsApi.softClose(tenantId, periodId, userRole);
      else if (action === "hard-close") await periodsApi.hardClose(tenantId, periodId, userRole);
      else if (action === "lock") await periodsApi.lock(tenantId, periodId, userRole);
      else if (action === "reopen") await periodsApi.reopen(tenantId, periodId, reason || "Manual reopen", userRole);
      loadPeriods();
    } catch (err: any) {
      alert(err.response?.data || err.message || `Failed to ${action}`);
    } finally {
      setPeriodActionLoading("");
    }
  };

  const handleCreateFiscalYear = async () => {
    try {
      await periodsApi.createFiscalYear(tenantId, newFYYear, newFYStartMonth, userRole);
      setCreateFYModal(false);
      loadPeriods();
    } catch (err: any) {
      alert(err.response?.data || err.message || "Failed to create fiscal year");
    }
  };

  const handleGenerateCBNReport = async (reportType: string) => {
    try {
      setCbnReportLoading(true);
      const data = await cbnApi.generateReport(tenantId, reportType, cbnReportDate);
      setCbnReport(data);
    } catch (err: any) {
      alert(err.response?.data || err.message || "Failed to generate report");
    } finally {
      setCbnReportLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadAccounts();
    loadCategories();
  }, [loadAccounts, loadCategories]);

  // Load data based on active tab
  useEffect(() => {
    switch (activeTab) {
      case "hierarchy":
        loadHierarchy();
        break;
      case "trial-balance":
        loadTrialBalance();
        break;
      case "balance-sheet":
        loadBalanceSheet();
        break;
      case "income-statement":
        loadIncomeStatement();
        break;
      case "reconciliation":
        loadReconciliationStatus();
        break;
      case "mappings":
        loadMappings();
        break;
      case "journal-entries":
        loadJournalEntries();
        break;
      case "periods":
        loadPeriods();
        break;
      case "approvals":
        loadApprovals();
        break;
      case "cbn":
        loadCBNReportTypes();
        break;
    }
  }, [
    activeTab,
    loadHierarchy,
    loadTrialBalance,
    loadBalanceSheet,
    loadIncomeStatement,
    loadReconciliationStatus,
    loadMappings,
    loadJournalEntries,
    loadPeriods,
    loadApprovals,
    loadCBNReportTypes,
  ]);

  const handleCreateAccount = async (accountData: any) => {
    if (!canManageAccounts(userRole)) {
      alert("You do not have permission to create accounts");
      return;
    }

    try {
      await accountsApi.createAccount(accountData, tenantId, userRole);
      setShowCreateModal(false);
      loadAccounts();
      alert("Account created successfully");
    } catch (err: any) {
      console.error("Failed to create account:", err);
      alert(
        err.response?.data?.message ||
          err.message ||
          "Failed to create account",
      );
    }
  };

  const handleInitializeDefaults = async () => {
    if (!canManageTenants(userRole)) {
      alert("You do not have permission to initialize default accounts");
      return;
    }

    if (
      !confirm(
        "This will initialize the standard CBN-compliant Chart of Accounts. Continue?",
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await accountsApi.initializeDefaults(tenantId, userRole);
      loadAccounts();
      alert("Default accounts initialized successfully");
    } catch (err: any) {
      console.error("Failed to initialize defaults:", err);
      alert(
        err.response?.data?.message ||
          err.message ||
          "Failed to initialize defaults",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const filteredAccounts = (accounts || []).filter(
    (acc) =>
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const stats = {
    totalAccounts: (accounts || []).length,
    activeAccounts: (accounts || []).filter((a) => a.is_active).length,
    assets: (accounts || []).filter((a) => a.type === "asset").length,
    liabilities: (accounts || []).filter((a) => a.type === "liability").length,
    equity: (accounts || []).filter((a) => a.type === "equity").length,
    revenue: (accounts || []).filter((a) => a.type === "revenue").length,
    expenses: (accounts || []).filter((a) => a.type === "expense").length,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F3F4F6",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 24px",
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#1F2937",
              margin: 0,
            }}
          >
            Chart of Accounts
          </h1>
          <p
            style={{ fontSize: "14px", color: "#6B7280", margin: "4px 0 0 0" }}
          >
            Manage and view financial accounts • Tenant: {tenantId}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {canManageTenants(userRole) && (
            <button
              onClick={handleInitializeDefaults}
              style={{
                padding: "10px 20px",
                backgroundColor: "#F3F4F6",
                color: "#1F2937",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Initialize Defaults
            </button>
          )}
          {canManageAccounts(userRole) && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: "10px 20px",
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              + Create Account
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          overflowX: "auto",
        }}
      >
        {[
          { id: "accounts", label: "Accounts" },
          { id: "journal-entries", label: "Journal Entries" },
          { id: "approvals", label: "Approvals" },
          { id: "periods", label: "Periods" },
          { id: "hierarchy", label: "Hierarchy" },
          { id: "trial-balance", label: "Trial Balance" },
          { id: "balance-sheet", label: "Balance Sheet" },
          { id: "income-statement", label: "Income Statement" },
          { id: "cbn", label: "CBN Reports" },
          { id: "reconciliation", label: "Reconciliation" },
          { id: "mappings", label: "Account Mappings" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "16px 24px",
              border: "none",
              backgroundColor: "transparent",
              color: activeTab === tab.id ? "#2563EB" : "#6B7280",
              fontSize: "14px",
              fontWeight: 500,
              borderBottom: `2px solid ${activeTab === tab.id ? "#2563EB" : "transparent"}`,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto" }}>
        {error && (
          <div
            style={{
              padding: "16px",
              backgroundColor: "#FEE2E2",
              border: "1px solid #EF4444",
              borderRadius: "8px",
              color: "#991B1B",
              marginBottom: "24px",
            }}
          >
            {error}
          </div>
        )}

        {loading && (
          <div
            style={{ textAlign: "center", padding: "48px", color: "#6B7280" }}
          >
            Loading...
          </div>
        )}

        {!loading && activeTab === "accounts" && (
          <>
            {/* Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              {[
                {
                  label: "Total Accounts",
                  value: stats.totalAccounts,
                  color: "#2563EB",
                },
                {
                  label: "Active",
                  value: stats.activeAccounts,
                  color: "#10B981",
                },
                { label: "Assets", value: stats.assets, color: "#8B5CF6" },
                {
                  label: "Liabilities",
                  value: stats.liabilities,
                  color: "#F59E0B",
                },
                { label: "Equity", value: stats.equity, color: "#EF4444" },
                { label: "Revenue", value: stats.revenue, color: "#06B6D4" },
                { label: "Expenses", value: stats.expenses, color: "#EC4899" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    backgroundColor: "#FFFFFF",
                    padding: "20px",
                    borderRadius: "12px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6B7280",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: "28px",
                      fontWeight: 700,
                      color: stat.color,
                    }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: "24px", position: "relative" }}>
              <input
                type="text"
                placeholder="Search accounts by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  paddingRight: searchQuery ? "40px" : "16px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#6B7280",
                    fontSize: "18px",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {/* Accounts Table */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#1F2937",
                    margin: 0,
                  }}
                >
                  Accounts ({filteredAccounts.length})
                </h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "1800px",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#F9FAFB" }}>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Code
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Name
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Description
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Type
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Normal Balance
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Parent ID
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Level
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Currency
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Balance
                      </th>
                      {/* <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        TigerBeetle ID
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        TB Ledger
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        TB Code
                      </th> */}
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        CBN Code
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Status
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        System
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Created
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => (
                      <tr
                        key={account.id}
                        style={{
                          borderBottom: "1px solid #E5E7EB",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedAccount(account)}
                      >
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                            fontFamily: "monospace",
                          }}
                        >
                          {account.code}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          {account.name}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#6B7280",
                            maxWidth: "200px",
                          }}
                        >
                          {account.description || "-"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "14px" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor: getTypeBgColor(account.type),
                              color: getTypeColor(account.type),
                            }}
                          >
                            {account.type}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor:
                                account.normal_balance === "debit"
                                  ? "#DBEAFE"
                                  : "#FEF3C7",
                              color:
                                account.normal_balance === "debit"
                                  ? "#1E40AF"
                                  : "#92400E",
                            }}
                          >
                            {account.normal_balance}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "12px",
                            color: "#6B7280",
                            fontFamily: "monospace",
                          }}
                        >
                          {account.parent_id
                            ? account.parent_id.substring(0, 8) + "..."
                            : "-"}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          {account.level}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                            fontWeight: 600,
                          }}
                        >
                          {account.currency}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                            fontWeight: 600,
                          }}
                        >
                          {account.current_balance !== undefined
                            ? formatCurrency(account.current_balance, account.currency)
                            : "-"}
                        </td>
                        {/* <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "12px",
                            color: "#6B7280",
                            fontFamily: "monospace",
                          }}
                        >
                          {account.tigerbeetle_id || "-"}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          {account.tigerbeetle_ledger}
                        </td> */}
                        {/* <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                            fontFamily: "monospace",
                          }}
                        >
                          {account.tigerbeetle_code}
                        </td> */}
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          {account.cbn_code || "-"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "14px" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor: account.is_active
                                ? "#D1FAE5"
                                : "#FEE2E2",
                              color: account.is_active ? "#065F46" : "#991B1B",
                            }}
                          >
                            {account.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#6B7280",
                          }}
                        >
                          {account.is_system_account ? "Yes" : "No"}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "12px",
                            color: "#6B7280",
                          }}
                        >
                          {formatDate(account.created_at)}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "12px",
                            color: "#6B7280",
                          }}
                        >
                          {formatDate(account.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!loading && activeTab === "hierarchy" && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#1F2937",
                marginBottom: "16px",
              }}
            >
              Account Hierarchy
            </h3>
            {hierarchy.length === 0 ? (
              <p
                style={{
                  color: "#6B7280",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                No hierarchy data available
              </p>
            ) : (
              hierarchy.map((node) => (
                <AccountTreeNode
                  key={node.account.id}
                  node={node}
                  level={0}
                  onSelect={setSelectedAccount}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                />
              ))
            )}
          </div>
        )}

        {!loading && activeTab === "trial-balance" && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#1F2937",
                marginBottom: "16px",
              }}
            >
              Trial Balance
            </h3>
            {!trialBalance ? (
              <p
                style={{
                  color: "#6B7280",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                No trial balance data available
              </p>
            ) : (
              <>
                <p style={{ color: "#6B7280", marginBottom: "16px" }}>
                  As of: {formatDate(trialBalance.as_of_date)}
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F9FAFB" }}>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Account
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Debit
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.accounts.map((line) => (
                      <tr
                        key={line.account_code}
                        style={{ borderBottom: "1px solid #E5E7EB" }}
                      >
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          {line.account_code} - {line.account_name}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontSize: "14px",
                            color: "#1F2937",
                            fontFamily: "monospace",
                          }}
                        >
                          {line.debit_balance > 0
                            ? formatCurrency(line.debit_balance)
                            : "-"}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontSize: "14px",
                            color: "#1F2937",
                            fontFamily: "monospace",
                          }}
                        >
                          {line.credit_balance > 0
                            ? formatCurrency(line.credit_balance)
                            : "-"}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: "#F9FAFB", fontWeight: 600 }}>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: "14px",
                          color: "#1F2937",
                        }}
                      >
                        Total
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontSize: "14px",
                          color: "#1F2937",
                          fontFamily: "monospace",
                        }}
                      >
                        {formatCurrency(trialBalance.total_debits)}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontSize: "14px",
                          color: "#1F2937",
                          fontFamily: "monospace",
                        }}
                      >
                        {formatCurrency(trialBalance.total_credits)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    backgroundColor: trialBalance.is_balanced
                      ? "#D1FAE5"
                      : "#FEE2E2",
                    borderRadius: "8px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: trialBalance.is_balanced ? "#065F46" : "#991B1B",
                      fontWeight: 600,
                    }}
                  >
                    {trialBalance.is_balanced ? "✓ Balanced" : "✗ Not Balanced"}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && activeTab === "balance-sheet" && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#1F2937",
                marginBottom: "16px",
              }}
            >
              Balance Sheet
            </h3>
            {!balanceSheet ? (
              <p
                style={{
                  color: "#6B7280",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                No balance sheet data available
              </p>
            ) : (
              <>
                <p style={{ color: "#6B7280", marginBottom: "16px" }}>
                  As of: {formatDate(balanceSheet.as_of_date)}
                </p>

                <BalanceSheetSection section={balanceSheet.assets} />
                <BalanceSheetSection section={balanceSheet.liabilities} />
                <BalanceSheetSection section={balanceSheet.equity} />

                <div
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Total Assets:</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                      {formatCurrency(balanceSheet.total_assets)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Total Liabilities:</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                      {formatCurrency(balanceSheet.total_liabilities)}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ fontWeight: 600 }}>Total Equity:</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                      {formatCurrency(balanceSheet.total_equity)}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      backgroundColor: balanceSheet.is_balanced
                        ? "#D1FAE5"
                        : "#FEE2E2",
                      borderRadius: "8px",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: balanceSheet.is_balanced ? "#065F46" : "#991B1B",
                        fontWeight: 600,
                      }}
                    >
                      {balanceSheet.is_balanced
                        ? "✓ Balanced (Assets = Liabilities + Equity)"
                        : "✗ Not Balanced"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && activeTab === "income-statement" && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#1F2937",
                marginBottom: "16px",
              }}
            >
              Income Statement
            </h3>
            {!incomeStatement ? (
              <p
                style={{
                  color: "#6B7280",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                No income statement data available
              </p>
            ) : (
              <>
                <p style={{ color: "#6B7280", marginBottom: "16px" }}>
                  Period: {formatDate(incomeStatement.start_date)} to{" "}
                  {formatDate(incomeStatement.end_date)}
                </p>

                <IncomeStatementSection section={incomeStatement.revenue} />
                <IncomeStatementSection section={incomeStatement.expenses} />

                <div
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Total Revenue:</span>
                    <span
                      style={{
                        fontWeight: 600,
                        fontFamily: "monospace",
                        color: "#10B981",
                      }}
                    >
                      {formatCurrency(incomeStatement.total_revenue)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Total Expenses:</span>
                    <span
                      style={{
                        fontWeight: 600,
                        fontFamily: "monospace",
                        color: "#EF4444",
                      }}
                    >
                      {formatCurrency(incomeStatement.total_expenses)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: "12px",
                      borderTop: "2px solid #E5E7EB",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "16px" }}>
                      Net Income:
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "16px",
                        fontFamily: "monospace",
                        color:
                          incomeStatement.net_income >= 0
                            ? "#10B981"
                            : "#EF4444",
                      }}
                    >
                      {formatCurrency(incomeStatement.net_income)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && activeTab === "reconciliation" && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#1F2937",
                  margin: 0,
                }}
              >
                Reconciliation Status
              </h3>
              {canManageAccounts(userRole) && (
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await reconciliationApi.reconcileWithTigerBeetle(
                        tenantId,
                        userRole,
                      );
                      loadReconciliationStatus();
                      alert("Reconciliation completed");
                    } catch (err: any) {
                      alert(
                        err.response?.data?.message || "Reconciliation failed",
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#2563EB",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Reconcile with TigerBeetle
                </button>
              )}
            </div>
            {!reconciliationStatus ? (
              <p
                style={{
                  color: "#6B7280",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                No reconciliation data available
              </p>
            ) : (
              <div
                style={{
                  backgroundColor: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  padding: "24px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6B7280",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        marginBottom: "4px",
                      }}
                    >
                      Tenant ID
                    </div>
                    <div style={{ fontSize: "14px", color: "#1F2937" }}>
                      {reconciliationStatus.tenant_id}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6B7280",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        marginBottom: "4px",
                      }}
                    >
                      Last Reconciliation
                    </div>
                    <div style={{ fontSize: "14px", color: "#1F2937" }}>
                      {reconciliationStatus.last_reconciliation &&
                      reconciliationStatus.last_reconciliation !==
                        "0001-01-01T00:00:00Z"
                        ? formatDate(reconciliationStatus.last_reconciliation)
                        : "Never"}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6B7280",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        marginBottom: "4px",
                      }}
                    >
                      Discrepancies
                    </div>
                    <div style={{ fontSize: "14px", color: "#1F2937" }}>
                      {reconciliationStatus.discrepancy_count}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6B7280",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        marginBottom: "4px",
                      }}
                    >
                      Status
                    </div>
                    <div>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 500,
                          backgroundColor:
                            reconciliationStatus.status === "reconciled"
                              ? "#D1FAE5"
                              : reconciliationStatus.status === "never_run"
                                ? "#FEF3C7"
                                : reconciliationStatus.status === "pending"
                                  ? "#DBEAFE"
                                  : "#FEE2E2",
                          color:
                            reconciliationStatus.status === "reconciled"
                              ? "#065F46"
                              : reconciliationStatus.status === "never_run"
                                ? "#92400E"
                                : reconciliationStatus.status === "pending"
                                  ? "#1E40AF"
                                  : "#991B1B",
                        }}
                      >
                        {reconciliationStatus.status
                          .replace("_", " ")
                          .toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account Mappings Tab */}
      {!loading && activeTab === "mappings" && (
        <div>
          {/* Explanation banner */}
          <div
            style={{
              padding: "16px 20px",
              backgroundColor: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: "10px",
              marginBottom: "24px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "20px" }}>🔗</span>
            <div>
              <div style={{ fontWeight: 600, color: "#1E40AF", marginBottom: "4px" }}>
                What are Account Mappings?
              </div>
              <div style={{ fontSize: "13px", color: "#3B82F6", lineHeight: 1.6 }}>
                Mappings tell the system which of <strong>your</strong> COA accounts to debit/credit for each
                transaction type. Services like Loans and Payments look up these mappings at runtime — so no
                account codes are hardcoded. Each unmapped key means that transaction type will not post a
                journal entry.
              </div>
            </div>
          </div>

          {/* Search + header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1F2937", margin: 0 }}>
              Transaction → Account Mappings
              <span
                style={{
                  marginLeft: "10px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#6B7280",
                  backgroundColor: "#F3F4F6",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                {mappings.length} / {STANDARD_MAPPING_KEYS.length} configured
              </span>
            </h3>
            <input
              style={{
                padding: "8px 12px",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                fontSize: "13px",
                width: "220px",
                outline: "none",
              }}
              placeholder="Filter keys..."
              value={mappingSearch}
              onChange={(e) => setMappingSearch(e.target.value)}
            />
          </div>

          {/* Mappings table */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  {["Mapping Key", "Description / Hint", "Mapped Account", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STANDARD_MAPPING_KEYS.filter(
                  (k) =>
                    !mappingSearch ||
                    k.key.toLowerCase().includes(mappingSearch.toLowerCase()) ||
                    k.label.toLowerCase().includes(mappingSearch.toLowerCase()),
                ).map((stdKey) => {
                  const existing = mappings.find((m) => m.mapping_key === stdKey.key);
                  return (
                    <tr
                      key={stdKey.key}
                      style={{
                        borderBottom: "1px solid #F3F4F6",
                        backgroundColor: existing ? "#FFFFFF" : "#FFFBEB",
                      }}
                    >
                      {/* Key */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "13px",
                            backgroundColor: "#F3F4F6",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            color: "#1F2937",
                          }}
                        >
                          {stdKey.key}
                        </span>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#374151", marginTop: "4px" }}>
                          {stdKey.label}
                        </div>
                      </td>
                      {/* Hint */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#6B7280", maxWidth: "220px" }}>
                        {stdKey.hint}
                      </td>
                      {/* Mapped account */}
                      <td style={{ padding: "14px 16px" }}>
                        {existing ? (
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 500, color: "#1F2937" }}>
                              {existing.account_name || existing.account_id}
                            </div>
                            {existing.account_code && (
                              <div style={{ fontSize: "12px", color: "#6B7280" }}>
                                Code: {existing.account_code}
                              </div>
                            )}
                            {existing.description && (
                              <div style={{ fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>
                                {existing.description}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: "13px", color: "#9CA3AF" }}>— not configured —</span>
                        )}
                      </td>
                      {/* Status badge */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 500,
                            backgroundColor: existing ? "#D1FAE5" : "#FEF3C7",
                            color: existing ? "#065F46" : "#92400E",
                          }}
                        >
                          {existing ? "Configured" : "Missing"}
                        </span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "14px 16px" }}>
                        {canManageAccounts(userRole) && (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              onClick={() =>
                                setMappingModal({
                                  open: true,
                                  key: stdKey.key,
                                  accountId: existing?.account_id ?? "",
                                  description: existing?.description ?? "",
                                  isEdit: !!existing,
                                })
                              }
                              style={{
                                padding: "6px 14px",
                                backgroundColor: existing ? "#F3F4F6" : "#2563EB",
                                color: existing ? "#374151" : "#FFFFFF",
                                border: existing ? "1px solid #E5E7EB" : "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 500,
                                cursor: "pointer",
                              }}
                            >
                              {existing ? "Edit" : "Configure"}
                            </button>
                            {existing && (
                              <button
                                onClick={() => handleDeleteMapping(stdKey.key)}
                                style={{
                                  padding: "6px 14px",
                                  backgroundColor: "#FEE2E2",
                                  color: "#991B1B",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Custom (non-standard) mappings */}
            {mappings.filter((m) => !STANDARD_MAPPING_KEYS.find((k) => k.key === m.mapping_key)).length > 0 && (
              <>
                <div
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "#F9FAFB",
                    borderTop: "1px solid #E5E7EB",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Custom Mappings
                </div>
                {mappings
                  .filter((m) => !STANDARD_MAPPING_KEYS.find((k) => k.key === m.mapping_key))
                  .map((m) => (
                    <div
                      key={m.mapping_key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "14px 16px",
                        borderTop: "1px solid #F3F4F6",
                        gap: "16px",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "13px",
                          backgroundColor: "#F3F4F6",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          flex: 1,
                        }}
                      >
                        {m.mapping_key}
                      </span>
                      <span style={{ fontSize: "13px", color: "#374151", flex: 2 }}>
                        {m.account_name || m.account_id}
                        {m.account_code && (
                          <span style={{ color: "#6B7280" }}> ({m.account_code})</span>
                        )}
                      </span>
                      {canManageAccounts(userRole) && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() =>
                              setMappingModal({
                                open: true,
                                key: m.mapping_key,
                                accountId: m.account_id,
                                description: m.description ?? "",
                                isEdit: true,
                              })
                            }
                            style={{
                              padding: "6px 14px",
                              backgroundColor: "#F3F4F6",
                              color: "#374151",
                              border: "1px solid #E5E7EB",
                              borderRadius: "6px",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMapping(m.mapping_key)}
                            style={{
                              padding: "6px 14px",
                              backgroundColor: "#FEE2E2",
                              color: "#991B1B",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </>
            )}

            {/* Add custom mapping row */}
            {canManageAccounts(userRole) && (
              <div
                style={{
                  padding: "14px 16px",
                  borderTop: "1px solid #E5E7EB",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() =>
                    setMappingModal({ open: true, key: "", accountId: "", description: "", isEdit: false })
                  }
                  style={{
                    padding: "8px 18px",
                    backgroundColor: "#F9FAFB",
                    color: "#374151",
                    border: "1px solid #E5E7EB",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  + Add Custom Mapping
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {mappingModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "28px",
              width: "500px",
              maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1F2937", marginBottom: "6px" }}>
              {mappingModal.isEdit ? "Edit Mapping" : "Configure Mapping"}
            </h3>
            <p style={{ fontSize: "13px", color: "#6B7280", marginBottom: "24px" }}>
              Link a transaction type key to one of this tenant's COA accounts.
            </p>

            {/* Mapping key */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                Mapping Key
              </label>
              {STANDARD_MAPPING_KEYS.find((k) => k.key === mappingModal.key) ? (
                <div
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: "6px",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    color: "#1F2937",
                  }}
                >
                  {mappingModal.key}
                </div>
              ) : (
                <input
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #E5E7EB",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="e.g. loans.interest.custom"
                  value={mappingModal.key}
                  onChange={(e) => setMappingModal({ ...mappingModal, key: e.target.value })}
                />
              )}
              {STANDARD_MAPPING_KEYS.find((k) => k.key === mappingModal.key) && (
                <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>
                  {STANDARD_MAPPING_KEYS.find((k) => k.key === mappingModal.key)?.hint}
                </div>
              )}
            </div>

            {/* Account selector */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                COA Account
              </label>
              <select
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "13px",
                  outline: "none",
                  backgroundColor: "#FFFFFF",
                }}
                value={mappingModal.accountId}
                onChange={(e) => setMappingModal({ ...mappingModal, accountId: e.target.value })}
              >
                <option value="">— Select an account —</option>
                {["asset", "liability", "equity", "revenue", "expense"].map((type) => {
                  const group = accounts.filter((a) => a.type === type && a.is_active);
                  if (!group.length) return null;
                  return (
                    <optgroup key={type} label={type.toUpperCase()}>
                      {group.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            {/* Description */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                Description <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span>
              </label>
              <input
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                placeholder="e.g. Main nostro account at Access Bank"
                value={mappingModal.description}
                onChange={(e) => setMappingModal({ ...mappingModal, description: e.target.value })}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => setMappingModal({ open: false, key: "", accountId: "", description: "", isEdit: false })}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#F3F4F6",
                  color: "#374151",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Journal Entries Tab ─────────────────────────────────────────────── */}
      {!loading && activeTab === "journal-entries" && (
        <div>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1F2937", margin: 0 }}>Journal Entries</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                placeholder="Search entries..."
                value={jeSearch}
                onChange={(e) => setJeSearch(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none", width: "200px" }}
              />
              <select
                value={jeFilter}
                onChange={(e) => setJeFilter(e.target.value as any)}
                style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none", backgroundColor: "#fff" }}
              >
                {["all", "draft", "pending", "posted", "rejected", "reversed"].map((s) => (
                  <option key={s} value={s}>{s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {canManageAccounts(userRole) && (
                <button
                  onClick={() => setCreateJEModal(true)}
                  style={{ padding: "8px 16px", backgroundColor: "#2563EB", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  + New Entry
                </button>
              )}
            </div>
          </div>

          {/* Investment / Fixed Asset notice */}
          <div style={{ padding: "12px 16px", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", color: "#92400E" }}>
            <strong>Investment &amp; Fixed Asset Accounts (1500–1600):</strong> Use journal entries to record bond purchases,
            asset acquisitions, depreciation, and equity investments. These accounts are not automated — create entries manually below.
          </div>

          {/* Quick templates */}
          {canManageAccounts(userRole) && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
              {[
                { key: "bond",        label: "Bond Purchase",      desc: "Purchase of government/corporate bond", hint1: "Investment Securities (1500s) — DR", hint2: "Cash / Nostro (1000s) — CR" },
                { key: "asset",       label: "Asset Acquisition",  desc: "Acquisition of fixed asset",            hint1: "Fixed Assets (1600s) — DR",          hint2: "Cash / Payables — CR" },
                { key: "depreciation",label: "Depreciation",       desc: "Monthly depreciation charge",           hint1: "Depreciation Expense — DR",          hint2: "Accumulated Depreciation (1600s) — CR" },
                { key: "equity",      label: "Equity Investment",  desc: "Equity investment in subsidiary",        hint1: "Equity Investment (1550s) — DR",      hint2: "Cash / Nostro (1000s) — CR" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setJeTemplate(t.key);
                    setNewJE({
                      description: t.desc,
                      reference: "",
                      date: new Date().toISOString().slice(0, 10),
                      lines: [
                        { account_id: "", debit_amount: 0, credit_amount: 0, description: t.hint1 },
                        { account_id: "", debit_amount: 0, credit_amount: 0, description: t.hint2 },
                      ],
                    });
                    setCreateJEModal(true);
                  }}
                  style={{ padding: "6px 14px", border: "1px solid #D1D5DB", borderRadius: "6px", fontSize: "12px", fontWeight: 500, backgroundColor: "#F9FAFB", cursor: "pointer", color: "#374151" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Entries table */}
          <div style={{ backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  {["Entry #", "Date", "Description", "Reference", "Total Debit", "Status", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(journalEntries || [])
                  .filter((e) => jeFilter === "all" || e.status === jeFilter)
                  .filter((e) => !jeSearch || e.description?.toLowerCase().includes(jeSearch.toLowerCase()) || e.entry_number?.toLowerCase().includes(jeSearch.toLowerCase()) || e.reference?.toLowerCase().includes(jeSearch.toLowerCase()))
                  .map((entry, idx) => {
                    const statusColors: Record<string, { bg: string; text: string }> = {
                      draft: { bg: "#F3F4F6", text: "#374151" },
                      pending: { bg: "#FEF3C7", text: "#92400E" },
                      posted: { bg: "#D1FAE5", text: "#065F46" },
                      rejected: { bg: "#FEE2E2", text: "#991B1B" },
                      reversed: { bg: "#EDE9FE", text: "#5B21B6" },
                    };
                    const sc = statusColors[entry.status] || statusColors.draft;
                    return (
                      <tr key={entry.id} style={{ borderBottom: "1px solid #F3F4F6", backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontFamily: "monospace", color: "#1F2937" }}>{entry.entry_number || "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#6B7280" }}>{entry.entry_date ? formatDate(entry.entry_date) : "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1F2937", maxWidth: "280px" }}>{entry.description}</td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#6B7280", fontFamily: "monospace" }}>{entry.reference || "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1F2937" }}>{formatCurrency(entry.total_debit || 0)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, backgroundColor: sc.bg, color: sc.text }}>
                            {entry.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              onClick={async () => {
                                try {
                                  const detail = await approvalsApi.getJournalWithApproval(tenantId, entry.id);
                                  setSelectedEntry(detail);
                                  setEntryDetailOpen(true);
                                } catch { setSelectedEntry({ ...entry, requires_approval: false, can_approve: false, can_reject: false }); setEntryDetailOpen(true); }
                              }}
                              style={{ padding: "4px 10px", border: "1px solid #E5E7EB", borderRadius: "4px", fontSize: "12px", cursor: "pointer", backgroundColor: "#fff" }}
                            >View</button>
                            {entry.status === "draft" && canManageAccounts(userRole) && (
                              <button
                                onClick={() => handleSubmitForApproval(entry.id)}
                                style={{ padding: "4px 10px", border: "1px solid #BFDBFE", borderRadius: "4px", fontSize: "12px", cursor: "pointer", backgroundColor: "#EFF6FF", color: "#1D4ED8" }}
                              >Submit</button>
                            )}
                            {entry.status === "posted" && canManageAccounts(userRole) && (
                              <button
                                onClick={async () => {
                                  const reason = prompt("Reversal reason:");
                                  if (!reason) return;
                                  try { await journalEntriesApi.reverseJournalEntry(entry.id, reason, tenantId, userRole); loadJournalEntries(); } catch (e: any) { alert(e.message); }
                                }}
                                style={{ padding: "4px 10px", border: "1px solid #FCA5A5", borderRadius: "4px", fontSize: "12px", cursor: "pointer", backgroundColor: "#FEF2F2", color: "#DC2626" }}
                              >Reverse</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {journalEntries.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "14px" }}>No journal entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Journal Entry Detail Modal */}
      {entryDetailOpen && selectedEntry && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "28px", width: "640px", maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Journal Entry — {selectedEntry.entry_number || selectedEntry.id.slice(0, 8)}</h3>
              <button onClick={() => setEntryDetailOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6B7280" }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              {[["Description", selectedEntry.description], ["Date", selectedEntry.entry_date ? formatDate(selectedEntry.entry_date) : "—"], ["Reference", selectedEntry.reference || "—"], ["Status", selectedEntry.status], ["Total Debit", formatCurrency(selectedEntry.total_debit || 0)], ["Total Credit", formatCurrency(selectedEntry.total_credit || 0)]].map(([k, v]) => (
                <div key={k as string}><div style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase" }}>{k}</div><div style={{ fontSize: "14px", color: "#1F2937", marginTop: "2px" }}>{v}</div></div>
              ))}
            </div>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#6B7280", marginBottom: "8px", textTransform: "uppercase" }}>Lines</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ backgroundColor: "#F9FAFB" }}>{["Account", "Description", "Debit", "Credit"].map((h) => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#6B7280", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {(selectedEntry.lines || []).map((l, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "8px 12px" }}>{l.account_code} — {l.account_name}</td>
                      <td style={{ padding: "8px 12px", color: "#6B7280" }}>{l.description || "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{l.debit_amount > 0 ? formatCurrency(l.debit_amount) : "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{l.credit_amount > 0 ? formatCurrency(l.credit_amount) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedEntry.requires_approval && selectedEntry.approval_request && (
              <div style={{ padding: "12px 16px", backgroundColor: "#FEF3C7", borderRadius: "8px", marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, color: "#92400E", marginBottom: "4px" }}>Awaiting Approval — step {selectedEntry.approval_request.current_step}</div>
                <div style={{ fontSize: "12px", color: "#B45309" }}>Requested by {selectedEntry.approval_request.requested_by}</div>
                {selectedEntry.can_approve && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                    <button onClick={async () => { await handleApprove(selectedEntry.approval_request!.id); setEntryDetailOpen(false); }} style={{ padding: "6px 16px", backgroundColor: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Approve</button>
                    <button onClick={() => { setRejectModal({ open: true, requestId: selectedEntry.approval_request!.id }); setEntryDetailOpen(false); }} style={{ padding: "6px 16px", backgroundColor: "#DC2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Reject</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "28px", width: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Reject Approval Request</h3>
            <textarea
              placeholder="Reason for rejection (required)"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", minHeight: "80px", outline: "none", boxSizing: "border-box", resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button onClick={() => setRejectModal({ open: false, requestId: "" })} style={{ padding: "8px 16px", border: "1px solid #E5E7EB", borderRadius: "6px", cursor: "pointer", backgroundColor: "#F3F4F6" }}>Cancel</button>
              <button onClick={handleReject} style={{ padding: "8px 16px", backgroundColor: "#DC2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Create JE Modal */}
      {createJEModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", paddingTop: "40px", paddingBottom: "40px" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "28px", width: "680px", maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
                {jeTemplate ? { bond: "Bond Purchase", asset: "Asset Acquisition", depreciation: "Depreciation", equity: "Equity Investment" }[jeTemplate] || "New Journal Entry" : "New Journal Entry"}
              </h3>
              <button onClick={() => { setCreateJEModal(false); setJeTemplate(""); setNewJE(emptyJE); }} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6B7280" }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>Description *</label>
                <input value={newJE.description} onChange={(e) => setNewJE({ ...newJE, description: e.target.value })} placeholder="e.g. Purchase of 10-year FGN Bond" style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>Date</label>
                <input type="date" value={newJE.date} onChange={(e) => setNewJE({ ...newJE, date: e.target.value })} style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>Reference</label>
                <input value={newJE.reference} onChange={(e) => setNewJE({ ...newJE, reference: e.target.value })} placeholder="e.g. BOND-2026-001" style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Journal Lines</label>
                <button
                  onClick={() => setNewJE({ ...newJE, lines: [...newJE.lines, { account_id: "", debit_amount: 0, credit_amount: 0, description: "" }] })}
                  style={{ padding: "4px 12px", border: "1px solid #D1D5DB", borderRadius: "4px", fontSize: "12px", cursor: "pointer", backgroundColor: "#F9FAFB" }}
                >+ Add Line</button>
              </div>
              {newJE.lines.map((line, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr auto", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <select
                    value={line.account_id}
                    onChange={(e) => { const lines = [...newJE.lines]; lines[i] = { ...lines[i], account_id: e.target.value }; setNewJE({ ...newJE, lines }); }}
                    style={{ padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "12px", outline: "none", backgroundColor: "#fff" }}
                  >
                    <option value="">— Select Account —</option>
                    {["asset", "liability", "equity", "revenue", "expense"].map((type) => {
                      const group = accounts.filter((a) => a.type === type && a.is_active);
                      if (!group.length) return null;
                      return (
                        <optgroup key={type} label={type.toUpperCase()}>
                          {group.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </optgroup>
                      );
                    })}
                  </select>
                  <input
                    type="number" min={0} placeholder="Debit"
                    value={line.debit_amount || ""}
                    onChange={(e) => { const lines = [...newJE.lines]; lines[i] = { ...lines[i], debit_amount: parseFloat(e.target.value) || 0, credit_amount: 0 }; setNewJE({ ...newJE, lines }); }}
                    style={{ padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "12px", outline: "none" }}
                  />
                  <input
                    type="number" min={0} placeholder="Credit"
                    value={line.credit_amount || ""}
                    onChange={(e) => { const lines = [...newJE.lines]; lines[i] = { ...lines[i], credit_amount: parseFloat(e.target.value) || 0, debit_amount: 0 }; setNewJE({ ...newJE, lines }); }}
                    style={{ padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "12px", outline: "none" }}
                  />
                  {newJE.lines.length > 2 && (
                    <button onClick={() => { const lines = newJE.lines.filter((_, idx) => idx !== i); setNewJE({ ...newJE, lines }); }} style={{ padding: "6px 8px", border: "none", borderRadius: "4px", backgroundColor: "#FEE2E2", color: "#DC2626", cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>×</button>
                  )}
                </div>
              ))}
              <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>
                Total Debit: <strong>{formatCurrency(newJE.lines.reduce((s, l) => s + (l.debit_amount || 0), 0))}</strong>
                {" "} | Total Credit: <strong>{formatCurrency(newJE.lines.reduce((s, l) => s + (l.credit_amount || 0), 0))}</strong>
                {newJE.lines.reduce((s, l) => s + (l.debit_amount || 0), 0) !== newJE.lines.reduce((s, l) => s + (l.credit_amount || 0), 0) && (
                  <span style={{ color: "#DC2626", marginLeft: "8px" }}>NOT BALANCED</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => { setCreateJEModal(false); setJeTemplate(""); setNewJE(emptyJE); }} style={{ padding: "10px 20px", border: "1px solid #E5E7EB", borderRadius: "8px", cursor: "pointer", backgroundColor: "#F3F4F6", fontSize: "14px" }}>Cancel</button>
              <button onClick={handleCreateJournalEntry} disabled={jeSubmitting} style={{ padding: "10px 20px", backgroundColor: "#2563EB", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontSize: "14px", opacity: jeSubmitting ? 0.7 : 1 }}>
                {jeSubmitting ? "Saving..." : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approvals Tab ────────────────────────────────────────────────────── */}
      {!loading && activeTab === "approvals" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1F2937", margin: 0 }}>Approval Workflows &amp; Requests</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <select value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value as any)} style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none", backgroundColor: "#fff" }}>
                <option value="">All requests</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              {canManageAccounts(userRole) && (
                <button
                  onClick={async () => { try { await approvalsApi.createDefaultWorkflows(tenantId, userRole); loadApprovals(); alert("Default workflows created"); } catch (e: any) { alert(e.message); } }}
                  style={{ padding: "8px 16px", backgroundColor: "#7C3AED", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >Setup Default Workflows</button>
              )}
            </div>
          </div>

          {/* Workflows */}
          <h4 style={{ fontSize: "15px", fontWeight: 600, color: "#374151", marginBottom: "12px" }}>Workflows ({approvalWorkflows.length})</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px", marginBottom: "24px" }}>
            {approvalWorkflows.map((wf) => (
              <div key={wf.id} style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1F2937" }}>{wf.name}</div>
                  <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", backgroundColor: wf.is_active ? "#D1FAE5" : "#F3F4F6", color: wf.is_active ? "#065F46" : "#6B7280" }}>{wf.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div style={{ fontSize: "12px", color: "#6B7280", marginBottom: "8px" }}>Entity: {wf.entity_type} · {wf.steps.length} step{wf.steps.length !== 1 ? "s" : ""}</div>
                {(wf.min_amount || wf.max_amount) && (
                  <div style={{ fontSize: "12px", color: "#6B7280" }}>
                    Amount: {wf.min_amount ? formatCurrency(wf.min_amount) : "0"} – {wf.max_amount ? formatCurrency(wf.max_amount) : "∞"}
                  </div>
                )}
                <div style={{ marginTop: "10px" }}>
                  {wf.steps.map((s, i) => (
                    <div key={i} style={{ fontSize: "12px", color: "#374151", padding: "4px 0", borderTop: i > 0 ? "1px solid #F3F4F6" : "none" }}>
                      Step {s.step_order}: <strong>{s.approver_role}</strong>{s.is_mandatory ? " (required)" : " (optional)"}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {approvalWorkflows.length === 0 && (
              <div style={{ gridColumn: "span 3", padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: "14px", backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #E5E7EB" }}>
                No workflows configured. Click "Setup Default Workflows" to create standard approval chains.
              </div>
            )}
          </div>

          {/* Approval Requests */}
          <h4 style={{ fontSize: "15px", fontWeight: 600, color: "#374151", marginBottom: "12px" }}>Approval Requests</h4>
          <div style={{ backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  {["Entity", "Entity ID", "Step", "Status", "Requested By", "Requested At", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {approvalRequests.map((req, idx) => {
                  const sc = { pending: { bg: "#FEF3C7", text: "#92400E" }, approved: { bg: "#D1FAE5", text: "#065F46" }, rejected: { bg: "#FEE2E2", text: "#991B1B" }, canceled: { bg: "#F3F4F6", text: "#6B7280" } }[req.status] || { bg: "#F3F4F6", text: "#6B7280" };
                  return (
                    <tr key={req.id} style={{ borderBottom: "1px solid #F3F4F6", backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#374151" }}>{req.entity_type}</td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", fontFamily: "monospace", color: "#6B7280" }}>{req.entity_id.slice(0, 12)}…</td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#374151", textAlign: "center" }}>{req.current_step}</td>
                      <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, backgroundColor: sc.bg, color: sc.text }}>{req.status}</span></td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#6B7280" }}>{req.requested_by.slice(0, 16)}…</td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "#6B7280" }}>{formatDate(req.requested_at)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {req.status === "pending" && canManageAccounts(userRole) && (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={() => handleApprove(req.id)} style={{ padding: "4px 10px", backgroundColor: "#059669", color: "#fff", border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>Approve</button>
                            <button onClick={() => setRejectModal({ open: true, requestId: req.id })} style={{ padding: "4px 10px", backgroundColor: "#DC2626", color: "#fff", border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {approvalRequests.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "14px" }}>No approval requests</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Periods Tab ──────────────────────────────────────────────────────── */}
      {!loading && activeTab === "periods" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1F2937", margin: 0 }}>Accounting Periods</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "13px", color: "#6B7280" }}>Fiscal Year</label>
                <input type="number" value={periodFiscalYear} onChange={(e) => setPeriodFiscalYear(parseInt(e.target.value))} style={{ width: "80px", padding: "6px 10px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none" }} />
              </div>
            </div>
            {canManageAccounts(userRole) && (
              <button onClick={() => setCreateFYModal(true)} style={{ padding: "8px 16px", backgroundColor: "#2563EB", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                + Create Fiscal Year
              </button>
            )}
          </div>

          {/* Period status legend */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
            {[["open", "#D1FAE5", "#065F46"], ["soft_closed", "#FEF3C7", "#92400E"], ["hard_closed", "#FEE2E2", "#991B1B"], ["locked", "#EDE9FE", "#5B21B6"]].map(([s, bg, text]) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#374151" }}>
                <span style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: bg, border: `1px solid ${text}20`, display: "inline-block" }} />
                {s.replace("_", " ")}
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  {["Period", "Type", "Start", "End", "Status", "Closed By", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p, idx) => {
                  const sc = { open: { bg: "#D1FAE5", text: "#065F46" }, soft_closed: { bg: "#FEF3C7", text: "#92400E" }, hard_closed: { bg: "#FEE2E2", text: "#991B1B" }, locked: { bg: "#EDE9FE", text: "#5B21B6" } }[p.status] || { bg: "#F3F4F6", text: "#6B7280" };
                  const isProcessing = periodActionLoading === p.id;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #F3F4F6", backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 500, color: "#1F2937" }}>{p.name}{p.is_adjustment_period && <span style={{ marginLeft: "6px", fontSize: "10px", backgroundColor: "#EDE9FE", color: "#5B21B6", padding: "1px 6px", borderRadius: "8px" }}>ADJ</span>}</td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "#6B7280" }}>{p.period_type}</td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "#6B7280" }}>{formatDate(p.start_date)}</td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "#6B7280" }}>{formatDate(p.end_date)}</td>
                      <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, backgroundColor: sc.bg, color: sc.text }}>{p.status.replace("_", " ")}</span></td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "#6B7280" }}>{p.closed_by || "—"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {canManageAccounts(userRole) && (
                          <div style={{ display: "flex", gap: "6px" }}>
                            {p.status === "open" && <button disabled={isProcessing} onClick={() => handlePeriodAction(p.id, "soft-close")} style={{ padding: "4px 8px", border: "1px solid #FCD34D", borderRadius: "4px", fontSize: "11px", cursor: "pointer", backgroundColor: "#FFFBEB", color: "#92400E" }}>Soft Close</button>}
                            {p.status === "soft_closed" && <button disabled={isProcessing} onClick={() => handlePeriodAction(p.id, "hard-close")} style={{ padding: "4px 8px", border: "1px solid #FCA5A5", borderRadius: "4px", fontSize: "11px", cursor: "pointer", backgroundColor: "#FEF2F2", color: "#DC2626" }}>Hard Close</button>}
                            {p.status === "hard_closed" && <button disabled={isProcessing} onClick={() => handlePeriodAction(p.id, "lock")} style={{ padding: "4px 8px", border: "1px solid #C4B5FD", borderRadius: "4px", fontSize: "11px", cursor: "pointer", backgroundColor: "#EDE9FE", color: "#5B21B6" }}>Lock</button>}
                            {["soft_closed", "hard_closed"].includes(p.status) && <button disabled={isProcessing} onClick={() => { const r = prompt("Reason for reopening:"); if (r) handlePeriodAction(p.id, "reopen", r); }} style={{ padding: "4px 8px", border: "1px solid #D1D5DB", borderRadius: "4px", fontSize: "11px", cursor: "pointer", backgroundColor: "#F9FAFB" }}>Reopen</button>}
                            {isProcessing && <span style={{ fontSize: "11px", color: "#6B7280" }}>...</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {periods.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "14px" }}>No periods found for FY{periodFiscalYear}. Create a fiscal year to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Fiscal Year Modal */}
      {createFYModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "28px", width: "400px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>Create Fiscal Year</h3>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>Year</label>
              <input type="number" value={newFYYear} onChange={(e) => setNewFYYear(parseInt(e.target.value))} style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>Fiscal Year Start Month</label>
              <select value={newFYStartMonth} onChange={(e) => setNewFYStartMonth(parseInt(e.target.value))} style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none", backgroundColor: "#fff" }}>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "6px" }}>This will create 12 monthly periods + 1 adjustment period (13 total)</p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => setCreateFYModal(false)} style={{ padding: "10px 20px", border: "1px solid #E5E7EB", borderRadius: "8px", cursor: "pointer", backgroundColor: "#F3F4F6" }}>Cancel</button>
              <button onClick={handleCreateFiscalYear} style={{ padding: "10px 20px", backgroundColor: "#2563EB", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CBN Reports Tab ──────────────────────────────────────────────────── */}
      {!loading && activeTab === "cbn" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1F2937", margin: 0 }}>CBN Regulatory Reports</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "13px", color: "#6B7280" }}>As of date</label>
              <input type="date" value={cbnReportDate} onChange={(e) => setCbnReportDate(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", outline: "none" }} />
            </div>
          </div>

          <div style={{ padding: "12px 16px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", marginBottom: "20px", fontSize: "13px", color: "#1E40AF" }}>
            These reports are generated from your live Chart of Accounts balances and are formatted for CBN regulatory submissions.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px", marginBottom: "28px" }}>
            {cbnReportTypes.map((rt) => (
              <div key={rt.type} style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "18px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "#1F2937", marginBottom: "6px" }}>{rt.name}</div>
                <div style={{ fontSize: "12px", color: "#6B7280", marginBottom: "8px", lineHeight: 1.5 }}>{rt.description}</div>
                <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "14px" }}>Frequency: {rt.frequency}</div>
                <button
                  onClick={() => handleGenerateCBNReport(rt.type)}
                  disabled={cbnReportLoading}
                  style={{ padding: "7px 14px", backgroundColor: "#1D4ED8", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", opacity: cbnReportLoading ? 0.7 : 1 }}
                >
                  {cbnReportLoading ? "Generating..." : "Generate Report"}
                </button>
              </div>
            ))}
            {cbnReportTypes.length === 0 && (
              <div style={{ gridColumn: "span 3", padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "14px", backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #E5E7EB" }}>
                Loading report types...
              </div>
            )}
          </div>

          {cbnReport && (
            <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h4 style={{ fontSize: "16px", fontWeight: 700, color: "#1F2937", margin: 0 }}>Report Output</h4>
                <button onClick={() => setCbnReport(null)} style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", fontSize: "18px" }}>×</button>
              </div>
              <pre style={{ fontSize: "12px", fontFamily: "monospace", backgroundColor: "#F9FAFB", padding: "16px", borderRadius: "6px", overflow: "auto", maxHeight: "400px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {JSON.stringify(cbnReport, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateModal && canManageAccounts(userRole) && (
        <CreateAccountModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateAccount}
          accounts={accounts}
        />
      )}
    </div>
  );
};

// Helper components
const AccountTreeNode: React.FC<{
  node: AccountHierarchyNode;
  level: number;
  onSelect: (account: Account) => void;
  expandedNodes: Set<string>;
  toggleExpand: (id: string) => void;
}> = ({ node, level, onSelect, expandedNodes, toggleExpand }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.account.id);

  return (
    <div style={{ marginLeft: level * 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          cursor: "pointer",
          borderRadius: "6px",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "#F3F4F6")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        <span
          style={{
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "8px",
            cursor: "pointer",
          }}
          onClick={() => hasChildren && toggleExpand(node.account.id)}
        >
          {hasChildren ? (isExpanded ? "▼" : "▶") : ""}
        </span>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: getTypeBgColor(node.account.type),
            color: getTypeColor(node.account.type),
            marginRight: "8px",
          }}
        >
          {node.account.code}
        </span>
        <span
          style={{ flex: 1, cursor: "pointer" }}
          onClick={() => onSelect(node.account)}
        >
          {node.account.name}
        </span>
        <span
          style={{
            fontWeight: 600,
            color: node.balance >= 0 ? "#10B981" : "#EF4444",
          }}
        >
          {formatCurrency(node.balance)}
        </span>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <AccountTreeNode
              key={child.account.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const BalanceSheetSection: React.FC<{
  section: { name: string; items: any[]; subtotal: number };
}> = ({ section }) => (
  <div style={{ marginBottom: "24px" }}>
    <h4
      style={{
        fontSize: "14px",
        fontWeight: 600,
        color: "#1F2937",
        marginBottom: "12px",
        textTransform: "uppercase",
      }}
    >
      {section.name}
    </h4>
    {section.items.map((item) => (
      <div
        key={item.account_code}
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 16px",
          paddingLeft: item.level * 20,
        }}
      >
        <span style={{ color: "#6B7280" }}>
          {item.account_code} - {item.account_name}
        </span>
        <span style={{ fontFamily: "monospace" }}>
          {formatCurrency(item.balance)}
        </span>
      </div>
    ))}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "12px 16px",
        marginTop: "8px",
        backgroundColor: "#F9FAFB",
        fontWeight: 600,
      }}
    >
      <span>Total {section.name}</span>
      <span style={{ fontFamily: "monospace" }}>
        {formatCurrency(section.subtotal)}
      </span>
    </div>
  </div>
);

const IncomeStatementSection: React.FC<{
  section: { name: string; items: any[]; subtotal: number };
}> = ({ section }) => (
  <div style={{ marginBottom: "24px" }}>
    <h4
      style={{
        fontSize: "14px",
        fontWeight: 600,
        color: "#1F2937",
        marginBottom: "12px",
        textTransform: "uppercase",
      }}
    >
      {section.name}
    </h4>
    {section.items.map((item) => (
      <div
        key={item.account_code}
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 16px",
          paddingLeft: item.level * 20,
        }}
      >
        <span style={{ color: "#6B7280" }}>
          {item.account_code} - {item.account_name}
        </span>
        <span style={{ fontFamily: "monospace" }}>
          {formatCurrency(item.amount)}
        </span>
      </div>
    ))}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "12px 16px",
        marginTop: "8px",
        backgroundColor: "#F9FAFB",
        fontWeight: 600,
      }}
    >
      <span>Total {section.name}</span>
      <span style={{ fontFamily: "monospace" }}>
        {formatCurrency(section.subtotal)}
      </span>
    </div>
  </div>
);

const CreateAccountModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (account: any) => void;
  accounts: Account[];
}> = ({ isOpen, onClose, onSubmit, accounts }) => {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    type: "asset" as AccountType,
    parent_id: "",
    currency: "NGN",
    cbn_code: "",
    tags: "",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = formData.tags
      ? formData.tags.split(",").map((t) => t.trim())
      : [];
    onSubmit({
      ...formData,
      parent_id: formData.parent_id || undefined,
      cbn_code: formData.cbn_code || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "12px",
          width: "90%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            Create New Account
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#6B7280",
            }}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: "4px",
                }}
              >
                Account Code *
              </label>
              <input
                type="text"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                }}
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="e.g., 1400"
                required
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: "4px",
                }}
              >
                Account Type *
              </label>
              <select
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                }}
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as AccountType,
                  })
                }
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "4px",
              }}
            >
              Account Name *
            </label>
            <input
              type="text"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                fontSize: "14px",
                outline: "none",
              }}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Loans Receivable"
              required
            />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "4px",
              }}
            >
              Parent Account
            </label>
            <select
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                fontSize: "14px",
                outline: "none",
              }}
              value={formData.parent_id}
              onChange={(e) =>
                setFormData({ ...formData, parent_id: e.target.value })
              }
            >
              <option value="">No Parent (Top Level)</option>
              {accounts
                .filter((a) => a.type === formData.type)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "4px",
              }}
            >
              Description
            </label>
            <textarea
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                fontSize: "14px",
                outline: "none",
                minHeight: "80px",
              }}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional description"
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: "4px",
                }}
              >
                Currency
              </label>
              <select
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                }}
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value })
                }
              >
                <option value="NGN">NGN - Nigerian Naira</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: "4px",
                }}
              >
                CBN Code
              </label>
              <input
                type="text"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                }}
                value={formData.cbn_code}
                onChange={(e) =>
                  setFormData({ ...formData, cbn_code: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "4px",
              }}
            >
              Tags (comma-separated)
            </label>
            <input
              type="text"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                fontSize: "14px",
                outline: "none",
              }}
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              placeholder="e.g., current-asset, liquid"
            />
          </div>
          <div
            style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                backgroundColor: "#F3F4F6",
                color: "#1F2937",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 20px",
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Helper functions
const getTypeColor = (type: AccountType): string => {
  const colors: Record<AccountType, string> = {
    asset: "#7C3AED",
    liability: "#EA580C",
    equity: "#DC2626",
    revenue: "#0891B2",
    expense: "#DB2777",
  };
  return colors[type];
};

const getTypeBgColor = (type: AccountType): string => {
  const colors: Record<AccountType, string> = {
    asset: "#EDE9FE",
    liability: "#FFEDD5",
    equity: "#FEE2E2",
    revenue: "#CFFAFE",
    expense: "#FCE7F3",
  };
  return colors[type];
};

export default ChartOfAccountsDashboard;
