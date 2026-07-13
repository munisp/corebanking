import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Activity,
    Check,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    Clock,
    Download,
    Eye,
    FileText,
    Plus,
    Search,
    Shield,
    X,
    XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import apiClient from "../services/api";

interface Dispute {
  id: string;
  dispute_id?: string;
  transaction_id?: string;
  customer_id?: string;
  amount?: string;
  currency?: string;
  status: string;
  reason?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution?: string;
  [key: string]: any;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  keycloakId?: string;
}

export default function Disputes() {
  const { primaryColor } = useTenantBranding();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [disputeDetails, setDisputeDetails] = useState<Dispute | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Create dispute state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [customerComboOpen, setCustomerComboOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    transaction_id: "",
    dispute_type: "UNAUTHORIZED",
    description: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [disputesTotal, setDisputesTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const fetchDisputes = async (page = currentPage, size = pageSize) => {
    setDisputesLoading(true);
    try {
      const response = await apiClient.get<Dispute[]>(
        `/dispute/api/v1/disputes/tenant`,
        { params: { page, limit: size, search: debouncedSearch || undefined, status: statusFilter !== "all" ? statusFilter : undefined } },
      );
      const data = response.data;

      // Handle different response structures
      let disputesData: Dispute[] = [];
      if (Array.isArray(data)) {
        disputesData = data;
      } else if (
        data &&
        typeof data === "object" &&
        "disputes" in data &&
        Array.isArray((data as any).disputes)
      ) {
        disputesData = (data as any).disputes;
      } else if (
        data &&
        typeof data === "object" &&
        "data" in data &&
        Array.isArray((data as any).data)
      ) {
        disputesData = (data as any).data;
      }

      setDisputes(disputesData);
      setDisputesTotal((data as any)?.total ?? disputesData.length);
    } catch (error) {
      console.error("Error fetching disputes:", error);
      setDisputes([]);
      toast.error("Failed to fetch disputes");
    } finally {
      setDisputesLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page on filter/search/pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  // Re-fetch on page/filter changes
  useEffect(() => {
    fetchDisputes(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, statusFilter]);

  // Fetch users when create modal opens
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await apiClient.get("/user/user/tenant");
        const data = response.data;

        let usersData: any[] = [];
        if (Array.isArray(data)) {
          usersData = data;
        } else if (Array.isArray(data.users)) {
          usersData = data.users;
        } else if (Array.isArray(data.data)) {
          usersData = data.data;
        }

        const mappedUsers: User[] = usersData.map((user: any) => ({
          id: user.id || user.user_id,
          name:
            user.name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            "Unknown User",
          email: user.email || "",
          phone: user.phone_number || user.phone || "",
          keycloakId: user.keycloak_id || user.keycloakId || user.id,
        }));

        setUsers(mappedUsers);
      } catch (error: any) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load users");
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };

    if (showCreateModal) {
      fetchUsers();
    }
  }, [showCreateModal]);

  const fetchDisputeDetails = async (disputeId: string) => {
    setDetailsLoading(true);
    try {
      const response = await apiClient.get<Dispute>(
        `/dispute/api/v1/disputes/${disputeId}`,
      );
      setDisputeDetails(response.data);
    } catch (error) {
      console.error("Error fetching dispute details:", error);
      toast.error("Failed to fetch dispute details");
      setDisputeDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleViewDispute = async (dispute: Dispute) => {
    const disputeId = dispute.dispute_id || dispute.id;
    setSelectedDispute(dispute);
    setShowDetailsModal(true);
    await fetchDisputeDetails(disputeId);
  };

  const handleResolveDispute = async (
    disputeId: string,
    resolution: "resolved" | "rejected",
  ) => {
    if (processingIds.has(disputeId)) return;

    setProcessingIds((prev) => new Set(prev).add(disputeId));

    try {
      await apiClient.put(
        `/dispute/api/v1/administration/disputes/${disputeId}/resolve?resolution=${resolution}`,
      );
      toast.success(
        `Dispute ${resolution === "resolved" ? "resolved" : "rejected"} successfully`,
      );
      await fetchDisputes();
      if (showDetailsModal && selectedDispute) {
        await fetchDisputeDetails(disputeId);
      }
    } catch (error: any) {
      console.error("Error resolving dispute:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to resolve dispute";
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(disputeId);
        return newSet;
      });
    }
  };

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id) {
      toast.error("Please select a customer");
      return;
    }

    if (!formData.transaction_id) {
      toast.error("Please enter a transaction ID");
      return;
    }

    if (!formData.description) {
      toast.error("Please provide a description");
      return;
    }

    setCreateLoading(true);
    try {
      await apiClient.post("/dispute/api/v1/disputes", {
        transactionId: formData.transaction_id,
        disputeType: formData.dispute_type,
        description: formData.description,
      });

      toast.success("Dispute created successfully");
      setShowCreateModal(false);
      setFormData({
        customer_id: "",
        customer_name: "",
        transaction_id: "",
        dispute_type: "UNAUTHORIZED",
        description: "",
      });
      await fetchDisputes();
    } catch (error: any) {
      console.error("Error creating dispute:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to create dispute";
      toast.error(errorMessage);
    } finally {
      setCreateLoading(false);
    }
  };

  // disputes are already filtered/paginated server-side
  const filteredDisputes = disputes;

  // Calculate statistics
  const stats = useMemo(() => {
    const total = disputesTotal;
    const pending = filteredDisputes.filter(
      (d) =>
        d.status?.toLowerCase() === "pending" ||
        d.status?.toLowerCase() === "open",
    ).length;
    const resolved = filteredDisputes.filter(
      (d) =>
        d.status?.toLowerCase() === "resolved" ||
        d.status?.toLowerCase() === "closed",
    ).length;
    const rejected = filteredDisputes.filter(
      (d) => d.status?.toLowerCase() === "rejected",
    ).length;
    const totalAmount = filteredDisputes.reduce(
      (sum, d) => sum + parseFloat(d.amount || "0"),
      0,
    );

    return {
      total,
      pending,
      resolved,
      rejected,
      totalAmount,
      resolutionRate: total > 0 ? ((resolved / total) * 100).toFixed(1) : "0.0",
    };
  }, [filteredDisputes, disputesTotal]);

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "resolved" || statusLower === "closed") {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    }
    if (statusLower === "rejected") {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    }
    if (statusLower === "pending" || statusLower === "open") {
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    }
    return "bg-muted text-foreground";
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "resolved" || statusLower === "closed") {
      return <CheckCircle className="w-4 h-4" />;
    }
    if (statusLower === "rejected") {
      return <XCircle className="w-4 h-4" />;
    }
    if (statusLower === "pending" || statusLower === "open") {
      return <Clock className="w-4 h-4" />;
    }
    return null;
  };

  const handleExportExcel = () => {
    const data = filteredDisputes.map((dispute) => ({
      "Dispute ID": dispute.dispute_id || dispute.id,
      "Transaction ID": dispute.transaction_id || "N/A",
      "Customer ID": dispute.customer_id || "N/A",
      Amount: dispute.amount
        ? `${dispute.currency || "NGN"} ${parseFloat(dispute.amount).toLocaleString()}`
        : "N/A",
      Status: dispute.status,
      Reason: dispute.description || "N/A",
      Created: new Date(dispute.created_at).toLocaleDateString(),
      Resolved: dispute.resolved_at
        ? new Date(dispute.resolved_at).toLocaleDateString()
        : "N/A",
    }));
    exportToExcel(data, "disputes");
  };

  const handleExportPDF = () => {
    const data = filteredDisputes.map((dispute) => ({
      "Dispute ID": dispute.dispute_id || dispute.id,
      "Transaction ID": dispute.transaction_id || "N/A",
      Status: dispute.status,
      Amount: dispute.amount
        ? `${dispute.currency || "NGN"} ${parseFloat(dispute.amount).toLocaleString()}`
        : "N/A",
      Created: new Date(dispute.created_at).toLocaleDateString(),
    }));
    exportToPDF(
      data,
      ["Dispute ID", "Transaction ID", "Status", "Amount", "Created"],
      "disputes-report",
      "Disputes Report",
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background ">
      <div className="container py-8">
        <PageHeader
          label="Dispute Management"
          title="Disputes"
          description="Manage and resolve transaction disputes"
          icon={<Shield className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-white rounded-lg hover:opacity-90 flex items-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <Plus className="w-5 h-5" />
            Create Dispute
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
            disabled={disputesLoading}
          >
            <Download className="w-5 h-5" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
            disabled={disputesLoading}
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
                Total Disputes
              </div>
              <Shield className="w-5 h-5" style={{ color: primaryColor }} />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {stats.total.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {disputes.length} total
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">Pending</div>
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.pending}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Requires attention
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">Resolved</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.resolved}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {stats.resolutionRate}% resolution rate
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">
              Total Amount
            </div>
            <div className="text-3xl font-bold text-foreground">
              ₦{(stats.totalAmount / 1000).toFixed(1)}K
            </div>
            {/* <div className="text-sm text-muted-foreground mt-1">
              {stats.rejected} rejected
            </div> */}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search disputes..."
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
              <option value="pending">Pending</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              {/* <option value="rejected">Rejected</option> */}
            </select>
          </div>
        </div>

        {/* Disputes Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              Disputes ({filteredDisputes.length})
            </h3>
          </div>

          {disputesLoading ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading disputes...</p>
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No disputes found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Dispute ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Transaction ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Customer ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Reason
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredDisputes.map((dispute) => {
                    const disputeId = dispute.dispute_id || dispute.id;
                    const isPending =
                      dispute.status?.toLowerCase() === "pending" ||
                      dispute.status?.toLowerCase() === "open";
                    const isProcessing = processingIds.has(disputeId);

                    return (
                      <tr
                        key={dispute.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-sm text-foreground">
                          {disputeId}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                          {dispute.transaction_id || "N/A"}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                          {dispute.customer_id || "N/A"}
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">
                          {dispute.amount
                            ? `${dispute.currency || "NGN"} ${parseFloat(dispute.amount).toLocaleString()}`
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {dispute.description || "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1 w-fit ${getStatusColor(dispute.status || "")}`}
                          >
                            {getStatusIcon(dispute.status || "")}
                            {dispute.status || "Unknown"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(dispute.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewDispute(dispute)}
                              className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                            {isPending && (
                              <>
                                <button
                                  onClick={() =>
                                    handleResolveDispute(disputeId, "resolved")
                                  }
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  {isProcessing ? (
                                    <>
                                      <Activity className="w-3 h-3 animate-spin" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3 h-3" />
                                      Resolve
                                    </>
                                  )}
                                </button>
                                {/* <button
                                  onClick={() => handleResolveDispute(disputeId, 'rejected')}
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Reject
                                </button> */}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                {disputesTotal === 0 ? "No results" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, disputesTotal)} of ${disputesTotal}`}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage * pageSize >= disputesTotal}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dispute Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="text-lg font-semibold text-foreground">
                Dispute Details:{" "}
                {selectedDispute?.dispute_id || selectedDispute?.id}
              </h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedDispute(null);
                  setDisputeDetails(null);
                }}
                className="text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailsLoading ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Loading dispute details...
                  </p>
                </div>
              ) : disputeDetails ? (
                <>
                  {/* Dispute Information */}
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-border">
                    <h4 className="text-md font-semibold text-foreground mb-4">
                      Dispute Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Dispute ID
                        </label>
                        <p className="text-sm font-medium text-foreground font-mono">
                          {disputeDetails.dispute_id || disputeDetails.id}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Transaction ID
                        </label>
                        <p className="text-sm font-medium text-foreground font-mono">
                          {disputeDetails.transaction_id || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Customer ID
                        </label>
                        <p className="text-sm font-medium text-foreground font-mono">
                          {disputeDetails.customer_id || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Amount
                        </label>
                        <p className="text-sm font-medium text-foreground">
                          {disputeDetails.amount
                            ? `${disputeDetails.currency || "NGN"} ${parseFloat(disputeDetails.amount).toLocaleString()}`
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Status
                        </label>
                        <p className="text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1 w-fit ${getStatusColor(disputeDetails.status || "")}`}
                          >
                            {getStatusIcon(disputeDetails.status || "")}
                            {disputeDetails.status || "Unknown"}
                          </span>
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Reason
                        </label>
                        <p className="text-sm font-medium text-foreground">
                          {disputeDetails.description || "N/A"}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs text-muted-foreground">
                          Description
                        </label>
                        <p className="text-sm font-medium text-foreground">
                          {disputeDetails.description || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Created
                        </label>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(disputeDetails.created_at).toLocaleString()}
                        </p>
                      </div>
                      {disputeDetails.resolved_at && (
                        <div>
                          <label className="text-xs text-muted-foreground">
                            Resolved
                          </label>
                          <p className="text-sm font-medium text-foreground">
                            {new Date(
                              disputeDetails.resolved_at,
                            ).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {disputeDetails.resolved_by && (
                        <div>
                          <label className="text-xs text-muted-foreground">
                            Resolved By
                          </label>
                          <p className="text-sm font-medium text-foreground">
                            {disputeDetails.resolved_by}
                          </p>
                        </div>
                      )}
                      {disputeDetails.resolution && (
                        <div className="md:col-span-2">
                          <label className="text-xs text-muted-foreground">
                            Resolution
                          </label>
                          <p className="text-sm font-medium text-foreground">
                            {disputeDetails.resolution}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {(disputeDetails.status?.toLowerCase() === "pending" ||
                    disputeDetails.status?.toLowerCase() === "open") && (
                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                      <button
                        onClick={() =>
                          handleResolveDispute(
                            disputeDetails.dispute_id || disputeDetails.id,
                            "resolved",
                          )
                        }
                        disabled={processingIds.has(
                          disputeDetails.dispute_id || disputeDetails.id,
                        )}
                        className="flex-1 px-4 py-2 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {processingIds.has(
                          disputeDetails.dispute_id || disputeDetails.id,
                        ) ? (
                          <>
                            <Activity className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Resolve Dispute
                          </>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          handleResolveDispute(
                            disputeDetails.dispute_id || disputeDetails.id,
                            "rejected",
                          )
                        }
                        disabled={processingIds.has(
                          disputeDetails.dispute_id || disputeDetails.id,
                        )}
                        className="flex-1 px-4 py-2 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject Dispute
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Failed to load dispute details
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Dispute Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="text-lg font-semibold text-foreground">
                Create Dispute
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    customer_id: "",
                    customer_name: "",
                    transaction_id: "",
                    dispute_type: "UNAUTHORIZED",
                    description: "",
                  });
                }}
                className="text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDispute} className="p-6 space-y-4">
              {/* Customer Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Customer *
                </label>
                <Popover
                  open={customerComboOpen}
                  onOpenChange={setCustomerComboOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground flex items-center justify-between hover:bg-muted disabled:opacity-50"
                      disabled={usersLoading}
                    >
                      <span
                        className={
                          formData.customer_id
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {formData.customer_id
                          ? users.find(
                              (user) =>
                                (user.keycloakId || user.id) ===
                                formData.customer_id,
                            )?.name
                          : usersLoading
                            ? "Loading users..."
                            : "Select customer"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search customer..." />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {users.map((user) => (
                            <CommandItem
                              key={user.keycloakId || user.id}
                              value={`${user.name} ${user.email}`}
                              onSelect={() => {
                                const userId = user.keycloakId || user.id;
                                setFormData({
                                  ...formData,
                                  customer_id: userId,
                                  customer_name: user.name,
                                });
                                setCustomerComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.customer_id ===
                                    (user.keycloakId || user.id)
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{user.name}</span>
                                {user.email && (
                                  <span className="text-xs text-muted-foreground">
                                    {user.email}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Transaction ID */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Transaction ID *
                </label>
                <input
                  type="text"
                  value={formData.transaction_id}
                  onChange={(e) =>
                    setFormData({ ...formData, transaction_id: e.target.value })
                  }
                  placeholder="Enter transaction ID"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                  style={
                    { "--tw-ring-color": primaryColor } as React.CSSProperties
                  }
                  required
                />
              </div>

              {/* Dispute Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Dispute Type *
                </label>
                <select
                  value={formData.dispute_type}
                  onChange={(e) =>
                    setFormData({ ...formData, dispute_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                  style={
                    { "--tw-ring-color": primaryColor } as React.CSSProperties
                  }
                >
                  <option value="UNAUTHORIZED">Unauthorized Transaction</option>
                  <option value="INCORRECT_AMOUNT">Incorrect Amount</option>
                  <option value="SERVICE_NOT_RECEIVED">
                    Service Not Received
                  </option>
                  <option value="DUPLICATE">Duplicate Charge</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe the issue in detail"
                  rows={4}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 resize-vertical"
                  style={
                    { "--tw-ring-color": primaryColor } as React.CSSProperties
                  }
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      customer_id: "",
                      customer_name: "",
                      transaction_id: "",
                      dispute_type: "UNAUTHORIZED",
                      description: "",
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted text-foreground font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {createLoading ? (
                    <>
                      <Activity className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Dispute"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
