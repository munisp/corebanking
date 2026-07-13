import { exportToExcel } from "@/lib/exportUtils";
import {
    Activity,
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
    Users,
    X,
    XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import apiClient from "../services/api";
import { kybService } from "../services/kybService";
import type { Business } from "../types/kyb";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface LPO {
  id: number | string;
  lpo_id?: string;
  supplier_id?: string;
  supplier_name?: string;
  issuing_organization?: string;
  amount?: string | number;
  lpo_amount?: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
  verified_at?: string;
  verified_by?: string;
  is_authentic?: boolean;
  disbursed_at?: string;
  disbursed_to?: string;
  financing_amount?: number;
  interest_rate?: number;
  total_repayment?: number;
  repayment_days?: number;
  repayment_due_date?: string;
  lpo_document_url?: string;
  additional_documents?: string;
  risk_score?: number | null;
  tenant_id?: string;
  lpo_number?: string;
  [key: string]: any;
}

interface LPORepayment {
  id: string;
  lpo_id: string;
  amount: string;
  currency: string;
  status: string;
  payment_date?: string;
  created_at: string;
  [key: string]: any;
}

interface Supplier {
  id: number | string;
  supplier_id: string;
  business_name: string;
  registration_number: string;
  total_lpos_financed: number;
  total_amount_financed: number;
  successful_repayments: number;
  defaulted_repayments: number;
  credit_score: number;
  created_at: string;
  updated_at: string;
  contact_email?: string;
  contact_phone?: string;
  [key: string]: any;
}

interface SupplierProfile extends Supplier {
  address?: string;
  tax_id?: string;
  bank_account?: string;
  bank_name?: string;
  [key: string]: any;
}

interface LPOsResponse {
  lpos: LPO[];
  total: number;
  [key: string]: any;
}

interface SuppliersResponse {
  suppliers: Supplier[];
  total: number;
  [key: string]: any;
}

export default function LPO() {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<
    "lpos" | "repayments" | "suppliers"
  >("lpos");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLPOId, setSelectedLPOId] = useState<string | null>(null);

  // Pagination state for LPOs tab
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [lposTotal, setLposTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // LPOs state
  const [lpos, setLpos] = useState<LPO[]>([]);
  const [lposLoading, setLposLoading] = useState(true);

  // Repayments state
  const [repayments, setRepayments] = useState<LPORepayment[]>([]);
  const [repaymentsLoading, setRepaymentsLoading] = useState(true);

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);

  // Processing state
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Supplier registration modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    supplier_id: "",
    business_name: "",
    registration_number: "",
  });
  const [registering, setRegistering] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");

  // Supplier profile/view state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  );
  const [supplierProfile, setSupplierProfile] =
    useState<SupplierProfile | null>(null);
  const [supplierLPOs, setSupplierLPOs] = useState<LPO[]>([]);
  const [showSupplierDetails, setShowSupplierDetails] = useState(false);
  const [supplierDetailsLoading, setSupplierDetailsLoading] = useState(false);

  // LPO details and modals state
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Kept for future use
  const [selectedLPO, setSelectedLPO] = useState<LPO | null>(null);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Kept for future use
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Kept for future use
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Kept for future use
  const [showLPODetails, setShowLPODetails] = useState(false);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Kept for future use
  const [lpoDetails, setLpoDetails] = useState<LPO | null>(null);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Kept for future use
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [verifyForm, setVerifyForm] = useState({
    verified_by: "Admin User",
    is_authentic: true,
  });
  const [disburseForm, setDisburseForm] = useState({
    disbursed_to: "",
  });

  const fetchLPOs = async (page = currentPage, size = pageSize, setLoading = true) => {
    if (setLoading) {
      setLposLoading(true);
    }
    try {
      const response = await apiClient.get<LPOsResponse>(
        `/lpo/api/v1/lpo/administration`,
        { params: { page, limit: size } },
      );
      const data = response.data;
      let lposData: LPO[] = [];
      if (Array.isArray(data)) {
        lposData = data;
      } else if (Array.isArray(data.lpos)) {
        lposData = data.lpos;
      } else if (data.data && Array.isArray(data.data)) {
        lposData = data.data;
      }
      setLpos(lposData);
      setLposTotal((data as any).total ?? lposData.length);
    } catch (error) {
      console.error("Error fetching LPOs:", error);
      if (setLoading) {
        setLpos([]);
      }
    } finally {
      if (setLoading) {
        setLposLoading(false);
      }
    }
  };

  // Debounce search for LPOs
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset page on filter/search/pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  // Fetch LPOs
  useEffect(() => {
    if (activeTab === "lpos" || activeTab === "repayments") {
      // Load LPOs for both LPOs tab and Repayments tab (needed for selector)
      fetchLPOs(currentPage, pageSize, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, pageSize, debouncedSearch, statusFilter]);

  const fetchRepayments = async (setLoading = true) => {
    if (!selectedLPOId) {
      setRepayments([]);
      if (setLoading) {
        setRepaymentsLoading(false);
      }
      return;
    }

    if (setLoading) {
      setRepaymentsLoading(true);
    }
    try {
      const response = await apiClient.get<
        LPORepayment[] | { repayments: LPORepayment[] }
      >(`/lpo/api/v1/lpo/${selectedLPOId}/repayments`);
      const data = response.data;

      let repaymentsData: LPORepayment[] = [];
      if (Array.isArray(data)) {
        repaymentsData = data;
      } else if (
        data &&
        typeof data === "object" &&
        "repayments" in data &&
        Array.isArray(data.repayments)
      ) {
        repaymentsData = data.repayments;
      } else if (
        data &&
        typeof data === "object" &&
        "data" in data &&
        Array.isArray((data as any).data)
      ) {
        repaymentsData = (data as any).data;
      }

      setRepayments(repaymentsData);
    } catch (error) {
      console.error("Error fetching repayments:", error);
      if (setLoading) {
        setRepayments([]);
        toast.error("Failed to fetch repayments");
      }
    } finally {
      if (setLoading) {
        setRepaymentsLoading(false);
      }
    }
  };

  // Fetch repayments for selected LPO
  useEffect(() => {
    if (activeTab === "repayments" && selectedLPOId) {
      fetchRepayments(true);
      // Refresh every 10 seconds (silently in background)
      const interval = setInterval(() => fetchRepayments(false), 10000);
      return () => clearInterval(interval);
    } else if (activeTab === "repayments" && !selectedLPOId) {
      setRepayments([]);
      setRepaymentsLoading(false);
    }
  }, [activeTab, selectedLPOId]);

  const fetchSuppliers = async (setLoading = true) => {
    if (setLoading) {
      setSuppliersLoading(true);
    }
    try {
      const response = await apiClient.get<SuppliersResponse>(
        `/lpo/api/v1/suppliers`,
      );
      const data = response.data;

      let suppliersData: Supplier[] = [];
      if (Array.isArray(data)) {
        suppliersData = data;
      } else if (
        data &&
        typeof data === "object" &&
        "suppliers" in data &&
        Array.isArray(data.suppliers)
      ) {
        suppliersData = data.suppliers;
      } else if (
        data &&
        typeof data === "object" &&
        "data" in data &&
        Array.isArray((data as any).data)
      ) {
        suppliersData = (data as any).data;
      }

      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      if (setLoading) {
        setSuppliers([]);
      }
    } finally {
      if (setLoading) {
        setSuppliersLoading(false);
      }
    }
  };

  // Fetch suppliers
  useEffect(() => {
    if (activeTab === "suppliers") {
      fetchSuppliers(true);
      // Refresh every 10 seconds (silently in background)
      const interval = setInterval(() => fetchSuppliers(false), 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchSupplierProfile = async (supplierId: string) => {
    setSupplierDetailsLoading(true);
    try {
      const response = await apiClient.get<SupplierProfile>(
        `/lpo/api/v1/lpo/supplier/${supplierId}/profile`,
      );
      setSupplierProfile(response.data);
    } catch (error) {
      console.error("Error fetching supplier profile:", error);
      toast.error("Failed to fetch supplier profile");
      setSupplierProfile(null);
    } finally {
      setSupplierDetailsLoading(false);
    }
  };

  const fetchSupplierLPOs = async (supplierId: string) => {
    try {
      const response = await apiClient.get<LPO[] | { lpos: LPO[] }>(
        `/lpo/api/v1/lpo/supplier/${supplierId}`,
      );
      const data = response.data;

      let lposData: LPO[] = [];
      if (Array.isArray(data)) {
        lposData = data;
      } else if (
        data &&
        typeof data === "object" &&
        "lpos" in data &&
        Array.isArray((data as any).lpos)
      ) {
        lposData = (data as any).lpos;
      } else if (
        data &&
        typeof data === "object" &&
        "data" in data &&
        Array.isArray((data as any).data)
      ) {
        lposData = (data as any).data;
      }

      setSupplierLPOs(lposData);
    } catch (error) {
      console.error("Error fetching supplier LPOs:", error);
      toast.error("Failed to fetch supplier LPOs");
      setSupplierLPOs([]);
    }
  };

  const handleViewSupplier = async (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setShowSupplierDetails(true);
    await Promise.all([
      fetchSupplierProfile(supplierId),
      fetchSupplierLPOs(supplierId),
    ]);
  };

  // Fetch businesses for supplier registration
  const fetchBusinesses = async () => {
    setBusinessesLoading(true);
    try {
      const { businesses: data } = await kybService.getAllBusinesses({ limit: 200 });
      // Filter only approved businesses
      const approvedBusinesses = data.filter(
        (b) => b.verification_status === "approved",
      );
      setBusinesses(approvedBusinesses);
    } catch (error) {
      console.error("Error fetching businesses:", error);
      toast.error("Failed to fetch businesses");
      setBusinesses([]);
    } finally {
      setBusinessesLoading(false);
    }
  };

  // Fetch businesses when register modal opens
  useEffect(() => {
    if (showRegisterModal) {
      fetchBusinesses();
    }
  }, [showRegisterModal]);

  // Handle business selection
  const handleBusinessSelect = (businessId: string) => {
    setSelectedBusinessId(businessId);
    const business = businesses.find((b) => b.business_id === businessId);
    if (business) {
      setRegisterForm({
        supplier_id: business.business_id,
        business_name: business.business_name,
        registration_number: business.registration_number || "",
      });
    }
  };

  const handleRegisterSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !registerForm.supplier_id ||
      !registerForm.business_name ||
      !registerForm.registration_number
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setRegistering(true);
    try {
      const params = new URLSearchParams({
        supplier_id: registerForm.supplier_id,
        business_name: registerForm.business_name,
        registration_number: registerForm.registration_number,
      });
      await apiClient.post(
        `/lpo/api/v1/lpo/supplier/register?${params.toString()}`,
      );
      toast.success("Supplier registered successfully");
      setShowRegisterModal(false);
      setRegisterForm({
        supplier_id: "",
        business_name: "",
        registration_number: "",
      });
      await fetchSuppliers();
    } catch (error: any) {
      console.error("Error registering supplier:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to register supplier";
      toast.error(errorMessage);
    } finally {
      setRegistering(false);
    }
  };

  // LPOs are already filtered server-side
  const filteredLPOs = lpos;

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const matchesSearch =
        !searchTerm ||
        String(supplier.id || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        supplier.supplier_id
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        supplier.business_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        supplier.registration_number
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [suppliers, searchTerm]);

  // Calculate LPO statistics from current page
  const lpoStats = useMemo(() => {
    const total = lposTotal;
    const totalAmount = filteredLPOs.reduce((sum, lpo) => {
      const amount = lpo.lpo_amount || lpo.amount;
      return (
        sum +
        (typeof amount === "number"
          ? amount
          : parseFloat(String(amount || "0")))
      );
    }, 0);
    const pending = filteredLPOs.filter((lpo) => {
      const status = lpo.status?.toLowerCase() || "";
      return status === "pending" || status === "under_review";
    }).length;
    const approved = filteredLPOs.filter(
      (lpo) => lpo.status?.toLowerCase() === "approved",
    ).length;
    const rejected = filteredLPOs.filter(
      (lpo) => lpo.status?.toLowerCase() === "rejected",
    ).length;

    return { total, totalAmount, pending, approved, rejected };
  }, [filteredLPOs]);

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "approved") {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    }
    if (statusLower === "rejected") {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    }
    if (statusLower === "pending" || statusLower === "under_review") {
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    }
    return "bg-muted text-foreground";
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "approved") {
      return <CheckCircle className="w-4 h-4" />;
    }
    if (statusLower === "rejected") {
      return <XCircle className="w-4 h-4" />;
    }
    if (statusLower === "pending" || statusLower === "under_review") {
      return <Clock className="w-4 h-4" />;
    }
    return null;
  };

  // Verify LPO
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Kept for future use
  const handleVerifyLPO = async (lpoId: string) => {
    if (processingIds.has(lpoId)) return;

    setProcessingIds((prev) => new Set(prev).add(lpoId));

    try {
      await apiClient.post(`/lpo/api/v1/lpo/${lpoId}/verify`, {
        lpo_id: lpoId,
        verified_by: verifyForm.verified_by,
        is_authentic: verifyForm.is_authentic,
      });
      toast.success("LPO verified successfully");
      setShowVerifyModal(false);
      setVerifyForm({ verified_by: "Admin User", is_authentic: true });
      await fetchLPOs();
    } catch (error: any) {
      console.error("Error verifying LPO:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to verify LPO";
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(lpoId);
        return newSet;
      });
    }
  };

  // Approve LPO (only for verified LPOs)
  const handleApproveLPO = async (lpoId: string) => {
    if (processingIds.has(lpoId)) return;

    setProcessingIds((prev) => new Set(prev).add(lpoId));

    try {
      await apiClient.post(`/lpo/api/v1/lpo/${lpoId}/approve`, {
        lpo_id: lpoId,
        approved_by: "Admin User",
      });
      toast.success("LPO approved successfully");
      await fetchLPOs();
    } catch (error: any) {
      console.error("Error approving LPO:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to approve LPO";
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(lpoId);
        return newSet;
      });
    }
  };

  // Disburse LPO (only for approved LPOs)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Kept for future use
  const handleDisburseLPO = async (lpoId: string) => {
    if (processingIds.has(lpoId)) return;

    if (!disburseForm.disbursed_to.trim()) {
      toast.error("Please provide a disbursement recipient");
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(lpoId));

    try {
      await apiClient.post(`/lpo/api/v1/lpo/${lpoId}/disburse`, {
        lpo_id: lpoId,
        disbursed_to: disburseForm.disbursed_to,
      });
      toast.success("LPO disbursed successfully");
      setShowDisburseModal(false);
      setDisburseForm({ disbursed_to: "" });
      await fetchLPOs();
    } catch (error: any) {
      console.error("Error disbursing LPO:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to disburse LPO";
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(lpoId);
        return newSet;
      });
    }
  };

  // Fetch LPO details
  const fetchLPODetails = async (lpoId: string) => {
    setDetailsLoading(true);
    try {
      const response = await apiClient.get<LPO>(`/api/v1/lpo/${lpoId}`);
      setLpoDetails(response.data);
    } catch (error: any) {
      console.error("Error fetching LPO details:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to fetch LPO details";
      toast.error(errorMessage);
      setLpoDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Handle view LPO details
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Kept for future use
  const handleViewLPODetails = async (lpo: LPO) => {
    setSelectedLPO(lpo);
    setShowLPODetails(true);
    await fetchLPODetails(String(lpo.lpo_id || lpo.id));
  };

  const handleRejectLPO = async (lpoId: string, reason?: string) => {
    if (processingIds.has(lpoId)) return;

    const rejectionReason =
      reason || prompt("Please provide a reason for rejection:");
    if (!rejectionReason) {
      toast.error("Rejection reason is required");
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(lpoId));

    try {
      await apiClient.post(`/lpo/api/v1/lpo/${lpoId}/decline`, {
        lpo_id: lpoId,
        rejected_by: "Admin User",
        reason: rejectionReason,
      });
      toast.success("LPO rejected successfully");
      await fetchLPOs();
    } catch (error: any) {
      console.error("Error rejecting LPO:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to reject LPO";
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(lpoId);
        return newSet;
      });
    }
  };

  const handleExportExcel = () => {
    let data: any[] = [];
    if (activeTab === "lpos") {
      data = filteredLPOs.map((lpo) => {
        const lpoId = lpo.lpo_id || String(lpo.id);
        const supplierName =
          lpo.supplier_name || lpo.issuing_organization || "N/A";
        const amount = lpo.lpo_amount || lpo.amount;
        const displayAmount =
          typeof amount === "number"
            ? amount
            : parseFloat(String(amount || "0"));
        return {
          "LPO ID": lpoId,
          Supplier: supplierName,
          Amount: `${lpo.currency} ${displayAmount.toLocaleString()}`,
          Status: lpo.status,
          Created: new Date(lpo.created_at).toLocaleDateString(),
        };
      });
      exportToExcel(data, "lpos");
    } else if (activeTab === "suppliers") {
      data = filteredSuppliers.map((supplier) => ({
        "Supplier ID": supplier.supplier_id,
        "Business Name": supplier.business_name,
        "Registration Number": supplier.registration_number,
        "Total LPOs Financed": supplier.total_lpos_financed || 0,
        "Total Amount Financed": `₦${(supplier.total_amount_financed || 0).toLocaleString()}`,
        "Successful Repayments": supplier.successful_repayments || 0,
        "Defaulted Repayments": supplier.defaulted_repayments || 0,
        "Credit Score": supplier.credit_score || 0,
        Created: new Date(supplier.created_at).toLocaleDateString(),
      }));
      exportToExcel(data, "suppliers");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background ">
      <div className="container py-8">
        <PageHeader
          label="LPO Management"
          title="Local Purchase Orders (LPO)"
          description="Manage LPOs, repayments, and suppliers"
          icon={<FileText className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
            disabled={lposLoading || suppliersLoading}
          >
            <Download className="w-5 h-5" />
            Excel
          </button>
        </div>
        {/* Tabs */}
        <div className="bg-card rounded-xl shadow-lg border border-border mb-8">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("lpos")}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === "lpos"
                  ? "border-b-2 text-foreground"
                  : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              }`}
              style={
                activeTab === "lpos" ? { borderBottomColor: primaryColor } : {}
              }
            >
              LPOs
            </button>
            {/* <button
              onClick={() => setActiveTab('repayments')}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === 'repayments'
                  ? 'border-b-2 text-foreground'
                  : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
              }`}
              style={activeTab === 'repayments' ? { borderBottomColor: primaryColor } : {}}
            >
              Repayments
            </button> */}
            <button
              onClick={() => setActiveTab("suppliers")}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === "suppliers"
                  ? "border-b-2 text-foreground"
                  : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              }`}
              style={
                activeTab === "suppliers"
                  ? { borderBottomColor: primaryColor }
                  : {}
              }
            >
              Suppliers
            </button>
          </div>
        </div>

        {/* LPOs Tab */}
        {activeTab === "lpos" && (
          <>
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">
                    Total LPOs
                  </div>
                  <FileText
                    className="w-5 h-5"
                    style={{ color: primaryColor }}
                  />
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {lpoStats.total}
                </div>
              </div>
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="text-sm text-muted-foreground mb-2">
                  Total Lpo Amount
                </div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  ₦{(lpoStats.totalAmount / 1000).toFixed(1)}K
                </div>
              </div>
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="text-sm text-muted-foreground mb-2">
                  Total Paid Amount
                </div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  ₦{(lpoStats.totalAmount / 1000).toFixed(1)}K
                </div>
              </div>
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="text-sm text-muted-foreground mb-2">
                  Approved
                </div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {lpoStats.approved}
                </div>
              </div>
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <div className="text-sm text-muted-foreground mb-2">
                  Pending
                </div>
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {lpoStats.pending}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search LPOs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending / Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* LPOs Table */}
            <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  LPOs ({lposTotal})
                </h3>
              </div>

              {lposLoading ? (
                <div className="p-12 text-center">
                  <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading LPOs...</p>
                </div>
              ) : filteredLPOs.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No LPOs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          LPO ID
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Supplier
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Total Lpo Amount
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Total Paid Amount
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
                      {filteredLPOs.map((lpo) => {
                        const lpoStatus = lpo.status?.toLowerCase() || "";
                        // const isPending = lpoStatus === 'pending' || lpoStatus === 'under_review';
                        const lpoId = lpo.lpo_id || String(lpo.id);
                        const isProcessing = processingIds.has(lpoId);
                        const supplierName =
                          lpo.supplier_name ||
                          lpo.issuing_organization ||
                          "N/A";
                        const amount = lpo.lpo_amount || lpo.amount;
                        const displayAmount =
                          typeof amount === "number"
                            ? amount
                            : parseFloat(String(amount || "0"));
                        const displayStatus =
                          lpoStatus === "under_review"
                            ? "Under Review"
                            : lpo.status || "Unknown";

                        return (
                          <tr
                            key={lpo.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-6 py-4 font-mono text-sm text-foreground">
                              {lpoId}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {supplierName}
                            </td>
                            <td className="px-6 py-4 font-semibold text-foreground">
                              {lpo.currency} {displayAmount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-semibold text-foreground">
                              {lpo.currency} {displayAmount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1 w-fit ${getStatusColor(lpo.status || "")}`}
                              >
                                {getStatusIcon(lpo.status || "")}
                                {displayStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {new Date(lpo.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {/* Show Verify button if status is under_review or pending */}
                                {(lpo.status?.toLowerCase() ===
                                  "under_review" ||
                                  lpo.status?.toLowerCase() === "pending") && (
                                  <button
                                    onClick={() => handleVerifyLPO(lpoId)}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    {isProcessing ? "Verifying..." : "Verify"}
                                  </button>
                                )}
                                {/* Show Disburse button if status is approved */}
{lpo.status?.toLowerCase() === "approved" && (
  <button
    onClick={() => {
      setSelectedLPO(lpo);
      setDisburseForm({
        disbursed_to:
          lpo.supplier_id ||
          lpo.disbursed_to ||
          "",
      });
      handleDisburseLPO(lpoId);
    }}
    disabled={isProcessing}
    className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
  >
    {isProcessing ? (
      <>
        <Activity className="w-3 h-3 animate-spin" />
        Disbursing...
      </>
    ) : (
      <>
        <DollarSign className="w-3 h-3" />
        Disburse
      </>
    )}
  </button>
)}
                                {/* Show Approve button if status is verified */}
                                {lpo.status?.toLowerCase() === "verified" && (
                                  <button
                                    onClick={() => handleApproveLPO(lpoId)}
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
                                )}
                                {/* Always show Reject button if pending/under_review */}
                                {(lpo.status?.toLowerCase() ===
                                  "under_review" ||
                                  lpo.status?.toLowerCase() === "pending") && (
                                  <button
                                    onClick={() => handleRejectLPO(lpoId)}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    Reject
                                  </button>
                                )}
                                {/* Verify Modal (simple confirm, can be improved) */}
                                {showVerifyModal && (
                                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8 w-full max-w-sm border border-border">
                                      <h2 className="text-lg font-bold mb-4">
                                        Verify LPO
                                      </h2>
                                      <p className="mb-4">
                                        Are you sure you want to verify this
                                        LPO?
                                      </p>
                                      <div className="flex gap-2 justify-end">
                                        <button
                                          className="px-4 py-2 rounded-lg border border-border bg-muted hover:bg-slate-200 dark:hover:bg-slate-800"
                                          onClick={() =>
                                            setShowVerifyModal(false)
                                          }
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          className="px-4 py-2 rounded-lg text-white font-semibold"
                                          style={{
                                            backgroundColor: primaryColor,
                                          }}
                                          onClick={async () => {
                                            if (selectedLPOId)
                                              await handleVerifyLPO(
                                                selectedLPOId,
                                              );
                                          }}
                                        >
                                          Confirm
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedLPOId(lpoId);
                                    setActiveTab("repayments");
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted"
                                >
                                  View Repayments
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {lposTotal > 0 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
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
                    <span className="text-sm text-muted-foreground">Page {currentPage} of {Math.max(1, Math.ceil(lposTotal / pageSize))}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(Math.max(1, Math.ceil(lposTotal / pageSize)), p + 1))} disabled={currentPage >= Math.max(1, Math.ceil(lposTotal / pageSize))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Repayments Tab */}
        {activeTab === "repayments" && (
          <>
            {/* LPO Selector */}
            <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-8">
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-foreground whitespace-nowrap">
                  Select LPO:
                </label>
                <select
                  value={selectedLPOId || ""}
                  onChange={(e) => setSelectedLPOId(e.target.value || null)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                  style={
                    { "--tw-ring-color": primaryColor } as React.CSSProperties
                  }
                >
                  <option value="">-- Select an LPO --</option>
                  {lpos.map((lpo) => {
                    const lpoId = lpo.lpo_id || String(lpo.id);
                    const supplierName =
                      lpo.supplier_name || lpo.issuing_organization || "N/A";
                    const amount = lpo.lpo_amount || lpo.amount;
                    const displayAmount =
                      typeof amount === "number"
                        ? amount
                        : parseFloat(String(amount || "0"));
                    return (
                      <option key={lpo.id} value={lpoId}>
                        {lpoId} - {supplierName} ({lpo.currency}{" "}
                        {displayAmount.toLocaleString()})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {!selectedLPOId ? (
              <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Please select an LPO to view repayments
                  </p>
                </div>
              </div>
            ) : repaymentsLoading ? (
              <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
                <div className="p-12 text-center">
                  <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading repayments...</p>
                </div>
              </div>
            ) : repayments.length === 0 ? (
              <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No repayments found for this LPO
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Repayment Statistics */}
                {(() => {
                  const totalAmount = repayments.reduce(
                    (sum, r) => sum + parseFloat(r.amount || "0"),
                    0,
                  );
                  const paidAmount = repayments
                    .filter(
                      (r) =>
                        r.status?.toLowerCase() === "paid" ||
                        r.status?.toLowerCase() === "completed",
                    )
                    .reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
                  const pendingAmount = repayments
                    .filter((r) => r.status?.toLowerCase() === "pending")
                    .reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
                  const paidCount = repayments.filter(
                    (r) =>
                      r.status?.toLowerCase() === "paid" ||
                      r.status?.toLowerCase() === "completed",
                  ).length;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-muted-foreground">
                            Total Repayments
                          </div>
                          <DollarSign
                            className="w-5 h-5"
                            style={{ color: primaryColor }}
                          />
                        </div>
                        <div className="text-3xl font-bold text-foreground">
                          {repayments.length}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Total: {repayments[0]?.currency || "NGN"}{" "}
                          {totalAmount.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                        <div className="text-sm text-muted-foreground mb-2">
                          Paid Amount
                        </div>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {repayments[0]?.currency || "NGN"}{" "}
                          {(paidAmount / 1000).toFixed(1)}K
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {paidCount} completed
                        </div>
                      </div>
                      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                        <div className="text-sm text-muted-foreground mb-2">
                          Pending Amount
                        </div>
                        <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                          {repayments[0]?.currency || "NGN"}{" "}
                          {(pendingAmount / 1000).toFixed(1)}K
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {
                            repayments.filter(
                              (r) => r.status?.toLowerCase() === "pending",
                            ).length
                          }{" "}
                          pending
                        </div>
                      </div>
                      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                        <div className="text-sm text-muted-foreground mb-2">
                          Payment Rate
                        </div>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {totalAmount > 0
                            ? ((paidAmount / totalAmount) * 100).toFixed(1)
                            : "0.0"}
                          %
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Completion rate
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Repayments Table */}
                <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
                  <div className="p-6 border-b border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        Repayments for LPO: {selectedLPOId} ({repayments.length}
                        )
                      </h3>
                      <button
                        onClick={() => {
                          const data = repayments.map((r) => ({
                            "Repayment ID": r.id,
                            "LPO ID": r.lpo_id,
                            Amount: `${r.currency} ${parseFloat(r.amount || "0").toLocaleString()}`,
                            Status: r.status,
                            "Payment Date": r.payment_date || "N/A",
                            Created: r.created_at,
                          }));
                          exportToExcel(
                            data,
                            `lpo-${selectedLPOId}-repayments`,
                          );
                        }}
                        className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Export Excel
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                            Repayment ID
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                            Amount
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                            Payment Date
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                            Created
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {repayments.map((repayment) => (
                          <tr
                            key={repayment.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-6 py-4 font-mono text-sm text-foreground">
                              {repayment.id}
                            </td>
                            <td className="px-6 py-4 font-semibold text-foreground">
                              {repayment.currency}{" "}
                              {parseFloat(
                                repayment.amount || "0",
                              ).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1 w-fit ${getStatusColor(repayment.status || "")}`}
                              >
                                {getStatusIcon(repayment.status || "")}
                                {repayment.status || "Unknown"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {repayment.payment_date
                                ? new Date(
                                    repayment.payment_date,
                                  ).toLocaleDateString()
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {new Date(
                                repayment.created_at,
                              ).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Suppliers Tab */}
        {activeTab === "suppliers" && (
          <>
            {/* Statistics */}
            {(() => {
              const totalAmount = suppliers.reduce(
                (sum, s) => sum + (s.total_amount_financed || 0),
                0,
              );
              const totalSuccessful = suppliers.reduce(
                (sum, s) => sum + (s.successful_repayments || 0),
                0,
              );
              const totalDefaulted = suppliers.reduce(
                (sum, s) => sum + (s.defaulted_repayments || 0),
                0,
              );
              const avgCreditScore =
                suppliers.length > 0
                  ? (
                      suppliers.reduce(
                        (sum, s) => sum + (s.credit_score || 0),
                        0,
                      ) / suppliers.length
                    ).toFixed(1)
                  : "0.0";

              return (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-muted-foreground">
                        Total Suppliers
                      </div>
                      <Users
                        className="w-5 h-5"
                        style={{ color: primaryColor }}
                      />
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                      {suppliers.length}
                    </div>
                  </div>
                  <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                    <div className="text-sm text-muted-foreground mb-2">
                      Total Financed
                    </div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      ₦{(totalAmount / 1000).toFixed(1)}K
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {suppliers.reduce(
                        (sum, s) => sum + (s.total_lpos_financed || 0),
                        0,
                      )}{" "}
                      LPOs
                    </div>
                  </div>
                  <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                    <div className="text-sm text-muted-foreground mb-2">
                      Successful Repayments
                    </div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {totalSuccessful}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {totalDefaulted} defaulted
                    </div>
                  </div>
                  <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                    <div className="text-sm text-muted-foreground mb-2">
                      Avg Credit Score
                    </div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {avgCreditScore}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Out of 100
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Actions and Filters */}
            <div className="bg-card rounded-xl shadow-lg p-6 border border-border mb-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="px-4 py-2 text-white rounded-lg font-semibold hover:opacity-90 flex items-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="w-5 h-5" />
                  Register Supplier
                </button>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search suppliers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                  />
                </div>
              </div>
            </div>

            {/* Suppliers Table */}
            <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  Suppliers ({filteredSuppliers.length})
                </h3>
              </div>

              {suppliersLoading ? (
                <div className="p-12 text-center">
                  <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading suppliers...</p>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No suppliers found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Supplier ID
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Business Name
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Registration Number
                        </th>
                        {/* <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">LPOs Financed</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Amount Financed</th> */}
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Credit Score
                        </th>
                        {/* <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Repayments</th> */}
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredSuppliers.map((supplier) => (
                        <tr
                          key={supplier.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-4 font-mono text-sm text-foreground">
                            {supplier.supplier_id}
                          </td>
                          <td className="px-6 py-4 font-semibold text-foreground">
                            {supplier.business_name}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {supplier.registration_number}
                          </td>
                          {/* <td className="px-6 py-4 text-muted-foreground">
                            {supplier.total_lpos_financed || 0}
                          </td>
                          <td className="px-6 py-4 font-semibold text-foreground">
                            ₦{(supplier.total_amount_financed || 0).toLocaleString()}
                          </td> */}
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                (supplier.credit_score || 0) >= 70
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                  : (supplier.credit_score || 0) >= 50
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              }`}
                            >
                              {supplier.credit_score || 0}
                            </span>
                          </td>
                          {/* <td className="px-6 py-4 text-muted-foreground">
                            <div className="text-sm">
                              <span className="text-green-600 dark:text-green-400">{supplier.successful_repayments || 0}</span>
                              <span className="text-muted-foreground mx-1">/</span>
                              <span className="text-red-600 dark:text-red-400">{supplier.defaulted_repayments || 0}</span>
                            </div>
                          </td> */}
                          <td className="px-6 py-4">
                            <button
                              onClick={() =>
                                handleViewSupplier(supplier.supplier_id)
                              }
                              className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Register Supplier Modal */}
            {showRegisterModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-md">
                  <div className="p-6 border-b border-border flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      Register New Supplier
                    </h3>
                    <button
                      onClick={() => {
                        setShowRegisterModal(false);
                        setRegisterForm({
                          supplier_id: "",
                          business_name: "",
                          registration_number: "",
                        });
                        setSelectedBusinessId("");
                      }}
                      className="text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form
                    onSubmit={handleRegisterSupplier}
                    className="p-6 space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Select Business <span className="text-red-500">*</span>
                      </label>
                      {businessesLoading ? (
                        <div className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-muted-foreground">
                          Loading businesses...
                        </div>
                      ) : businesses.length === 0 ? (
                        <div className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-muted-foreground">
                          No approved businesses available. Please register
                          businesses first.
                        </div>
                      ) : (
                        <select
                          required
                          value={selectedBusinessId}
                          onChange={(e) => handleBusinessSelect(e.target.value)}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                        >
                          <option value="">-- Select a business --</option>
                          {businesses.map((business) => (
                            <option
                              key={business.business_id}
                              value={business.business_id}
                            >
                              {business.business_name} (
                              {business.registration_number})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Supplier ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={registerForm.supplier_id}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({
                            ...prev,
                            supplier_id: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                        placeholder="Enter supplier ID"
                        readOnly={!!selectedBusinessId}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Business Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={registerForm.business_name}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({
                            ...prev,
                            business_name: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                        placeholder="Enter business name"
                        readOnly={!!selectedBusinessId}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Registration Number{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={registerForm.registration_number}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({
                            ...prev,
                            registration_number: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                        placeholder="Enter registration number"
                        readOnly={!!selectedBusinessId}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-4">
                      <button
                        type="submit"
                        disabled={registering}
                        className="flex-1 px-4 py-2 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {registering ? "Registering..." : "Register Supplier"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRegisterModal(false);
                          setRegisterForm({
                            supplier_id: "",
                            business_name: "",
                            registration_number: "",
                          });
                          setSelectedBusinessId("");
                        }}
                        className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Supplier Details Modal */}
            {showSupplierDetails && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                    <h3 className="text-lg font-semibold text-foreground">
                      Supplier Details: {selectedSupplierId}
                    </h3>
                    <button
                      onClick={() => {
                        setShowSupplierDetails(false);
                        setSelectedSupplierId(null);
                        setSupplierProfile(null);
                        setSupplierLPOs([]);
                      }}
                      className="text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {supplierDetailsLoading ? (
                      <div className="text-center py-12">
                        <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Loading supplier details...
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Supplier Profile */}
                        {supplierProfile && (
                          <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-border">
                              <h4 className="text-md font-semibold text-foreground mb-4">
                                Profile Information
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs text-muted-foreground">
                                    Business Name
                                  </label>
                                  <p className="text-sm font-medium text-foreground">
                                    {supplierProfile.business_name}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">
                                    Supplier ID
                                  </label>
                                  <p className="text-sm font-medium text-foreground font-mono">
                                    {supplierProfile.supplier_id}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">
                                    Registration Number
                                  </label>
                                  <p className="text-sm font-medium text-foreground">
                                    {supplierProfile.registration_number}
                                  </p>
                                </div>
                                {supplierProfile.contact_email && (
                                  <div>
                                    <label className="text-xs text-muted-foreground">
                                      Contact Email
                                    </label>
                                    <p className="text-sm font-medium text-foreground">
                                      {supplierProfile.contact_email}
                                    </p>
                                  </div>
                                )}
                                {supplierProfile.contact_phone && (
                                  <div>
                                    <label className="text-xs text-muted-foreground">
                                      Contact Phone
                                    </label>
                                    <p className="text-sm font-medium text-foreground">
                                      {supplierProfile.contact_phone}
                                    </p>
                                  </div>
                                )}
                                {supplierProfile.address && (
                                  <div>
                                    <label className="text-xs text-muted-foreground">
                                      Address
                                    </label>
                                    <p className="text-sm font-medium text-foreground">
                                      {supplierProfile.address}
                                    </p>
                                  </div>
                                )}
                                {supplierProfile.tax_id && (
                                  <div>
                                    <label className="text-xs text-muted-foreground">
                                      Tax ID
                                    </label>
                                    <p className="text-sm font-medium text-foreground">
                                      {supplierProfile.tax_id}
                                    </p>
                                  </div>
                                )}
                                {supplierProfile.bank_account && (
                                  <div>
                                    <label className="text-xs text-muted-foreground">
                                      Bank Account
                                    </label>
                                    <p className="text-sm font-medium text-foreground">
                                      {supplierProfile.bank_account}
                                    </p>
                                  </div>
                                )}
                                {supplierProfile.bank_name && (
                                  <div>
                                    <label className="text-xs text-muted-foreground">
                                      Bank Name
                                    </label>
                                    <p className="text-sm font-medium text-foreground">
                                      {supplierProfile.bank_name}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Financial Statistics */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-border">
                                <label className="text-xs text-muted-foreground">
                                  Total LPOs Financed
                                </label>
                                <p className="text-lg font-bold text-foreground">
                                  {supplierProfile.total_lpos_financed || 0}
                                </p>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-border">
                                <label className="text-xs text-muted-foreground">
                                  Total Amount Financed
                                </label>
                                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                  ₦
                                  {(
                                    supplierProfile.total_amount_financed || 0
                                  ).toLocaleString()}
                                </p>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-border">
                                <label className="text-xs text-muted-foreground">
                                  Credit Score
                                </label>
                                <p
                                  className={`text-lg font-bold ${
                                    (supplierProfile.credit_score || 0) >= 70
                                      ? "text-green-600 dark:text-green-400"
                                      : (supplierProfile.credit_score || 0) >=
                                          50
                                        ? "text-yellow-600 dark:text-yellow-400"
                                        : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {supplierProfile.credit_score || 0}
                                </p>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-border">
                                <label className="text-xs text-muted-foreground">
                                  Repayment Status
                                </label>
                                <p className="text-lg font-bold text-foreground">
                                  <span className="text-green-600 dark:text-green-400">
                                    {supplierProfile.successful_repayments || 0}
                                  </span>
                                  <span className="text-muted-foreground mx-1">
                                    /
                                  </span>
                                  <span className="text-red-600 dark:text-red-400">
                                    {supplierProfile.defaulted_repayments || 0}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Supplier LPOs */}
                        <div>
                          <h4 className="text-md font-semibold text-foreground mb-4">
                            LPOs ({supplierLPOs.length})
                          </h4>
                          {supplierLPOs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              No LPOs found for this supplier
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-muted/50 border-b border-border">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                                      LPO ID
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                                      Amount
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                                      Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">
                                      Created
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                  {supplierLPOs.map((lpo) => {
                                    const lpoId = lpo.lpo_id || String(lpo.id);
                                    const amount = lpo.lpo_amount || lpo.amount;
                                    const displayAmount =
                                      typeof amount === "number"
                                        ? amount
                                        : parseFloat(String(amount || "0"));
                                    const displayStatus =
                                      lpo.status?.toLowerCase() ===
                                      "under_review"
                                        ? "Under Review"
                                        : lpo.status || "Unknown";
                                    return (
                                      <tr
                                        key={lpo.id}
                                        className="hover:bg-muted/30 transition-colors"
                                      >
                                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                                          {lpoId}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-xs text-foreground">
                                          {lpo.currency}{" "}
                                          {displayAmount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                          <span
                                            className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(lpo.status || "")}`}
                                          >
                                            {displayStatus}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                          {new Date(
                                            lpo.created_at,
                                          ).toLocaleDateString()}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
