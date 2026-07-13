import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
    Activity,
    Calendar,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    DollarSign,
    Download,
    Eye,
    FileText,
    Plus,
    Search,
    TrendingUp,
    X,
    XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { toast } from "sonner";
import LoanApplicationForm from "../components/forms/LoanApplicationForm";
import PageHeader from "../components/PageHeader";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import apiClient from "../services/api";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface LoanApplication {
  id: string;
  tenant_id: string;
  loan_application_id: string;
  status: string;
  applicant_id: string;
  loan_amount: number;
  loan_purpose: string;
  LoanInterestRatePercent: number;
  requested_term: number;
  monthly_income: number;
  existing_debt: number;
  collateral_value: number;
  credit_score: number;
  employment_status: string;
  employment_duration: number;
  bank_statement_score: number;
  bvn_verified: boolean;
  nin_verified: boolean;
  LoanStartedAt: string | null;
  payments: any | null;
}

export default function Loans() {
  const { primaryColor } = useTenantBranding();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsTotal, setApplicationsTotal] = useState(0);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Loan details and schedule state
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(
    null,
  );
  const [showLoanDetails, setShowLoanDetails] = useState(false);
  const [showRepaymentSchedule, setShowRepaymentSchedule] = useState(false);
  const [loanDetails, setLoanDetails] = useState<LoanApplication | null>(null);
  const [repaymentSchedule, setRepaymentSchedule] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const fetchLoanApplications = async (page = currentPage, size = pageSize, setLoading = true) => {
    if (setLoading) {
      setApplicationsLoading(true);
    }
    try {
      const response = await apiClient.get<any>(
        `/loan/api/v1/loans/applications/administration`,
        { params: { page, limit: size } },
      );
      const data = response.data;
      const applicationsData: LoanApplication[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      setApplications(applicationsData);
      setApplicationsTotal(data?.total ?? applicationsData.length);
    } catch (error) {
      console.error("Error fetching loan applications:", error);
      if (setLoading) {
        setApplications([]);
        setApplicationsTotal(0);
      }
    } finally {
      if (setLoading) {
        setApplicationsLoading(false);
      }
    }
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset page on filter/search/pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  // Re-fetch on page/filter change
  useEffect(() => {
    fetchLoanApplications(currentPage, pageSize, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, statusFilter]);

  // Applications are already paginated/filtered server-side
  const filteredApplications = applications;

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredApplications.length;
    const totalAmount = filteredApplications.reduce(
      (sum, app) => sum + (app.loan_amount || 0),
      0,
    );
    const pending = filteredApplications.filter(
      (app) =>
        app.status?.toLowerCase() === "pending" ||
        app.status?.toLowerCase() === "submitted",
    ).length;
    const approved = filteredApplications.filter(
      (app) =>
        app.status?.toLowerCase() === "approved" ||
        app.status?.toLowerCase() === "active",
    ).length;
    const rejected = filteredApplications.filter(
      (app) =>
        app.status?.toLowerCase() === "rejected" ||
        app.status?.toLowerCase() === "declined",
    ).length;
    const active = filteredApplications.filter(
      (app) => app.LoanStartedAt !== null,
    ).length;

    return {
      total,
      totalAmount,
      pending,
      approved,
      rejected,
      active,
      approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : "0.0",
    };
  }, [filteredApplications]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const statusMap = new Map<string, number>();
    filteredApplications.forEach((app) => {
      const status = app.status || "unknown";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return Array.from(statusMap.entries()).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [filteredApplications]);

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "approved" || statusLower === "active") {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    }
    if (statusLower === "rejected" || statusLower === "declined") {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    }
    if (statusLower === "pending" || statusLower === "submitted") {
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    }
    return "bg-muted text-foreground";
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "approved" || statusLower === "active") {
      return <CheckCircle className="w-4 h-4" />;
    }
    if (statusLower === "rejected" || statusLower === "declined") {
      return <XCircle className="w-4 h-4" />;
    }
    if (statusLower === "pending" || statusLower === "submitted") {
      return <Clock className="w-4 h-4" />;
    }
    return null;
  };

  const handleExportExcel = () => {
    const data = filteredApplications.map((app) => ({
      "Loan Application ID": app.loan_application_id,
      "Applicant ID": app.applicant_id,
      "Loan Amount": `₦${(app.loan_amount || 0).toLocaleString()}`,
      "Loan Purpose": app.loan_purpose,
      "Interest Rate": `${app.LoanInterestRatePercent}%`,
      "Requested Term": `${app.requested_term} month(s)`,
      "Monthly Income": `₦${(app.monthly_income || 0).toLocaleString()}`,
      "Credit Score": app.credit_score,
      "Employment Status": app.employment_status,
      "BVN Verified": app.bvn_verified ? "Yes" : "No",
      "NIN Verified": app.nin_verified ? "Yes" : "No",
      Status: app.status,
    }));
    exportToExcel(data, "loan-applications");
  };

  const handleExportPDF = () => {
    const pdfData = filteredApplications.map((app) => ({
      "Loan Application ID": app.loan_application_id || app.id,
      "Applicant ID": app.applicant_id,
      "Loan Amount": `₦${(app.loan_amount || 0).toLocaleString()}`,
      "Loan Purpose": app.loan_purpose,
      Status: app.status,
    }));
    exportToPDF(
      pdfData,
      [
        "Loan Application ID",
        "Applicant ID",
        "Loan Amount",
        "Loan Purpose",
        "Status",
      ],
      "loan-applications-report",
      "Loan Applications Report",
    );
  };

  const handleApproveLoan = async (loanApplicationId: string) => {
    if (processingIds.has(loanApplicationId)) return;

    setProcessingIds((prev) => new Set(prev).add(loanApplicationId));

    try {
      await apiClient.post(
        `/loan/api/v1/loans/applications/${loanApplicationId}/approve`,
      );
      toast.success("Loan application approved successfully");
      await fetchLoanApplications();
    } catch (error: any) {
      console.error("Error approving loan:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to approve loan application";
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(loanApplicationId);
        return newSet;
      });
    }
  };

  const handleRejectLoan = async (
    loanApplicationId: string,
    reason?: string,
  ) => {
    if (processingIds.has(loanApplicationId)) return;

    const rejectionReason =
      reason || prompt("Please provide a reason for rejection:");
    if (!rejectionReason) {
      toast.error("Rejection reason is required");
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(loanApplicationId));

    try {
      await apiClient.post(
        `/loan/api/v1/loans/applications/${loanApplicationId}/decline`,
        {
          reason: rejectionReason,
        },
      );
      toast.success("Loan application rejected successfully");
      await fetchLoanApplications();
    } catch (error: any) {
      console.error("Error rejecting loan:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to reject loan application";
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(loanApplicationId);
        return newSet;
      });
    }
  };

  // Disburse loan
  const handleDisburseLoan = async (loanApplicationId: string) => {
    if (processingIds.has(loanApplicationId)) return;

    if (
      !confirm(`Are you sure you want to disburse loan ${loanApplicationId}?`)
    ) {
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(loanApplicationId));

    try {
      await apiClient.post(`/loan/api/v1/loans/${loanApplicationId}/disburse`);
      toast.success("Loan disbursed successfully");
      await fetchLoanApplications();
    } catch (error: any) {
      console.error("Error disbursing loan:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to disburse loan";
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(loanApplicationId);
        return newSet;
      });
    }
  };

  // Fetch loan details
  const fetchLoanDetails = async (loanApplicationId: string) => {
    setDetailsLoading(true);
    try {
      const response = await apiClient.get<LoanApplication>(
        `loan/api/v1/loans/applications/${loanApplicationId}`,
      );
      setLoanDetails(response.data);
    } catch (error: any) {
      console.error("Error fetching loan details:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to fetch loan details";
      toast.error(errorMessage);
      setLoanDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Fetch repayment schedule
  const fetchRepaymentSchedule = async (loanApplicationId: string) => {
    setScheduleLoading(true);
    try {
      const response = await apiClient.get<any>(
        `/loan/api/v1/loans/${loanApplicationId}/schedule`,
      );
      const data = response.data;

      // Handle different response structures
      let schedule: any[] = [];
      if (Array.isArray(data)) {
        schedule = data;
      } else if (data.schedule && Array.isArray(data.schedule)) {
        schedule = data.schedule;
      } else if (data.data && Array.isArray(data.data)) {
        schedule = data.data;
      } else if (data.payments && Array.isArray(data.payments)) {
        schedule = data.payments;
      }

      setRepaymentSchedule(schedule);
    } catch (error: any) {
      console.error("Error fetching repayment schedule:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to fetch repayment schedule";
      toast.error(errorMessage);
      setRepaymentSchedule([]);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Handle view loan details
  const handleViewLoanDetails = async (loan: LoanApplication) => {
    setSelectedLoan(loan);
    setShowLoanDetails(true);
    await fetchLoanDetails(loan.loan_application_id);
  };

  // Handle view repayment schedule
  const handleViewRepaymentSchedule = async (loan: LoanApplication) => {
    setSelectedLoan(loan);
    setShowRepaymentSchedule(true);
    await fetchRepaymentSchedule(loan.loan_application_id);
  };

  const InfoRow = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: any;
  mono?: boolean;
}) => (
  <div className="flex items-start justify-between gap-4">
    <span className="text-sm text-muted-foreground">
      {label}
    </span>

    <span
      className={`text-sm font-semibold text-right text-foreground ${
        mono ? "font-mono text-xs" : ""
      }`}
    >
      {value || "-"}
    </span>
  </div>
);

const VerificationBadge = ({
  label,
  verified,
}: {
  label: string;
  verified: boolean;
}) => (
  <div className="flex items-center justify-between p-4 rounded-2xl border border-border">
    <span className="font-medium text-foreground">
      {label}
    </span>

    <span
      className={`px-4 py-2 rounded-full text-xs font-bold ${
        verified
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      }`}
    >
      {verified ? "Verified" : "Not Verified"}
    </span>
  </div>
);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background ">
      <div className="container py-8">
        <PageHeader
          label="Loan Management"
          title="Loan Applications"
          description="View and manage loan applications"
          icon={<TrendingUp className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setShowApplicationForm(true)}
            className="px-4 py-2 rounded-lg hover:bg-muted flex items-center gap-2"
            style={{ backgroundColor: primaryColor, color: "white" }}
          >
            <Plus className="w-5 h-5" />
            New Application
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
            disabled={applicationsLoading}
          >
            <Download className="w-5 h-5" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
            disabled={applicationsLoading}
          >
            <Download className="w-5 h-5" />
            PDF
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">
                Total Applications
              </div>
              <TrendingUp className="w-5 h-5" style={{ color: primaryColor }} />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {stats.total.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {applicationsTotal} total
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">
              Total Loan Amount
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              ₦{(stats.totalAmount / 1000).toFixed(1)}K
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {stats.approved} approved
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">
              Approval Rate
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.approvalRate}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {stats.pending} pending
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">Rejected</div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {stats.rejected}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {stats.pending} pending review
            </div>
          </div>
        </div>

        {/* Status Distribution Chart */}
        {statusDistribution.length > 0 && (
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-6">
              Application Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#64748b" />
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
                <Bar dataKey="value" fill={primaryColor} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search applications..."
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
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>

        {/* Applications Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              Loan Applications ({filteredApplications.length})
            </h3>
          </div>

          {applicationsLoading ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading applications...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No loan applications found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Loan Application ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Applicant ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Loan Amount
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Loan Purpose
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Interest Rate
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Term
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Credit Score
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredApplications.map((app) => {
                    const isPending = app.status?.toLowerCase() === "pending";
                    const isProcessing = processingIds.has(
                      app.loan_application_id,
                    );

                    return (
                      <tr
                        key={app.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-sm text-foreground">
                          {app.loan_application_id}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                          {app.applicant_id}
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">
                          ₦{(app.loan_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {app.loan_purpose}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1 w-fit ${getStatusColor(app.status || "")}`}
                          >
                            {getStatusIcon(app.status || "")}
                            {app.status || "Unknown"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {app.LoanInterestRatePercent}%
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {app.requested_term} month(s)
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {app.credit_score}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isPending && (
                              <>
                                <button
                                  onClick={() =>
                                    handleApproveLoan(app.loan_application_id)
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
                                      Approve
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() =>
                                    handleRejectLoan(app.loan_application_id)
                                  }
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Reject
                                </button>
                              </>
                            )}
                            {(app.status?.toLowerCase() === "approved" ||
                              app.status?.toLowerCase() === "active") &&
                              !app.LoanStartedAt && (
                                <button
                                  onClick={() =>
                                    handleDisburseLoan(app.loan_application_id)
                                  }
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                  style={{ backgroundColor: "#10b981" }}
                                >
                                  {isProcessing ? (
                                    <>
                                      <Activity className="w-3 h-3 animate-spin" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <DollarSign className="w-3 h-3" />
                                      Disburse
                                    </>
                                  )}
                                </button>
                              )}
                            <button
                              onClick={() => handleViewLoanDetails(app)}
                              className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Details
                            </button>
                            {app.LoanStartedAt && (
                              <button
                                onClick={() => handleViewRepaymentSchedule(app)}
                                className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted flex items-center gap-1"
                              >
                                <Calendar className="w-3 h-3" />
                                Schedule
                              </button>
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
        </div>

        {/* Pagination */}
        {applicationsTotal > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border mt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page:</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Page {currentPage} of {Math.max(1, Math.ceil(applicationsTotal / pageSize))}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(Math.max(1, Math.ceil(applicationsTotal / pageSize)), p + 1))} disabled={currentPage >= Math.max(1, Math.ceil(applicationsTotal / pageSize))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Loan Details Modal */}
      {/* Loan Details Modal */}
{showLoanDetails && selectedLoan && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-6xl max-h-[95vh] overflow-y-auto">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border p-6 flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold text-foreground">
            Loan Details
          </h3>

          <p className="text-muted-foreground mt-1">
            {selectedLoan.loan_application_id}
          </p>
        </div>

        <button
          onClick={() => {
            setShowLoanDetails(false);
            setSelectedLoan(null);
            setLoanDetails(null);
          }}
          className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6">
        {detailsLoading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <Activity className="w-10 h-10 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Loading loan details...
            </p>
          </div>
        ) : loanDetails ? (
          <>
            {/* HERO */}
            <div
              className="rounded-3xl p-8 text-white mb-8"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, #7c3aed)`,
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                <div>
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-4 ${
                      loanDetails.status?.toLowerCase() === "approved" ||
                      loanDetails.status?.toLowerCase() === "active" ||
                      loanDetails.status?.toLowerCase() === "disbursed"
                        ? "bg-green-500/20 text-white"
                        : loanDetails.status?.toLowerCase() === "rejected"
                          ? "bg-red-500/20 text-white"
                          : "bg-yellow-500/20 text-white"
                    }`}
                  >
                    {getStatusIcon(loanDetails.status || "")}
                    {loanDetails.status}
                  </div>

                  <h2 className="text-5xl font-black tracking-tight">
                    ₦
                    {(loanDetails.loan_amount || 0).toLocaleString()}
                  </h2>

                  <p className="mt-3 text-lg text-white/80">
                    {loanDetails.loan_purpose}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 min-w-[320px]">
                  <div className="bg-white/10 rounded-2xl p-5 backdrop-blur">
                    <p className="text-sm text-white/70 mb-1">
                      Interest Rate
                    </p>
                    <h4 className="text-2xl font-bold">
                      {loanDetails.LoanInterestRatePercent}
                      %
                    </h4>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-5 backdrop-blur">
                    <p className="text-sm text-white/70 mb-1">Loan Term</p>
                    <h4 className="text-2xl font-bold">
                      {loanDetails.requested_term}m
                    </h4>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-5 backdrop-blur">
                    <p className="text-sm text-white/70 mb-1">
                      Credit Score
                    </p>
                    <h4 className="text-2xl font-bold">
                      {loanDetails.credit_score}
                    </h4>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-5 backdrop-blur">
                    <p className="text-sm text-white/70 mb-1">
                      Monthly Income
                    </p>
                    <h4 className="text-xl font-bold">
                      ₦
                      {(loanDetails.monthly_income || 0).toLocaleString()}
                    </h4>
                  </div>
                </div>
              </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">
                    Total Paid
                  </span>
                </div>

                <h3 className="text-3xl font-bold text-foreground">
                  ₦
                  {(
                    Array.isArray(loanDetails.payments)
                      ? loanDetails.payments.reduce(
                          (sum: number, p: any) =>
                            sum + Number(p.amount || 0),
                          0,
                        )
                      : 0
                  ).toLocaleString()}
                </h3>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-muted-foreground">
                    Remaining Balance
                  </span>
                </div>

                <h3 className="text-3xl font-bold text-foreground">
                  ₦
                  {(
                    (loanDetails.loan_amount || 0) -
                    (Array.isArray(loanDetails.payments)
                      ? loanDetails.payments.reduce(
                          (sum: number, p: any) =>
                            sum + Number(p.amount || 0),
                          0,
                        )
                      : 0)
                  ).toLocaleString()}
                </h3>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-muted-foreground">
                    Started Date
                  </span>
                </div>

                <h3 className="text-lg font-bold text-foreground">
                  {loanDetails.LoanStartedAt
                    ? new Date(
                        loanDetails.LoanStartedAt,
                      ).toLocaleDateString()
                    : "N/A"}
                </h3>
              </div>
            </div>

            {/* DETAILS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* APPLICANT */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-foreground mb-5">
                  Applicant Information
                </h4>

                <div className="space-y-4">
                  <InfoRow
                    label="Applicant ID"
                    value={loanDetails.applicant_id}
                    mono
                  />

                  <InfoRow
                    label="Employment Status"
                    value={loanDetails.employment_status}
                  />

                  <InfoRow
                    label="Employment Duration"
                    value={`${loanDetails.employment_duration} months`}
                  />

                  <InfoRow
                    label="Existing Debt"
                    value={`₦${(
                      loanDetails.existing_debt || 0
                    ).toLocaleString()}`}
                  />

                  <InfoRow
                    label="Collateral Value"
                    value={`₦${(
                      loanDetails.collateral_value || 0
                    ).toLocaleString()}`}
                  />

                  <InfoRow
                    label="Bank Statement Score"
                    value={loanDetails.bank_statement_score}
                  />
                </div>
              </div>

              {/* VERIFICATION */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-foreground mb-5">
                  Verification Status
                </h4>

                <div className="space-y-5">
                  <VerificationBadge
                    label="BVN Verification"
                    verified={loanDetails.bvn_verified}
                  />

                  <VerificationBadge
                    label="NIN Verification"
                    verified={loanDetails.nin_verified}
                  />
                </div>

                <div className="mt-8 border-t border-border pt-6">
                  <h5 className="font-semibold mb-4 text-foreground">
                    Loan Metadata
                  </h5>

                  <div className="space-y-4">
                    <InfoRow
                      label="Tenant ID"
                      value={loanDetails.tenant_id}
                    />

                    <InfoRow
                      label="Loan ID"
                      value={loanDetails.id}
                    />

                    <InfoRow
                      label="Application ID"
                      value={loanDetails.loan_application_id}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PAYMENT HISTORY */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-foreground">
                    Payment History
                  </h4>

                  <p className="text-sm text-muted-foreground mt-1">
                    Loan repayment transactions
                  </p>
                </div>
              </div>

              {Array.isArray(loanDetails.payments) &&
              loanDetails.payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase">
                          Payment ID
                        </th>

                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase">
                          Amount
                        </th>

                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase">
                          Method
                        </th>

                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase">
                          Transaction ID
                        </th>

                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase">
                          Date
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {loanDetails.payments.map(
                        (payment: any, index: number) => (
                          <tr
                            key={payment.id || index}
                            className="border-b border-border hover:bg-muted/30 transition"
                          >
                            <td className="px-6 py-5 font-mono text-sm text-foreground">
                              {payment.loan_payment_id}
                            </td>

                            <td className="px-6 py-5">
                              <span className="font-bold text-green-600 dark:text-green-400">
                                ₦
                                {Number(
                                  payment.amount || 0,
                                ).toLocaleString()}
                              </span>
                            </td>

                            <td className="px-6 py-5">
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                {payment.payment_method}
                              </span>
                            </td>

                            <td className="px-6 py-5 font-mono text-xs text-muted-foreground">
                              {payment.transaction_id}
                            </td>

                            <td className="px-6 py-5 text-sm text-muted-foreground">
                              {payment.payment_date
                                ? new Date(
                                    payment.payment_date,
                                  ).toLocaleString()
                                : "-"}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />

                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    No Payments Yet
                  </h4>

                  <p className="text-muted-foreground">
                    This loan does not have any repayment records yet.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-24 text-center text-muted-foreground">
            Failed to load loan details
          </div>
        )}
      </div>
    </div>
  </div>
)}

      {/* Repayment Schedule Modal */}
      {showRepaymentSchedule && selectedLoan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="text-lg font-semibold text-foreground">
                Repayment Schedule: {selectedLoan.loan_application_id}
              </h3>
              <button
                onClick={() => {
                  setShowRepaymentSchedule(false);
                  setSelectedLoan(null);
                  setRepaymentSchedule([]);
                }}
                className="text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {scheduleLoading ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Loading repayment schedule...
                  </p>
                </div>
              ) : repaymentSchedule.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Payment #
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Due Date
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Principal
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Interest
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Total Amount
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Paid Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {repaymentSchedule.map((payment: any, index: number) => (
                        <tr
                          key={payment.id || index}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-4 font-semibold text-foreground">
                            {payment.payment_number ||
                              payment.installment_number ||
                              index + 1}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {payment.due_date || payment.dueDate
                              ? new Date(
                                  payment.due_date || payment.dueDate,
                                ).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="px-6 py-4 font-semibold text-foreground">
                            ₦
                            {parseFloat(
                              payment.principal ||
                                payment.principal_amount ||
                                "0",
                            ).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            ₦
                            {parseFloat(
                              payment.interest ||
                                payment.interest_amount ||
                                "0",
                            ).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 font-semibold text-green-600 dark:text-green-400">
                            ₦
                            {parseFloat(
                              payment.total_amount ||
                                payment.amount ||
                                payment.totalAmount ||
                                "0",
                            ).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                                (payment.status || "").toLowerCase() ===
                                  "paid" ||
                                (payment.status || "").toLowerCase() ===
                                  "completed"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                  : (payment.status || "").toLowerCase() ===
                                      "overdue"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                              }`}
                            >
                              {payment.status || "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {payment.paid_date || payment.paidDate
                              ? new Date(
                                  payment.paid_date || payment.paidDate,
                                ).toLocaleDateString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No repayment schedule available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loan Application Form */}
      <LoanApplicationForm
        open={showApplicationForm}
        onOpenChange={setShowApplicationForm}
        onSuccess={() => {
          fetchLoanApplications(currentPage, pageSize, true);
        }}
      />
    </div>
  );
}
