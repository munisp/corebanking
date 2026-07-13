import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { authService } from "@/services/auth";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle,
    Clock,
    Eye,
    Search,
    Send,
    TrendingUp,
    Wallet,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface AgriLoan {
  loan_id: string;
  farmer_id: string;
  farm_id: string;
  crop_type: string;
  loan_amount: number;
  interest_rate: number;
  loan_term_months: number;
  status:
    | "pending"
    | "approved"
    | "disbursed"
    | "repaying"
    | "completed"
    | "defaulted";
  planting_date?: string;
  expected_harvest_date?: string;
  created_at?: string;
  disbursed_at?: string;
  collateral_type?: string;
}

export default function AgricultureLoans() {
  const { primaryColor } = useTenantBranding();
  const [loans, setLoans] = useState<AgriLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<AgriLoan | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [disbursing, setDisbursing] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        "/agricultural/api/v1/agriculture/loans",
        { params: { page, limit } },
      );
      setLoans(Array.isArray(response.data.loans) ? response.data.loans : []);
      setTotal(response.data.total ?? response.data.count ?? response.data.loans?.length ?? 0);
    } catch {
      toast.error("Failed to fetch agriculture loans");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanDetails = async (loanId: string) => {
    try {
      const response = await apiClient.get(
        `/agricultural/api/v1/agriculture/loans/${loanId}`,
      );
      setSelectedLoan(response.data.loan);
      setShowDetailsModal(true);
    } catch {
      toast.error("Failed to fetch loan details");
    }
  };

  const handleDisburseLoan = async (loan?: AgriLoan) => {
    const loanToDisburse = loan || selectedLoan;
    if (!loanToDisburse) return;

    if (
      !confirm(
        `Are you sure you want to disburse loan ${loanToDisburse.loan_id}?`,
      )
    ) {
      return;
    }

    setDisbursing(true);
    try {
      await apiClient.post(
        `/agricultural/api/v1/agriculture/loans/${loanToDisburse.loan_id}/disburse`,
        { amount: loanToDisburse.loan_amount || 0 },
      );
      toast.success("Loan disbursed successfully");
      setShowDetailsModal(false);
      setSelectedLoan(null);
      fetchLoans(); // Refresh list
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "response" in error) {
        // @ts-expect-error
        toast.error(error.response?.data?.message || "Failed to disburse loan");
      } else {
        toast.error("Failed to disburse loan");
      }
    } finally {
      setDisbursing(false);
    }
  };

  const handleApproveLoan = async (loan: AgriLoan) => {
    if (!confirm(`Are you sure you want to approve loan ${loan.loan_id}?`)) {
      return;
    }

    const currentUser = authService.getUser();

    // Debug logging
    console.log("Current user object:", currentUser);
    console.log("User ID:", currentUser?.id);
    console.log("User keycloak_id:", currentUser?.keycloak_id);
    console.log("LocalStorage auth_user:", localStorage.getItem("auth_user"));

    if (!currentUser?.id) {
      toast.error("User not authenticated. Please log in again.");
      return;
    }

    setApprovingId(loan.loan_id);
    try {
      await apiClient.post(
        `/agricultural/api/v1/agriculture/loans/${loan.loan_id}/approve`,
        { approved_by: String(currentUser.id) },
      );
      toast.success("Loan approved successfully");
      fetchLoans(); // Refresh list
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "response" in error) {
        // @ts-expect-error
        toast.error(error.response?.data?.message || "Failed to approve loan");
      } else {
        toast.error("Failed to approve loan");
      }
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectLoan = async (loan: AgriLoan) => {
    const reason = prompt("Please provide a reason for rejection:");
    if (!reason) {
      toast.error("Rejection reason is required");
      return;
    }

    const currentUser = authService.getUser();
    if (!currentUser?.id) {
      toast.error("User not authenticated");
      return;
    }

    setRejectingId(loan.loan_id);
    try {
      await apiClient.post(
        `/agricultural/api/v1/agriculture/loans/${loan.loan_id}/reject`,
        {
          rejected_by: String(currentUser.id),
          rejection_reason: reason,
        },
      );
      toast.success("Loan rejected successfully");
      fetchLoans(); // Refresh list
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "response" in error) {
        // @ts-expect-error
        toast.error(error.response?.data?.message || "Failed to reject loan");
      } else {
        toast.error("Failed to reject loan");
      }
    } finally {
      setRejectingId(null);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLoans(); }, [page]);

  const filteredLoans = loans.filter((loan) => {
    const matchesSearch =
      loan.loan_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.farmer_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.crop_type?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || loan.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      {
        variant:
          | "secondary"
          | "default"
          | "destructive"
          | "outline"
          | null
          | undefined;
        icon: React.ElementType;
        label: string;
      }
    > = {
      pending: { variant: "secondary", icon: Clock, label: "Pending" },
      approved: { variant: "default", icon: CheckCircle, label: "Approved" },
      disbursed: { variant: "default", icon: Send, label: "Disbursed" },
      repaying: { variant: "default", icon: TrendingUp, label: "Repaying" },
      completed: { variant: "default", icon: CheckCircle, label: "Completed" },
      defaulted: { variant: "destructive", icon: XCircle, label: "Defaulted" },
      rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const stats = {
    total: loans.length,
    pending: loans.filter((l) => l.status === "pending").length,
    approved: loans.filter((l) => l.status === "approved").length,
    disbursed: loans.filter(
      (l) => l.status === "disbursed" || l.status === "repaying",
    ).length,
    totalAmount: loans.reduce((sum, l) => sum + l.loan_amount, 0),
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        {/* Header */}
        <div className="border-b border-border bg-background/50 backdrop-blur-sm mb-8">
          <div className="py-6">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/agriculture-banking">
                <a>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Agriculture Banking
                  </Button>
                </a>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Wallet className="w-8 h-8" style={{ color: primaryColor }} />
              Agriculture Loans
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage agricultural loans and disbursements
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Loans</p>
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Pending</p>
            <p className="text-3xl font-bold text-orange-600">
              {stats.pending}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Approved</p>
            <p className="text-3xl font-bold text-blue-600">{stats.approved}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
            <p className="text-2xl font-bold text-green-600">
              ₦{(stats.totalAmount / 1000000).toFixed(1)}M
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Search by loan ID, farmer, or crop type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="disbursed">Disbursed</option>
              <option value="repaying">Repaying</option>
              <option value="completed">Completed</option>
              <option value="defaulted">Defaulted</option>
            </select>
          </div>
        </div>

        {/* Loans Table - Updated */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : filteredLoans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No loans found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Loan ID
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Farmer ID
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Farm ID
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Crop Type
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Loan Amount
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Interest Rate
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Planting Date
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Expected Harvest
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLoans.map((loan) => (
                    <tr
                      key={loan.loan_id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {loan.loan_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {loan.farmer_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {loan.farm_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {loan.crop_type || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">
                        ₦{loan.loan_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {loan.interest_rate}%
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {loan.planting_date
                          ? new Date(loan.planting_date).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {loan.expected_harvest_date
                          ? new Date(
                              loan.expected_harvest_date,
                            ).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(loan.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchLoanDetails(loan.loan_id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          {loan.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApproveLoan(loan)}
                                disabled={
                                  approvingId === loan.loan_id ||
                                  rejectingId === loan.loan_id
                                }
                                style={{ backgroundColor: primaryColor }}
                                className="text-white"
                              >
                                {approvingId === loan.loan_id ? (
                                  <>
                                    <Clock className="w-3 h-3 mr-2 animate-spin" />
                                    Approving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-2" />
                                    Approve
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectLoan(loan)}
                                disabled={
                                  approvingId === loan.loan_id ||
                                  rejectingId === loan.loan_id
                                }
                              >
                                {rejectingId === loan.loan_id ? (
                                  <>
                                    <Clock className="w-3 h-3 mr-2 animate-spin" />
                                    Rejecting...
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3 mr-2" />
                                    Reject
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                          {loan.status === "approved" && (
                            <Button
                              size="sm"
                              onClick={() => handleDisburseLoan(loan)}
                              disabled={disbursing}
                              style={{ backgroundColor: primaryColor }}
                              className="text-white"
                            >
                              {disbursing ? (
                                <>
                                  <Clock className="w-3 h-3 mr-2 animate-spin" />
                                  Disbursing...
                                </>
                              ) : (
                                <>
                                  <Send className="w-3 h-3 mr-2" />
                                  Disburse
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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

        {/* Loan Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Loan Details</DialogTitle>
              <DialogDescription>
                View and manage loan information
              </DialogDescription>
            </DialogHeader>

            {selectedLoan && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Loan ID</p>
                    <p className="font-semibold">{selectedLoan.loan_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">
                      {getStatusBadge(selectedLoan.status)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Farmer ID</p>
                    <p className="font-semibold">{selectedLoan.farmer_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Farm ID</p>
                    <p className="font-semibold">{selectedLoan.farm_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Crop Type</p>
                    <p className="font-semibold">
                      {selectedLoan.crop_type || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Loan Amount</p>
                    <p className="font-semibold text-green-600">
                      ₦{selectedLoan.loan_amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Interest Rate
                    </p>
                    <p className="font-semibold">
                      {selectedLoan.interest_rate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Loan Term</p>
                    <p className="font-semibold">
                      {selectedLoan.loan_term_months} months
                    </p>
                  </div>
                  {selectedLoan.planting_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Planting Date
                      </p>
                      <p className="font-semibold">
                        {new Date(
                          selectedLoan.planting_date,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {selectedLoan.expected_harvest_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Expected Harvest
                      </p>
                      <p className="font-semibold">
                        {new Date(
                          selectedLoan.expected_harvest_date,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {selectedLoan.collateral_type && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Collateral Type
                      </p>
                      <p className="font-semibold">
                        {selectedLoan.collateral_type}
                      </p>
                    </div>
                  )}
                  {selectedLoan.created_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Created At
                      </p>
                      <p className="font-semibold">
                        {new Date(selectedLoan.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
              {selectedLoan && selectedLoan.status === "approved" && (
                <Button
                  onClick={() => handleDisburseLoan(selectedLoan)}
                  disabled={disbursing}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  {disbursing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Disbursing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Disburse Loan
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
