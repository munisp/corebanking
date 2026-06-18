import { Button } from "@/components/ui/button";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
  CheckCircle,
  Clock,
  Download,
  Hash,
  List,
  Pause,
  Play,
  Plus,
  Search,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import apiClient from "@/services/api";
import { getTenantId } from "@/lib/utils";

interface AccountOption {
  id: string;
  name: string;
  account_number: string;
  keycloak_id?: string;
  status?: string;
}

interface VirtualAccount {
  id: string;
  accountNumber: string;
  customerName: string;
  customerId: string;
  purpose: string;
  bankName: string;
  totalReceived: number;
  transactionCount: number;
  status: "active" | "inactive" | "suspended";
  createdDate: string;
  lastTransactionDate?: string;
  branch?: string;
}

export default function VirtualAccountManagement() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<VirtualAccount | null>(
    null,
  );
  const [showManageModal, setShowManageModal] = useState(false);
  const { primaryColor } = useTenantBranding();

  const [virtualAccounts, setVirtualAccounts] = useState<VirtualAccount[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Create VAN modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [parentAccounts, setParentAccounts] = useState<AccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    parentAccountId: "",
    purpose: "merchant",
    accountName: "",
    webhookUrl: "",
    singleUse: false,
  });

  // Fetch tenant accounts when create modal opens
  useEffect(() => {
    if (!showCreateModal) return;
    setLoadingAccounts(true);
    apiClient
      .get("/account/account/all", { params: { page: 1, limit: 25 } })
      .then((res) => {
        const raw = res.data?.accounts ?? res.data?.data ?? res.data ?? [];
        setParentAccounts(Array.isArray(raw) ? raw : []);
      })
      .catch(() => toast.error("Failed to load accounts"))
      .finally(() => setLoadingAccounts(false));
  }, [showCreateModal]);

  const handleCreateVAN = async () => {
    if (!createForm.parentAccountId || !createForm.accountName) {
      toast.error("Account and account name are required");
      return;
    }
    setIsCreating(true);
    try {
      const tenantId = getTenantId();
      const selected = parentAccounts.find((a) => a.id === createForm.parentAccountId);
      await apiClient.post("/virtual-accounts", {
        bank_id: tenantId,
        parent_account_id: createForm.parentAccountId,
        customer_id: selected?.keycloak_id ?? createForm.parentAccountId,
        purpose: createForm.purpose,
        account_name: createForm.accountName,
        ...(createForm.webhookUrl ? { webhook_url: createForm.webhookUrl } : {}),
        single_use: createForm.singleUse,
      });
      toast.success("Virtual account created successfully");
      setShowCreateModal(false);
      setCreateForm({ parentAccountId: "", purpose: "merchant", accountName: "", webhookUrl: "", singleUse: false });
      setPage(1);
    } catch {
      toast.error("Failed to create virtual account");
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    apiClient.get('/account/account/all', { params: { page, limit } })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.accounts ?? res.data?.data ?? [];
        setVirtualAccounts(data as VirtualAccount[]);
        setTotal(res.data?.total ?? res.data?.count ?? data.length);
      })
      .catch(() => { /* service unavailable — show empty state */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filteredAccounts = virtualAccounts.filter((account) => {
    const matchesSearch =
      account.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.accountNumber.includes(searchTerm) ||
      account.customerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.purpose.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || account.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: virtualAccounts.length,
    active: virtualAccounts.filter((a) => a.status === "active").length,
    totalReceived: virtualAccounts.reduce((sum, a) => sum + a.totalReceived, 0),
    totalTransactions: virtualAccounts.reduce(
      (sum, a) => sum + a.transactionCount,
      0,
    ),
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "inactive":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
      case "suspended":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-4 h-4" />;
      case "inactive":
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleExportExcel = (): void => {
    const data = filteredAccounts.map((account) => ({
      "Account Number": account.accountNumber,
      "Customer Name": account.customerName,
      "Customer ID": account.customerId,
      Purpose: account.purpose,
      "Bank Name": account.bankName,
      "Total Received": account.totalReceived,
      "Transaction Count": account.transactionCount,
      Status: account.status,
      "Created Date": account.createdDate,
      "Last Transaction": account.lastTransactionDate || "N/A",
      Branch: account.branch || "N/A",
    }));
    exportToExcel(data, "virtual-accounts");
    toast.success("Exported to Excel successfully");
  };

  const handleExportPDF = (): void => {
    const columns = [
      "Account Number",
      "Customer",
      "Purpose",
      "Total Received",
      "Status",
    ];
    const data = filteredAccounts.map((account) => ({
      "Account Number": account.accountNumber,
      Customer: account.customerName,
      Purpose: account.purpose,
      "Total Received": formatCurrency(account.totalReceived),
      Status: account.status,
    }));
    exportToPDF(data, columns, "virtual-accounts", "Virtual Accounts Report");
    toast.success("Exported to PDF successfully");
  };

  const handleManageAccount = (account: VirtualAccount) => {
    setSelectedAccount(account);
    setShowManageModal(true);
  };

  const handleActivateAccount = () => {
    if (selectedAccount) {
      toast.success(
        `Virtual account ${selectedAccount.accountNumber} activated`,
      );
      setShowManageModal(false);
    }
  };

  const handleSuspendAccount = () => {
    if (selectedAccount) {
      toast.error(`Virtual account ${selectedAccount.accountNumber} suspended`);
      setShowManageModal(false);
    }
  };

  const handleViewTransactions = () => {
    if (selectedAccount) {
      toast.info(`Viewing ${selectedAccount.transactionCount} transactions`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      {/* Header */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Hash className="w-8 h-8" style={{ color: primaryColor }} />
                Virtual Account Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage virtual account numbers (VAN) and monitor transactions
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              style={{ backgroundColor: primaryColor }}
              className="text-white hover:opacity-90 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create VAN
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {stats.total}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total VANs
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Hash className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.active}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Active Accounts
                </div>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalTransactions}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total Transactions
                </div>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.totalReceived)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total Received
                </div>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by customer, account number, or purpose..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Excel
            </Button>
            <Button
              onClick={handleExportPDF}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Virtual Accounts Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Account Number
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Financial Summary
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground font-mono">
                        {account.accountNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {account.bankName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">
                        {account.customerName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {account.customerId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {account.branch}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground">
                        {account.purpose}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">
                        {formatCurrency(account.totalReceived)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {account.transactionCount} transactions
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {account.lastTransactionDate || "Never"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created: {account.createdDate}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(account.status)}`}
                      >
                        {getStatusIcon(account.status)}
                        {account.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageAccount(account)}
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.max(1, Math.ceil(total / limit))} ({total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </div>

        {/* Create VAN Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Hash className="w-5 h-5" style={{ color: primaryColor }} />
                  Create Virtual Account
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Account dropdown */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Link to Account <span className="text-red-500">*</span>
                  </label>
                  {loadingAccounts ? (
                    <div className="h-10 bg-muted rounded-lg animate-pulse" />
                  ) : (
                    <select
                      value={createForm.parentAccountId}
                      onChange={(e) => setCreateForm((f) => ({ ...f, parentAccountId: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select an account...</option>
                      {parentAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} — {acc.account_number}
                          {acc.status ? ` (${acc.status})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Payments received on this VAN will credit the selected account directly.
                  </p>
                </div>

                {/* Purpose */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Purpose <span className="text-red-500">*</span></label>
                  <select
                    value={createForm.purpose}
                    onChange={(e) => setCreateForm((f) => ({ ...f, purpose: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="merchant">Merchant</option>
                    <option value="loan_collection">Loan Collection</option>
                    <option value="escrow">Escrow</option>
                    <option value="agent">Agent Banking</option>
                    <option value="payroll">Payroll</option>
                    <option value="general">General</option>
                  </select>
                </div>

                {/* Account name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Merchant Collections — Acme Ltd"
                    value={createForm.accountName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, accountName: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Name shown during NIBSS name enquiry.</p>
                </div>

                {/* Webhook URL */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Webhook URL (optional)</label>
                  <input
                    type="url"
                    placeholder="https://yourdomain.com/webhook"
                    value={createForm.webhookUrl}
                    onChange={(e) => setCreateForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Single use */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.singleUse}
                    onChange={(e) => setCreateForm((f) => ({ ...f, singleUse: e.target.checked }))}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-foreground">Single-use (VAN closes after first payment)</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateVAN}
                  disabled={isCreating || !createForm.parentAccountId || !createForm.accountName}
                  style={{ backgroundColor: primaryColor }}
                  className="flex-1 text-white hover:opacity-90"
                >
                  {isCreating ? "Creating..." : "Create VAN"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Manage Virtual Account Modal */}
        {showManageModal && selectedAccount && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowManageModal(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Hash className="w-6 h-6" style={{ color: primaryColor }} />
                  Manage VAN - {selectedAccount.accountNumber}
                </h2>
                <button
                  onClick={() => setShowManageModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-semibold text-foreground">
                      {selectedAccount.customerName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Account Number
                    </p>
                    <p className="font-semibold text-foreground font-mono">
                      {selectedAccount.accountNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Purpose</p>
                    <p className="font-semibold text-foreground">
                      {selectedAccount.purpose}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Received
                    </p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(selectedAccount.totalReceived)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Transactions
                    </p>
                    <p className="font-semibold text-foreground">
                      {selectedAccount.transactionCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedAccount.status)}`}
                    >
                      {selectedAccount.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {selectedAccount.status === "inactive" && (
                  <Button
                    onClick={handleActivateAccount}
                    style={{ backgroundColor: primaryColor }}
                    className="flex-1 text-white"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Activate Account
                  </Button>
                )}
                {selectedAccount.status === "active" && (
                  <Button
                    variant="destructive"
                    onClick={handleSuspendAccount}
                    className="flex-1"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Suspend Account
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleViewTransactions}
                  className="flex-1"
                >
                  <List className="w-4 h-4 mr-2" />
                  View Transactions
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
