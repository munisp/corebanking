import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { listContracts, releaseContract } from "@/services/escrow";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  // Eye,
  Search,
  Shield,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";

interface EscrowTransaction {
  id: string;
  contract_number: string;
  title: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  buyer?: string;
  seller?: string;
  agent?: string;
  amount?: number;
  escrowType?: string;
  releaseConditions?: string;
  branch?: string;
  // ...other fields from API as needed
}

export default function EscrowManagement() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedEscrow, setSelectedEscrow] =
    useState<EscrowTransaction | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [releaseUserId, setReleaseUserId] = useState<string>("");
  const [releaseNotes, setReleaseNotes] = useState<string>("");
  const [releasing, setReleasing] = useState<boolean>(false);
  const { primaryColor } = useTenantBranding();

  // Escrow data from API
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [escrowTotal, setEscrowTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const fetchEscrows = (page = currentPage, size = pageSize) => {
    setLoading(true);
    setError(null);
    listContracts({ page, per_page: size })
      .then((response: any) => {
        const data = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];
        setEscrows(data);
        setEscrowTotal(response?.total ?? response?.data?.total ?? data.length);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load escrows");
        setLoading(false);
      });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page on filter/search/pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStatus, pageSize]);

  // Re-fetch on page/filter changes
  useEffect(() => {
    fetchEscrows(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, filterStatus]);

  // escrows are already filtered/paginated server-side
  const filteredEscrows = escrows;

  // Calculate stats
  const stats = {
    total: escrowTotal,
    awaiting_funding: escrows.filter((e) => e.status === "awaiting_funding")
      .length,
    // Add more status counts as needed
    totalValue: escrows.reduce((sum, e) => sum + (e.total_amount || 0), 0),
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "funded":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "released":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-muted text-foreground";
    }
  };

  // const getStatusIcon = (status: string) => {
  //   switch (status) {
  //     case 'active': return <CheckCircle className="w-4 h-4" />;
  //     case 'pending': return <Clock className="w-4 h-4" />;
  //     case 'cancelled': return <XCircle className="w-4 h-4" />;
  //     default: return <Clock className="w-4 h-4" />;
  //   }
  // };

  const getEscrowTypeLabel = (type: string): string => {
    switch (type) {
      case "property_transaction":
        return "Property Transaction";
      case "service_payment":
        return "Service Payment";
      case "contract_deposit":
        return "Contract Deposit";
      default:
        return type;
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
    const data = filteredEscrows.map((escrow) => ({
      "Escrow ID": escrow.id,
      Buyer: escrow.buyer || "N/A",
      Seller: escrow.seller || "N/A",
      Agent: escrow.agent || "N/A",
      Amount: escrow.amount || escrow.total_amount,
      Type: getEscrowTypeLabel(escrow.escrowType || ""),
      Status: escrow.status,
      "Created Date": escrow.created_at,
      "Release Date": "N/A",
      "Release Conditions": escrow.releaseConditions || "N/A",
      Branch: escrow.branch || "N/A",
    }));
    exportToExcel(data, "escrow-transactions");
    toast.success("Exported to Excel successfully");
  };

  const handleExportPDF = (): void => {
    const columns = ["Escrow ID", "Buyer", "Seller", "Amount", "Status"];
    const data = filteredEscrows.map((escrow) => ({
      "Escrow ID": escrow.id,
      Buyer: escrow.buyer || "N/A",
      Seller: escrow.seller || "N/A",
      Amount: formatCurrency(escrow.amount || escrow.total_amount),
      Status: escrow.status,
    }));
    exportToPDF(
      data,
      columns,
      "escrow-transactions",
      "Escrow Transactions Report",
    );
    toast.success("Exported to PDF successfully");
  };

  const handleManageEscrow = (escrow: EscrowTransaction) => {
    setSelectedEscrow(escrow);
    setShowManageModal(true);
  };

  const handleApproveEscrow = () => {
    if (selectedEscrow) {
      toast.success(`Escrow ${selectedEscrow.id} approved and activated`);
      setShowManageModal(false);
    }
  };

  const handleReleaseFunds = async () => {
    if (!selectedEscrow) return;

    if (!releaseUserId.trim()) {
      toast.error("Please enter a User ID");
      return;
    }

    setReleasing(true);
    try {
      await releaseContract(selectedEscrow.id, releaseUserId, releaseNotes);
      toast.success(
        `Funds released for contract ${selectedEscrow.contract_number}`,
      );
      setShowManageModal(false);
      setReleaseUserId("");
      setReleaseNotes("");
      // Refresh contracts list
      fetchEscrows(currentPage, pageSize);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to release funds");
    } finally {
      setReleasing(false);
    }
  };

  const handleCancelEscrow = () => {
    if (selectedEscrow) {
      toast.error(`Escrow ${selectedEscrow.id} cancelled`);
      setShowManageModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Escrow Management"
          title="Escrow Management"
          description="Manage secure third-party escrow transactions"
          icon={<Shield className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        {/* Loading/Error State */}
        {loading ? (
          <div className="text-center py-20 text-lg text-muted-foreground">
            Loading escrows...
          </div>
        ) : error ? (
          <div className="text-center py-20 text-lg text-red-500">{error}</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-foreground">
                      {stats.total}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Total Contracts
                    </div>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.awaiting_funding}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Awaiting Funding
                    </div>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatCurrency(stats.totalValue)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Total Value
                    </div>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
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
                    placeholder="Search by buyer, seller, or ID..."
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
                  <option value="pending">Pending</option>
                  <option value="funded">Funded</option>
                  <option value="active">Active</option>
                  <option value="released">Released</option>
                  <option value="cancelled">Cancelled</option>
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

            {/* Escrow Transactions Table */}
            <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Contract #
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Currency
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEscrows.map((escrow) => (
                      <tr
                        key={escrow.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          {escrow.contract_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {escrow.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatCurrency(escrow.total_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {escrow.currency}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(escrow.status)}`}
                          >
                            {escrow.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(escrow.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManageEscrow(escrow)}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {escrowTotal === 0 ? "No results" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, escrowTotal)} of ${escrowTotal}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage * pageSize >= escrowTotal}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        {showManageModal && selectedEscrow && (
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
                  <Shield className="w-6 h-6" style={{ color: primaryColor }} />
                  Manage Escrow - {selectedEscrow.id}
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
                    <p className="text-sm text-muted-foreground">Buyer</p>
                    <p className="font-semibold text-foreground">
                      {selectedEscrow.buyer || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Seller</p>
                    <p className="font-semibold text-foreground">
                      {selectedEscrow.seller || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(
                        selectedEscrow.amount || selectedEscrow.total_amount,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedEscrow.status)}`}
                    >
                      {selectedEscrow.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Release Conditions
                  </p>
                  <p className="text-foreground mt-1">
                    {selectedEscrow.releaseConditions || "N/A"}
                  </p>
                </div>
              </div>

              {(selectedEscrow.status === "active" ||
                selectedEscrow.status === "funded") && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-4">
                  <h3 className="font-semibold text-foreground">
                    Release Funds
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      User ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={releaseUserId}
                      onChange={(e) => setReleaseUserId(e.target.value)}
                      placeholder="Enter user ID"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={releaseNotes}
                      onChange={(e) => setReleaseNotes(e.target.value)}
                      placeholder="Add notes about the release..."
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {selectedEscrow.status === "pending" && (
                  <Button
                    onClick={handleApproveEscrow}
                    style={{ backgroundColor: primaryColor }}
                    className="flex-1 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve & Activate
                  </Button>
                )}
                {(selectedEscrow.status === "active" ||
                  selectedEscrow.status === "funded") && (
                  <Button
                    onClick={handleReleaseFunds}
                    disabled={releasing}
                    style={{ backgroundColor: primaryColor }}
                    className="flex-1 text-white"
                  >
                    {releasing ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Releasing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Release Funds
                      </>
                    )}
                  </Button>
                )}
                {/* <Button
                  variant="outline"
                  onClick={() => setShowManageModal(false)}
                  className="flex-1"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button> */}
                {selectedEscrow.status !== "released" &&
                  selectedEscrow.status !== "cancelled" && (
                    <Button
                      variant="destructive"
                      onClick={handleCancelEscrow}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Escrow
                    </Button>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
