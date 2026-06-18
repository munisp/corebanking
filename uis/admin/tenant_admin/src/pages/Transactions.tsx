import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    Download,
    FileText,
    Search,
    TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import PageHeader from "../components/PageHeader";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import apiClient from "../services/api";

interface Transaction {
  id: string;
  amount: string;
  ledger_id: string;
  status: string;
  transaction_id: string;
  created_at: string;
  completed_at: string | null;
  currency: string;
  deleted_at: string | null;
  note: string;
  payer: string;
  payer_account_number: string;
  payee_account_number: string;
  tag: string;
  payee: string;
  tenant_id: string;
  updated_at: string;
}

interface TransactionsResponse {
  message: string;
  transactions: Transaction[];
}

export default function Transactions() {
  const { primaryColor } = useTenantBranding();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [metrics, setMetrics] = useState<{
    total_count: number;
    total_volume: number;
  } | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Fetch transaction metrics
  const fetchMetrics = async () => {
    setMetricsLoading(true);
    try {
      const response = await apiClient.get("/ledger/txn/metrics");
      const data = response.data;
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error("Error fetching transaction metrics:", error);
    } finally {
      setMetricsLoading(false);
    }
  };

  // Fetch transactions with pagination
  const fetchTransactions = async (setLoading = true) => {
    if (setLoading) {
      setTransactionsLoading(true);
    }
    try {
      const response = await apiClient.get<TransactionsResponse>(
        `/ledger/txn/?page=${page}&limit=${limit}`,
      );
      const data = response.data;

      // Response structure: { message: "success", transactions: [...] }
      const transactionsData: Transaction[] = Array.isArray(data.transactions)
        ? data.transactions
        : [];

      setTransactions(transactionsData);
      setTransactionsTotal(metrics?.total_count || transactionsData.length);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      if (setLoading) {
        setTransactions([]);
        setTransactionsTotal(0);
      }
    } finally {
      if (setLoading) {
        setTransactionsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh metrics every 30 seconds
    const metricsInterval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(metricsInterval);
  }, []);

  useEffect(() => {
    fetchTransactions(true);
    // Refresh every 10 seconds (silently in background)
    const interval = setInterval(() => fetchTransactions(false), 10000);
    return () => clearInterval(interval);
  }, [page, limit]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesSearch =
        !searchTerm ||
        txn.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.payer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.payee?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.amount?.includes(searchTerm);

      const matchesStatus =
        statusFilter === "all" ||
        txn.status?.toLowerCase() === statusFilter.toLowerCase();

      // Derive type from payer/payee (if payer is MINT_ACCOUNT, it's a deposit; if payee is MINT_ACCOUNT, it's a withdrawal)
      const derivedType =
        txn.payer === "MINT_ACCOUNT"
          ? "deposit"
          : txn.payee === "MINT_ACCOUNT"
            ? "withdrawal"
            : "transfer";
      const matchesType =
        typeFilter === "all" ||
        derivedType?.toLowerCase() === typeFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [transactions, searchTerm, statusFilter, typeFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredTransactions.length;
    const totalAmount = filteredTransactions.reduce(
      (sum, txn) => sum + parseFloat(txn.amount || "0"),
      0,
    );
    const successful = filteredTransactions.filter(
      (txn) => txn.status?.toLowerCase() === "success",
    ).length;
    const failed = filteredTransactions.filter(
      (txn) =>
        txn.status?.toLowerCase() === "failed" ||
        txn.status?.toLowerCase() === "error",
    ).length;
    const pending = filteredTransactions.filter(
      (txn) =>
        txn.status?.toLowerCase() === "pending" ||
        txn.status?.toLowerCase() === "processing",
    ).length;

    return {
      total,
      totalAmount,
      successful,
      failed,
      pending,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : "0.0",
    };
  }, [filteredTransactions]);

  // Transaction type distribution
  const typeDistribution = useMemo(() => {
    const typeMap = new Map<string, number>();
    filteredTransactions.forEach((txn) => {
      // Derive type from payer/payee
      const type =
        txn.payer === "MINT_ACCOUNT"
          ? "deposit"
          : txn.payee === "MINT_ACCOUNT"
            ? "withdrawal"
            : "transfer";
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    const colors = [
      "#3b82f6",
      "#8b5cf6",
      "#ec4899",
      "#10b981",
      "#f59e0b",
      "#ef4444",
    ];
    return Array.from(typeMap.entries()).map(([name, value], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[index % colors.length],
    }));
  }, [filteredTransactions]);

  // Daily transaction volume
  const dailyVolume = useMemo(() => {
    const volumeMap = new Map<string, number>();
    filteredTransactions.forEach((txn) => {
      // Handle date format "2025-12-18 15:48:26"
      const dateStr = txn.created_at.replace(" ", "T");
      const date = new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      volumeMap.set(
        date,
        (volumeMap.get(date) || 0) + parseFloat(txn.amount || "0"),
      );
    });

    return Array.from(volumeMap.entries())
      .map(([date, amount]) => ({ date, amount: amount / 1000 })) // Convert to thousands
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days
  }, [filteredTransactions]);

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "success" || statusLower === "completed") {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    }
    if (statusLower === "failed" || statusLower === "error") {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    }
    if (statusLower === "pending" || statusLower === "processing") {
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    }
    return "bg-muted text-foreground";
  };

  const getTypeIcon = (payer: string, payee: string) => {
    if (payer === "MINT_ACCOUNT") {
      return <ArrowDownRight className="w-4 h-4 text-green-600" />;
    }
    if (payee === "MINT_ACCOUNT") {
      return <ArrowUpRight className="w-4 h-4 text-red-600" />;
    }
    return <Activity className="w-4 h-4 text-blue-600" />;
  };

  const handleExportExcel = () => {
    const data = filteredTransactions.map((txn) => {
      const type =
        txn.payer === "MINT_ACCOUNT"
          ? "deposit"
          : txn.payee === "MINT_ACCOUNT"
            ? "withdrawal"
            : "transfer";
      return {
        "Transaction ID": txn.transaction_id,
        Note: txn.note || "N/A",
        Type: type,
        Amount: `${txn.currency} ${parseFloat(txn.amount || "0").toLocaleString()}`,
        Status: txn.status,
        Payer: txn.payer || "N/A",
        Payee: txn.payee || "N/A",
        Created: txn.created_at,
        Completed: txn.completed_at || "N/A",
      };
    });
    exportToExcel(data, "transactions");
  };

  const handleExportPDF = () => {
    const data = filteredTransactions.map((txn) => {
      const type =
        txn.payer === "MINT_ACCOUNT"
          ? "deposit"
          : txn.payee === "MINT_ACCOUNT"
            ? "withdrawal"
            : "transfer";
      return {
        "Transaction ID": txn.transaction_id,
        Note: txn.note || "N/A",
        Type: type,
        Amount: `${txn.currency} ${parseFloat(txn.amount || "0").toLocaleString()}`,
        Status: txn.status,
        Created: txn.created_at,
      };
    });
    exportToPDF(
      data,
      ["Transaction ID", "Note", "Type", "Amount", "Status", "Created"],
      "transactions-report",
      "Transactions Report",
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background ">
      <div className="container py-8">
        <PageHeader
          label="Transaction Management"
          title="Transactions"
          description="View and manage all transaction records"
          icon={<TrendingUp className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
            disabled={transactionsLoading}
          >
            <Download className="w-5 h-5" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
            disabled={transactionsLoading}
          >
            <Download className="w-5 h-5" />
            PDF
          </button>
        </div>
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">
                Total Transactions
              </div>
              <TrendingUp className="w-5 h-5" style={{ color: primaryColor }} />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {metricsLoading
                ? "..."
                : (metrics?.total_count || 0).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">All time</div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">
              Total Volume
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {metricsLoading
                ? "..."
                : `₦${((metrics?.total_volume || 0) / 1000).toFixed(1)}K`}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              All transactions
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">
              Success Rate
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.successRate}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {stats.failed} failed, {stats.pending} pending
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">
              Failed Transactions
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {stats.failed}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {stats.pending} pending
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Transaction Volume Chart */}
          {dailyVolume.length > 0 && (
            <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-6">
                Daily Transaction Volume
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={dailyVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f1f5f9" }}
                    formatter={(value: number | undefined) =>
                      value !== undefined ? `₦${value.toFixed(1)}K` : ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={primaryColor}
                    fill={primaryColor}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Transaction Type Distribution */}
          {typeDistribution.length > 0 && (
            <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-6">
                Transaction Types
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {typeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                style={
                  { "--tw-ring-color": primaryColor } as React.CSSProperties
                }
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              {/* <option value="completed">Completed</option> */}
              <option value="pending">Pending</option>
              {/* <option value="processing">Processing</option> */}
              <option value="failed">Failed</option>
              <option value="error">Error</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              Transaction List ({filteredTransactions.length})
            </h3>
          </div>

          {transactionsLoading ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Transaction ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Reference
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      From Account
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      To Account
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredTransactions.map((txn) => {
                    const type =
                      txn.payer === "MINT_ACCOUNT"
                        ? "deposit"
                        : txn.payee === "MINT_ACCOUNT"
                          ? "withdrawal"
                          : "transfer";
                    return (
                      <tr
                        key={txn.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-sm text-foreground">
                          {txn.transaction_id}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {txn.note || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(txn.payer, txn.payee)}
                            <span className="capitalize">{type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">
                          {txn.currency}{" "}
                          {parseFloat(txn.amount || "0").toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(txn.status || "")}`}
                          >
                            {txn.status || "Unknown"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                          {txn.payer_account_number || "-"}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                          {txn.payee_account_number || "-"}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(
                            txn.created_at.replace(" ", "T"),
                          ).toLocaleDateString()}{" "}
                          {new Date(
                            txn.created_at.replace(" ", "T"),
                          ).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredTransactions.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} to{" "}
              {Math.min(page * limit, transactionsTotal)} of {transactionsTotal}{" "}
              transactions
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-muted-foreground">
                Page {page} of {Math.ceil(transactionsTotal / limit)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * limit >= transactionsTotal}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
