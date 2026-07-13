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
import {
    Building2,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    FileText,
    Home,
    Plus,
    Search,
    TrendingUp,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import MortgageApplicationForm from "../components/forms/MortgageApplicationForm";
import apiClient from "../services/api";
import PageHeader from "../components/PageHeader";

interface MortgageProperty {
  id: string;
  application_id: string;
  property_type: string;
  occupancy_type: string;
  address: string;
  city: string;
  state: string;
  lga: string;
  postal_code: string;
  year_built: number;
  number_of_bedrooms: number;
  number_of_bathrooms: number;
  total_area: number;
  land_area: number;
  developer_name: string;
  project_name: string;
  is_off_plan: boolean;
  expected_completion: string | null;
  purchase_price: number;
  market_value: number;
  forced_sale_value: number;
  valuation_date: string | null;
  valuation_report_id: string;
  valuer_name: string;
  valuer_license: string;
  title_status: string;
  cof_o_number: string;
  cof_o_date: string | null;
  governor_consent_date: string | null;
  survey_plan_number: string;
  deed_number: string;
  registry_state: string;
  property_insurance_id: string;
  insurance_provider: string;
  insurance_premium: number;
  insurance_expiry: string | null;
  product_type: string;
}

interface MortgageApplication {
  id: string;
  tenant_id: string;
  application_number: string;
  status: string;
  product_type: string;
  primary_applicant_id: string;
  primary_applicant_name: string;
  primary_applicant_bvn: string;
  primary_applicant_nin: string;
  joint_applicants: any;
  employment_type: string;
  employer_name: string;
  employment_duration: number;
  monthly_gross_income: number;
  monthly_net_income: number;
  other_income: number;
  total_monthly_income: number;
  existing_loan_payments: number;
  credit_card_payments: number;
  other_obligations: number;
  total_monthly_obligations: number;
  requested_amount: number;
  approved_amount: number;
  down_payment: number;
  requested_tenor_months: number;
  approved_tenor_months: number;
  interest_rate: number;
  interest_rate_type: string;
  base_rate: number;
  margin: number;
  monthly_payment: number;
  property: MortgageProperty;
  credit_score: number;
  dti_ratio: number;
  ltv_ratio: number;
  risk_score: number;
  nhf_contributor: boolean;
  nhf_account_number: string;
  nhf_contribution_months: number;
  nhf_balance: number;
  ledger_account_id: string;
  escrow_account_id: string;
  principal_account_id: string;
  interest_account_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  maturity_date: string | null;
  // legacy/compat fields for UI
  applicantName?: string;
  propertyAddress?: string;
  propertyType?: string;
  propertyValue?: number;
  loanAmount?: number;
  downPayment?: number;
  interestRate?: number;
  term?: number;
  monthlyPayment?: number;
  branch?: string;
  applicationDate?: string;
}

export default function MortgageBanking() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedMortgage] = useState<MortgageApplication | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showFullAppModal, setShowFullAppModal] = useState(false);
  const { primaryColor } = useTenantBranding();

  const [mortgages, setMortgages] = useState<MortgageApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Fetch mortgage applications
  const fetchMortgages = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        "/mortgage/api/v1/mortgages/applications",
        { params: { page, limit: size, search: debouncedSearch || undefined, status: filterStatus !== "all" ? filterStatus : undefined } },
      );
      const data =
        response.data && Array.isArray(response.data.applications)
          ? response.data.applications
          : [];
      setMortgages(data);
      setTotal(response.data?.total ?? data.length);
    } catch (error) {
      toast.error("Failed to fetch mortgage applications");
      console.error(error);
      setMortgages([]);
    } finally {
      setLoading(false);
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
  }, [debouncedSearch, filterStatus, pageSize]);

  // Re-fetch on page/filter changes
  useEffect(() => {
    fetchMortgages(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, filterStatus]);

  // mortgages are already filtered/paginated server-side
  const filteredMortgages = mortgages;

  // Calculate stats
  const stats = {
    total,
    pending: mortgages.filter(
      (m) => (m.status || "").toLowerCase() === "pending",
    ).length,
    approved: mortgages.filter(
      (m) => (m.status || "").toLowerCase() === "approved",
    ).length,
    totalValue: mortgages.reduce(
      (sum, m) => sum + (m.requested_amount || m.loanAmount || 0),
      0,
    ),
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "under_review":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      case "disbursed":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "rejected":
        return <XCircle className="w-4 h-4" />;
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
    const data = filteredMortgages.map((mortgage) => ({
      "Application ID": mortgage.id,
      Applicant: mortgage.primary_applicant_name || mortgage.applicantName,
      "Property Address":
        mortgage.property?.address || mortgage.propertyAddress,
      "Property Type": mortgage.product_type || mortgage.propertyType,
      "Property Value":
        mortgage.property?.market_value || mortgage.propertyValue,
      "Loan Amount": mortgage.requested_amount || mortgage.loanAmount,
      "Down Payment": mortgage.down_payment || mortgage.downPayment,
      "Interest Rate": `${mortgage.interest_rate || mortgage.interestRate || 0}%`,
      "Term (Months)": mortgage.requested_tenor_months || mortgage.term,
      "Monthly Payment": mortgage.monthly_payment || mortgage.monthlyPayment,
      Status: mortgage.status,
      "Application Date": mortgage.created_at || mortgage.applicationDate,
      Branch: mortgage.branch || "N/A",
    }));
    exportToExcel(data, "mortgage-applications");
    toast.success("Exported to Excel successfully");
  };

  const handleExportPDF = (): void => {
    const columns = [
      "Application ID",
      "Applicant",
      "Property Address",
      "Loan Amount",
      "Status",
    ];
    const data = filteredMortgages.map((mortgage) => ({
      "Application ID": mortgage.id,
      Applicant: mortgage.primary_applicant_name || mortgage.applicantName,
      "Property Address":
        mortgage.property?.address || mortgage.propertyAddress,
      "Loan Amount": formatCurrency(
        mortgage.requested_amount || mortgage.loanAmount || 0,
      ),
      Status: mortgage.status,
    }));
    exportToPDF(
      data,
      columns,
      "mortgage-applications",
      "Mortgage Applications Report",
    );
    toast.success("Exported to PDF successfully");
  };

  // const handleManageMortgage = (mortgage: MortgageApplication) => {
  //   setSelectedMortgage(mortgage);
  //   setShowManageModal(true);
  // };

  const handleViewFullApplication = () => {
    setShowFullAppModal(true);
  };

  const handleApproveMortgage = async () => {
    if (!selectedMortgage) return;
    console.log(actionLoading);
    setActionLoading(true);
    try {
      await apiClient.post(
        `/mortgage/api/v1/mortgages/applications/${selectedMortgage.id}/approve`,
      );
      toast.success(`Mortgage application ${selectedMortgage.id} approved`);
      fetchMortgages();
      setShowManageModal(false);
    } catch (error) {
      toast.error("Failed to approve application", error as any);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectMortgage = async () => {
    if (!selectedMortgage) return;
    setActionLoading(true);
    try {
      await apiClient.post(
        `/mortgage/api/v1/mortgages/applications/${selectedMortgage.id}/decline`,
      );
      toast.success(`Mortgage application ${selectedMortgage.id} rejected`);
      fetchMortgages();
      setShowManageModal(false);
    } catch (error) {
      toast.error("Failed to reject application");
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisburseLoan = async () => {
    if (!selectedMortgage) return;
    setActionLoading(true);
    try {
      await apiClient.post(
        `/mortgage/api/v1/mortgages/${selectedMortgage.id}/disburse`,
      );
      toast.success(`Loan disbursed for ${selectedMortgage.id}`);
      fetchMortgages();
      setShowManageModal(false);
    } catch (error) {
      toast.error("Failed to disburse loan");
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Mortgage Banking"
          title="Mortgage Banking"
          description="Manage mortgage loan applications and approvals"
          icon={<Home className="w-8 h-8" />}
          action={{ label: "New Application", onClick: () => setShowApplicationForm(true) }}
        />
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
                  Total Applications
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.pending}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Pending Review
                </div>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.approved}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Approved
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
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.totalValue)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total Loan Value
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
                placeholder="Search by applicant, property, or ID..."
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
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="disbursed">Disbursed</option>
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

        {/* Mortgage Applications Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading mortgage applications...
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Application ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Applicant
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Property Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Loan Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Monthly Payment
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    {/* <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th> */}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMortgages.map((mortgage) => (
                    <tr
                      key={mortgage.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">
                          {mortgage.id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {mortgage.created_at || mortgage.applicationDate}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-foreground">
                          {mortgage.primary_applicant_name ||
                            mortgage.applicantName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {mortgage.branch}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-foreground">
                          {mortgage.property?.address ||
                            mortgage.propertyAddress}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {mortgage.product_type || mortgage.propertyType}{" "}
                          {/* {formatCurrency(
                            mortgage.property?.market_value ||
                              mortgage.propertyValue ||
                              0,
                          )} */}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">
                          {formatCurrency(
                            mortgage.requested_amount ||
                              mortgage.loanAmount ||
                              0,
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {mortgage.interest_rate || mortgage.interestRate || 0}
                          % •{" "}
                          {mortgage.requested_tenor_months ||
                            mortgage.term ||
                            0}{" "}
                          months
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">
                          {formatCurrency(
                            mortgage.monthly_payment ||
                              mortgage.monthlyPayment ||
                              0,
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          per month
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(mortgage.status)}`}
                        >
                          {getStatusIcon(mortgage.status)}
                          {(mortgage.status || "").replace("_", " ")}
                        </span>
                      </td>
                      {/* <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageMortgage(mortgage)}
                        >
                          Manage
                        </Button>
                      </td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
                {total === 0 ? "No results" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total}`}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage * pageSize >= total}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Manage Mortgage Modal */}
        {showManageModal && selectedMortgage && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowManageModal(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-3xl w-full mx-4 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Home className="w-6 h-6" style={{ color: primaryColor }} />
                  Manage Mortgage - {selectedMortgage.id}
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
                    <p className="text-sm text-muted-foreground">Applicant</p>
                    <p className="font-semibold text-foreground">
                      {selectedMortgage.applicantName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Property Type
                    </p>
                    <p className="font-semibold text-foreground">
                      {selectedMortgage.propertyType}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Property Value
                    </p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(selectedMortgage.propertyValue ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Loan Amount</p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(selectedMortgage.loanAmount ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Monthly Payment
                    </p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(selectedMortgage.monthlyPayment ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedMortgage.status)}`}
                    >
                      {selectedMortgage.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Property Address
                  </p>
                  <p className="text-foreground mt-1">
                    {selectedMortgage.propertyAddress}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                {selectedMortgage.status === "pending" && (
                  <>
                    <Button
                      onClick={handleApproveMortgage}
                      style={{ backgroundColor: primaryColor }}
                      className="flex-1 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Application
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleRejectMortgage}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedMortgage.status === "approved" && (
                  <Button
                    onClick={handleDisburseLoan}
                    style={{ backgroundColor: primaryColor }}
                    className="flex-1 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Disburse Loan
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleViewFullApplication}
                  className="flex-1"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Full Application
                </Button>
                {/* Full Application Modal */}
                {showFullAppModal && selectedMortgage && (
                  <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setShowFullAppModal(false)}
                  >
                    <div
                      className="bg-card rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 border border-border overflow-y-auto max-h-[90vh]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                          <FileText className="w-6 h-6" />
                          Full Application - {selectedMortgage.id}
                        </h2>
                        <button
                          onClick={() => setShowFullAppModal(false)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <XCircle className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Applicant Name
                            </p>
                            <p className="font-semibold text-foreground">
                              {selectedMortgage.applicantName ||
                                selectedMortgage.primary_applicant_name}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Status
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedMortgage.status)}`}
                            >
                              {selectedMortgage.status}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Product Type
                            </p>
                            <p className="font-semibold text-foreground">
                              {selectedMortgage.product_type ||
                                selectedMortgage.propertyType}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Requested Amount
                            </p>
                            <p className="font-semibold text-foreground">
                              {formatCurrency(
                                selectedMortgage.requested_amount ||
                                  selectedMortgage.loanAmount ||
                                  0,
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Down Payment
                            </p>
                            <p className="font-semibold text-foreground">
                              {formatCurrency(
                                selectedMortgage.down_payment || 0,
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Tenor (Months)
                            </p>
                            <p className="font-semibold text-foreground">
                              {selectedMortgage.requested_tenor_months ||
                                selectedMortgage.term}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Interest Rate
                            </p>
                            <p className="font-semibold text-foreground">
                              {selectedMortgage.interest_rate ||
                                selectedMortgage.interestRate}
                              %
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Monthly Payment
                            </p>
                            <p className="font-semibold text-foreground">
                              {formatCurrency(
                                selectedMortgage.monthly_payment ||
                                  selectedMortgage.monthlyPayment ||
                                  0,
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground">
                            Property Details
                          </p>
                          <div className="bg-muted rounded-lg p-4 mt-2">
                            <p>
                              <span className="font-semibold">Type:</span>{" "}
                              {selectedMortgage.property?.property_type ||
                                selectedMortgage.propertyType}
                            </p>
                            <p>
                              <span className="font-semibold">Address:</span>{" "}
                              {selectedMortgage.property?.address ||
                                selectedMortgage.propertyAddress}
                            </p>
                            <p>
                              <span className="font-semibold">City:</span>{" "}
                              {selectedMortgage.property?.city}
                            </p>
                            <p>
                              <span className="font-semibold">State:</span>{" "}
                              {selectedMortgage.property?.state}
                            </p>
                            <p>
                              <span className="font-semibold">
                                Market Value:
                              </span>{" "}
                              {formatCurrency(
                                selectedMortgage.property?.market_value || 0,
                              )}
                            </p>
                            <p>
                              <span className="font-semibold">Year Built:</span>{" "}
                              {selectedMortgage.property?.year_built}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground">
                            Applicant Details
                          </p>
                          <div className="bg-muted rounded-lg p-4 mt-2">
                            <p>
                              <span className="font-semibold">
                                Employment Type:
                              </span>{" "}
                              {selectedMortgage.employment_type}
                            </p>
                            <p>
                              <span className="font-semibold">
                                Employer Name:
                              </span>{" "}
                              {selectedMortgage.employer_name}
                            </p>
                            <p>
                              <span className="font-semibold">
                                Monthly Gross Income:
                              </span>{" "}
                              {formatCurrency(
                                selectedMortgage.monthly_gross_income || 0,
                              )}
                            </p>
                            <p>
                              <span className="font-semibold">
                                Monthly Net Income:
                              </span>{" "}
                              {formatCurrency(
                                selectedMortgage.monthly_net_income || 0,
                              )}
                            </p>
                            <p>
                              <span className="font-semibold">
                                Other Income:
                              </span>{" "}
                              {formatCurrency(
                                selectedMortgage.other_income || 0,
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground">Dates</p>
                          <div className="bg-muted rounded-lg p-4 mt-2">
                            <p>
                              <span className="font-semibold">Created At:</span>{" "}
                              {selectedMortgage.created_at}
                            </p>
                            <p>
                              <span className="font-semibold">Updated At:</span>{" "}
                              {selectedMortgage.updated_at}
                            </p>
                            <p>
                              <span className="font-semibold">
                                Submitted At:
                              </span>{" "}
                              {selectedMortgage.submitted_at || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">
                                Approved At:
                              </span>{" "}
                              {selectedMortgage.approved_at || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">
                                Disbursed At:
                              </span>{" "}
                              {selectedMortgage.disbursed_at || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mortgage Application Form */}
      <MortgageApplicationForm
        open={showApplicationForm}
        onOpenChange={setShowApplicationForm}
        onSuccess={() => {
          fetchMortgages();
        }}
      />
    </div>
  );
}
