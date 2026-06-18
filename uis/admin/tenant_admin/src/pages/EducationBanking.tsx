import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
    approveApplication,
    declineApplication,
    disburseSemester,
    generateOffer,
    getDisbursementSchedule,
    getLoanApplicationById,
    getLoanApplications,
    verifyAdmission,
    verifyGuarantor,
    verifyInstitution,
} from "@/services/educationLoan";
import {
    Activity,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Eye,
    FileText,
    GraduationCap,
    Plus,
    Search,
    X,
    XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import EducationLoanApplicationForm from "../components/forms/EducationLoanApplicationForm";
import { useTenantBranding } from "../contexts/TenantBrandingContext";

interface Institution {
  id: string;
  name: string;
  type: string;
  nuc_accredited: boolean;
  accreditation_number: string;
  country: string;
  state: string;
  city: string;
  address: string;
  bank_account_number: string;
  bank_name: string;
  bank_code: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  verification_status: string;
}

interface EducationLoanApplication {
  id: string;
  applicantName: string;
  student_name?: string;
  institution: Institution | string;
  program_name?: string;
  course: string;
  amount: number;
  requested_amount?: number;
  status: string;
  [key: string]: any;
}

const mapApp = (app: any) => ({
  ...app,
  applicantName: app.student_name || app.applicantName || "N/A",
  institution: app.institution_name || app.institution?.name || app.institution || app.institution_id || "N/A",
  course: app.program_name || app.course || "N/A",
  amount: app.requested_amount || app.amount || 0,
});

export default function EducationBanking() {
  const { primaryColor } = useTenantBranding();
  const [applications, setApplications] = useState<EducationLoanApplication[]>(
    [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] =
    useState<EducationLoanApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDetails, setShowDetails] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [appsTotal, setAppsTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const fetchApplications = (page = currentPage, size = pageSize) => {
    setLoading(true);
    getLoanApplications({ page, limit: size })
      .then((res) => {
        let apps: any[] = [];
        if (Array.isArray(res)) {
          apps = res;
        } else if (Array.isArray(res?.applications)) {
          apps = res.applications;
        } else if (Array.isArray(res?.data)) {
          apps = res.data;
        }
        setApplications(apps.map(mapApp));
        setAppsTotal(res?.total ?? apps.length);
      })
      .catch(() => toast.error("Failed to fetch applications"))
      .finally(() => setLoading(false));
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
    fetchApplications(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, statusFilter]);

  const selectApplication = async (id: string) => {
    setSelectedId(id);
    setLoading(true);
    setShowDetails(true);
    try {
      const app = await getLoanApplicationById(id);
      // Map the API response to match our interface
      const mappedApp = {
        ...app,
        applicantName: app.student_name || app.applicantName || "N/A",
        course: app.program_name || app.course || "N/A",
        amount: app.requested_amount || app.amount || 0,
      };
      setSelectedApp(mappedApp);
    } catch {
      toast.error("Failed to fetch application details");
    } finally {
      setLoading(false);
    }
  };

  // applications are already filtered/paginated server-side
  const filteredApplications = applications;

  // Calculate statistics
  const stats = useMemo(() => {
    const total = appsTotal;
    const totalAmount = filteredApplications.reduce(
      (sum, app) => sum + (app.amount || 0),
      0,
    );
    const pending = filteredApplications.filter(
      (app) => app.status?.toLowerCase() === "pending",
    ).length;
    const approved = filteredApplications.filter(
      (app) => app.status?.toLowerCase() === "approved",
    ).length;
    const rejected = filteredApplications.filter(
      (app) =>
        app.status?.toLowerCase() === "rejected" ||
        app.status?.toLowerCase() === "declined",
    ).length;

    return {
      total,
      totalAmount,
      pending,
      approved,
      rejected,
      approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : "0.0",
    };
  }, [filteredApplications, appsTotal]);

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
      "Application ID": app.id,
      "Applicant Name": app.applicantName,
      Institution:
        typeof app.institution === "object" && app.institution !== null
          ? app.institution.name || "N/A"
          : app.institution || "N/A",
      Course: app.course,
      Amount: `₦${(app.amount || 0).toLocaleString()}`,
      Status: app.status,
    }));
    exportToExcel(data, "education-loan-applications");
  };

  const handleExportPDF = () => {
    const pdfData = filteredApplications.map((app) => ({
      "Application ID": app.id,
      "Applicant Name": app.applicantName,
      Institution:
        typeof app.institution === "object" && app.institution !== null
          ? app.institution.name || "N/A"
          : app.institution || "N/A",
      Course: app.course,
      Amount: `₦${(app.amount || 0).toLocaleString()}`,
      Status: app.status,
    }));
    exportToPDF(
      pdfData,
      [
        "Application ID",
        "Applicant Name",
        "Institution",
        "Course",
        "Amount",
        "Status",
      ],
      "education-loan-applications-report",
      "Education Loan Applications Report",
    );
  };

  const handleAction = async (action: string) => {
    if (!selectedId) return;
    if (processingIds.has(selectedId)) return;

    setProcessingIds((prev) => new Set(prev).add(selectedId));
    setLoading(true);
    try {
      let result;
      switch (action) {
        case "verifyInstitution":
          result = await verifyInstitution(selectedId);
          break;
        case "verifyAdmission":
          result = await verifyAdmission(selectedId);
          break;
        case "verifyGuarantor":
          result = await verifyGuarantor(selectedId);
          break;
        case "approve":
          result = await approveApplication(selectedId);
          break;
        case "decline":
          result = await declineApplication(selectedId);
          break;
        case "generateOffer":
          result = await generateOffer(selectedId);
          break;
        case "disbursementSchedule":
          result = await getDisbursementSchedule(selectedId);
          break;
        case "disburseSemester":
          result = await disburseSemester(selectedId);
          break;
        default:
          return;
      }
      toast.success(`${action} successful`);
      if (action === "disbursementSchedule") {
        setSelectedApp((prev) =>
          prev ? { ...prev, disbursementSchedule: result } : prev,
        );
      }
      // Refresh applications list
      const res = await getLoanApplications();
      if (Array.isArray(res)) {
        setApplications(res.map(mapApp));
      } else if (Array.isArray(res?.applications)) {
        setApplications(res.applications.map(mapApp));
      }
    } catch {
      toast.error(`${action} failed`);
    } finally {
      setLoading(false);
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(selectedId);
        return newSet;
      });
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Education Finance"
          title="Education Banking"
          description="Manage education loan applications"
          icon={<GraduationCap className="w-8 h-8" />}
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
            disabled={loading}
          >
            <Download className="w-5 h-5" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
            disabled={loading}
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
                Total Applications
              </div>
              <GraduationCap
                className="w-5 h-5"
                style={{ color: primaryColor }}
              />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {stats.total.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {applications.length} total
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="text-sm text-muted-foreground mb-2">
              Total Loan Amount
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              ₦{(stats.totalAmount / 1000000).toFixed(1)}M
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
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>

        {/* Applications Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              Education Loan Applications ({filteredApplications.length})
            </h3>
          </div>

          {loading && applications.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading applications...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No education loan applications found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Application ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Applicant Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Institution
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Course/Program
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredApplications.map((app) => {
                    const isPending = app.status?.toLowerCase() === "pending";
                    const isProcessing = processingIds.has(app.id);

                    return (
                      <tr
                        key={app.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-sm text-foreground">
                          {app.id}
                        </td>
                        <td className="px-6 py-4 text-foreground font-medium">
                          {app.applicantName}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {typeof app.institution === "object" &&
                          app.institution !== null
                            ? app.institution.name || "N/A"
                            : app.institution || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {app.course}
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">
                          ₦{(app.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1 w-fit ${getStatusColor(app.status || "")}`}
                          >
                            {getStatusIcon(app.status || "")}
                            {app.status || "Unknown"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => selectApplication(app.id)}
                              className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Details
                            </button>
                            {isPending && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedId(app.id);
                                    handleAction("approve");
                                  }}
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
                                  onClick={() => {
                                    setSelectedId(app.id);
                                    handleAction("decline");
                                  }}
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Decline
                                </button>
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
                {appsTotal === 0 ? "No results" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, appsTotal)} of ${appsTotal}`}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage * pageSize >= appsTotal}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedApp && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowDetails(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl z-50 max-h-[90vh] overflow-y-auto">
            <div className="bg-card border border-border rounded-xl shadow-2xl p-6 m-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-2xl text-foreground">
                  Application Details
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Applicant
                  </div>
                  <div className="font-semibold text-foreground">
                    {selectedApp.applicantName}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Application ID
                  </div>
                  <div className="font-mono text-sm text-foreground">
                    {selectedApp.id}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Institution
                  </div>
                  <div className="font-semibold text-foreground">
                    {typeof selectedApp.institution === "object" &&
                    selectedApp.institution !== null
                      ? selectedApp.institution.name || "N/A"
                      : selectedApp.institution || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Course/Program
                  </div>
                  <div className="font-semibold text-foreground">
                    {selectedApp.course}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Amount
                  </div>
                  <div className="font-semibold text-green-600 dark:text-green-400 text-xl">
                    ₦{selectedApp.amount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Status
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize inline-flex items-center gap-1 ${getStatusColor(selectedApp.status || "")}`}
                  >
                    {getStatusIcon(selectedApp.status || "")}
                    {selectedApp.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-6 border-t border-border">
                <Button
                  size="sm"
                  onClick={() => handleAction("verifyInstitution")}
                  disabled={loading}
                >
                  Verify Institution
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction("verifyAdmission")}
                  disabled={loading}
                >
                  Verify Admission
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction("verifyGuarantor")}
                  disabled={loading}
                >
                  Verify Guarantor
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction("approve")}
                  disabled={loading}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction("decline")}
                  disabled={loading}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction("generateOffer")}
                  disabled={loading}
                >
                  Generate Offer
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction("disbursementSchedule")}
                  disabled={loading}
                >
                  Disbursement Schedule
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction("disburseSemester")}
                  disabled={loading}
                >
                  Disburse Semester
                </Button>
              </div>

              {selectedApp.disbursementSchedule && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h4 className="font-semibold mb-3 text-foreground">
                    Disbursement Schedule
                  </h4>
                  <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto max-h-64 text-foreground">
                    {JSON.stringify(selectedApp.disbursementSchedule, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Education Loan Application Form */}
      <EducationLoanApplicationForm
        open={showApplicationForm}
        onOpenChange={setShowApplicationForm}
        onSuccess={() => {
          setLoading(true);
          getLoanApplications()
            .then((res) => {
              if (Array.isArray(res)) {
                setApplications(res.map(mapApp));
              } else if (Array.isArray(res?.applications)) {
                setApplications(res.applications.map(mapApp));
              } else {
                setApplications([]);
              }
            })
            .catch(() => toast.error("Failed to fetch applications"))
            .finally(() => setLoading(false));
        }}
      />
    </div>
  );
}
