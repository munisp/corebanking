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
import {
    AlertCircle,
    CheckCircle,
    Clock,
    DollarSign,
    Eye,
    FileText,
    Plus,
    RefreshCw,
    Search,
    Shield,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import apiClient from "../services/api";

interface EtheriscPolicy {
  policy_id: string;
  insurance_type: string;
  coverage_amount: number;
  premium_amount: number;
  trigger_conditions: any;
  duration_days: number;
  status?: string;
  created_at?: string;
}

interface InsurancePolicy {
  policy_id: string;
  policy_type: string;
  coverage_amount: number;
  premium_amount: number;
  status: "active" | "inactive" | "expired" | "pending";
  holder_name?: string;
  holder_id?: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
}

interface Claim {
  claim_id: string;
  policy_id: string;
  claim_amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  claim_date: string;
  description?: string;
  claimant_name?: string;
  reviewed_at?: string;
  paid_at?: string;
}

interface Payout {
  payout_id: string;
  policy_id: string;
  amount: number;
  status: string;
  created_at: string;
}

type TabType = "policies" | "claims" | "etherisc";

export default function InsurancePage() {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<TabType>("policies");

  // Policies state
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesPage, setPoliciesPage] = useState(1);
  const [policiesTotal, setPoliciesTotal] = useState(0);
  const [claimsPage, setClaimsPage] = useState(1);
  const [claimsTotal, setClaimsTotal] = useState(0);
  const pageLimit = 10;
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(
    null,
  );
  const [showPolicyDetailsModal, setShowPolicyDetailsModal] = useState(false);

  // Etherisc policies state
  const [etheriscPolicies, setEtheriscPolicies] = useState<EtheriscPolicy[]>(
    [],
  );
  const [etheriscLoading, setEtheriscLoading] = useState(false);
  const [showCreatePolicyModal, setShowCreatePolicyModal] = useState(false);
  type TriggerConditions = {
    delay_minutes?: number;
    rainfall_mm?: number;
    temperature_celsius?: number;
    wind_speed_kmh?: number;
    category?: number;
    magnitude?: number;
    [key: string]: any;
  };

  const [policyForm, setPolicyForm] = useState<{
    insurance_type: string;
    coverage_amount: string;
    premium_amount: string;
    trigger_conditions: TriggerConditions;
    duration_days: string;
  }>({
    insurance_type: "flight_delay",
    coverage_amount: "1000",
    premium_amount: "100",
    trigger_conditions: { delay_minutes: 60 },
    duration_days: "3",
  });
  const [payouts] = useState<Payout[]>([]);
  // const [selectedEtheriscPolicy, setSelectedEtheriscPolicy] = useState<string>("");

  // Claims state
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showClaimDetailsModal, setShowClaimDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Claim review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewClaimId, setReviewClaimId] = useState<string | null>(null);
  const [reviewPolicyId, setReviewPolicyId] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState<
    "approved" | "rejected" | ""
  >("");
  const [reviewApprovedAmount, setReviewApprovedAmount] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Fetch all etherisc policy templates
  const fetchEtheriscPolicies = async () => {
    setEtheriscLoading(true);
    try {
      const response = await apiClient.get(
        "/etherisc/api/v1/etherisc/policies/all",
      );
      setEtheriscPolicies(
        Array.isArray(response.data.policies)
          ? response.data.policies
          : response.data || [],
      );
    } catch (error) {
      toast.error("Failed to fetch Etherisc policy templates");
      console.log(error);

      setEtheriscPolicies([]);
    } finally {
      setEtheriscLoading(false);
    }
  };

  // Fetch insurance policies
  const fetchPolicies = async () => {
    setPoliciesLoading(true);
    try {
      const response = await apiClient.get(
        "/insurance/api/v1/insurance/policies/all",
        { params: { page: policiesPage, limit: pageLimit } },
      );
      setPolicies(
        Array.isArray(response.data.policies)
          ? response.data.policies
          : response.data || [],
      );
      setPoliciesTotal(response.data.total ?? response.data.count ?? response.data.policies?.length ?? 0);
    } catch (error) {
      toast.error("Failed to fetch policies");
      console.log(error);
      setPolicies([]);
    } finally {
      setPoliciesLoading(false);
    }
  };

  // Fetch policy by ID
  const fetchPolicyById = async (policyId: string) => {
    try {
      const response = await apiClient.get(
        `/insurance/api/v1/insurance/policies/${policyId}`,
      );
      setSelectedPolicy(response.data.policy || response.data);
      setShowPolicyDetailsModal(true);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to fetch policy details",
      );
    }
  };

  // Activate policy
  const handleActivatePolicy = async (policyId: string) => {
    try {
      await apiClient.post(
        `/insurance/api/v1/administration/insurance/policies/${policyId}/activate`,
      );
      toast.success("Policy activated successfully");
      // Refresh the policy details
      await fetchPolicyById(policyId);
      // Refresh the policies list
      fetchPolicies();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to activate policy");
    }
  };

  // Deactivate policy
  const handleDeactivatePolicy = async (policyId: string) => {
    try {
      await apiClient.post(
        `/insurance/api/v1/insurance/policies/${policyId}/deactivate`,
      );
      toast.success("Policy deactivated successfully");
      // Refresh the policy details
      await fetchPolicyById(policyId);
      // Refresh the policies list
      fetchPolicies();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to deactivate policy",
      );
    }
  };

  // Fetch all claims
  const fetchAllClaims = async () => {
    setClaimsLoading(true);
    try {
      const response = await apiClient.get(
        "/insurance/api/v1/insurance/claims/all",
        { params: { page: claimsPage, limit: pageLimit } },
      );
      setClaims(
        Array.isArray(response.data.claims)
          ? response.data.claims
          : response.data || [],
      );
      setClaimsTotal(response.data.total ?? response.data.count ?? response.data.claims?.length ?? 0);
    } catch (error) {
      toast.error("Failed to fetch claims");
      console.log(error);
      setClaims([]);
    } finally {
      setClaimsLoading(false);
    }
  };

  // Fetch claims for a policy
  const fetchClaims = async (policyId?: string) => {
    setClaimsLoading(true);
    try {
      if (policyId) {
        const response = await apiClient.get(
          `/insurance/api/v1/insurance/claims/policy/${policyId}`,
        );
        setClaims(
          Array.isArray(response.data.claims) ? response.data.claims : [],
        );
      } else {
        toast.info("Enter a policy ID to view its claims");
        setClaims([]);
      }
    } catch (error) {
      toast.error("Failed to fetch claims");
      setClaims([]);
    } finally {
      setClaimsLoading(false);
    }
  };

  // Fetch claim details
  const fetchClaimDetails = async (claimId: string) => {
    try {
      const response = await apiClient.get(
        `/insurance/api/v1/insurance/claims/${claimId}`,
      );
      setSelectedClaim(response.data.claim || response.data);
      setShowClaimDetailsModal(true);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to fetch claim details",
      );
    }
  };

  // Pay claim
  const handlePayClaim = async (claimId: string, policyId: string) => {
    try {
      await apiClient.post(
        `/api/v1/administration/insurance/claims/${claimId}/pay`,
        { policy_id: policyId },
      );
      toast.success("Claim paid successfully");
      fetchClaims(policyId);
      setShowClaimDetailsModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to pay claim");
    }
  };

  // Create Etherisc policy
  const handleCreatePolicy = async () => {
    try {
      const payload = {
        insurance_type: policyForm.insurance_type,
        coverage_amount: parseFloat(policyForm.coverage_amount),
        premium_amount: parseFloat(policyForm.premium_amount),
        trigger_conditions: policyForm.trigger_conditions,
        duration_days: parseInt(policyForm.duration_days),
      };

      const response = await apiClient.post(
        "/etherisc/api/v1/etherisc/policies/create",
        payload,
      );
      toast.success("Policy created successfully");
      setShowCreatePolicyModal(false);
      setPolicyForm({
        insurance_type: "flight_delay",
        coverage_amount: "1000",
        premium_amount: "100",
        trigger_conditions: { delay_minutes: 60 },
        duration_days: "3",
      });

      // Add to local state and refresh the list
      if (response.data.policy) {
        setEtheriscPolicies([response.data.policy, ...etheriscPolicies]);
      }
      // Refresh the full list from server
      fetchEtheriscPolicies();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create policy");
    }
  };

  // Fetch etherisc policy payouts
  // const fetchPayouts = async (policyId: string) => {
  //   try {
  //     const response = await apiClient.get(
  //       `/etherisc/api/v1/etherisc/payouts/policy/${policyId}`,
  //     );
  //     setPayouts(
  //       Array.isArray(response.data.payouts) ? response.data.payouts : [],
  //     );
  //   } catch (error) {
  //     toast.error("Failed to fetch payouts");
  //     setPayouts([]);
  //   }
  // };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: any; icon: any }> = {
      active: { variant: "default", icon: CheckCircle },
      inactive: { variant: "secondary", icon: XCircle },
      pending: { variant: "secondary", icon: Clock },
      approved: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      paid: { variant: "default", icon: DollarSign },
      expired: { variant: "destructive", icon: AlertCircle },
    };

    const config = configs[status] || configs.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch =
      claim.claim_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.policy_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || claim.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPolicies(); }, [policiesPage]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAllClaims(); }, [claimsPage]);
  useEffect(() => { fetchEtheriscPolicies(); }, []);

  // Fetch data when tab is activated
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === "etherisc") fetchEtheriscPolicies();
    else if (activeTab === "claims") fetchAllClaims();
    else if (activeTab === "policies") fetchPolicies();
  }, [activeTab]);

  // Open review modal and store claim info
  const handleReviewClaim = (claimId: string, policyId: string) => {
    setReviewClaimId(claimId);
    setReviewPolicyId(policyId);
    setShowReviewModal(true);
    setReviewDecision("");
    setReviewApprovedAmount("");
  };

  // Actually submit the review
  const submitReviewClaim = async () => {
    if (
      !reviewClaimId ||
      !reviewPolicyId ||
      !reviewDecision ||
      (reviewDecision === "approved" && !reviewApprovedAmount)
    ) {
      toast.error("Please fill all required fields.");
      return;
    }
    setReviewLoading(true);
    try {
      await apiClient.post(
        `/insurance/api/v1/administration/insurance/claims/${reviewClaimId}/review`,
        {
          policy_id: reviewPolicyId,
          decision: reviewDecision,
          approved_amount:
            reviewDecision === "approved"
              ? parseFloat(reviewApprovedAmount)
              : 0,
        },
      );
      toast.success("Claim reviewed successfully");
      fetchClaims(reviewPolicyId);
      setShowReviewModal(false);
      setShowClaimDetailsModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to review claim");
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Insurance Management"
          title="Insurance Management"
          description="Manage policies, claims, and policy holders"
          icon={<Shield className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("policies")}
            className={`pb-3 px-4 font-medium transition-colors ${
              activeTab === "policies"
                ? "border-b-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              activeTab === "policies"
                ? { borderColor: primaryColor, color: primaryColor }
                : {}
            }
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            Insurance Policies
          </button>
          <button
            onClick={() => setActiveTab("claims")}
            className={`pb-3 px-4 font-medium transition-colors ${
              activeTab === "claims"
                ? "border-b-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              activeTab === "claims"
                ? { borderColor: primaryColor, color: primaryColor }
                : {}
            }
          >
            <AlertCircle className="w-4 h-4 inline-block mr-2" />
            Claims Management
          </button>
          <button
            onClick={() => setActiveTab("etherisc")}
            className={`pb-3 px-4 font-medium transition-colors ${
              activeTab === "etherisc"
                ? "border-b-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              activeTab === "etherisc"
                ? { borderColor: primaryColor, color: primaryColor }
                : {}
            }
          >
            <Shield className="w-4 h-4 inline-block mr-2" />
            Etherisc Policies
          </button>
        </div>

        {/* Policies Tab */}
        {activeTab === "policies" && (
          <div className="space-y-6">
            {/* Header with Refresh */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Insurance Policies</h2>
              <Button
                onClick={fetchPolicies}
                variant="outline"
                disabled={policiesLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${policiesLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            {/* Search and Fetch by ID */}
            {/* <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Fetch Policy by ID</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter Policy ID (e.g., POL1765494577)"
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      const input = e.target as HTMLInputElement;
                      if (input.value) fetchPolicyById(input.value);
                    }
                  }}
                />
                <Button
                  onClick={(e) => {
                    const input = (
                      e.target as HTMLElement
                    ).parentElement?.querySelector("input");
                    if (input?.value) fetchPolicyById(input.value);
                  }}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Fetch Policy
                </Button>
              </div>
            </div> */}

            {/* Policies List */}
            {policiesLoading ? (
              <div className="bg-card border border-border rounded-lg p-12">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              </div>
            ) : policies.length > 0 ? (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Policy ID
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Type
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Coverage
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Premium
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Status
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {policies.map((policy) => (
                      <tr key={policy.policy_id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 text-sm font-medium">
                          {policy.policy_id}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {policy.policy_type}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          ₦{policy.coverage_amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          ₦{policy.premium_amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(policy.status)}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchPolicyById(policy.policy_id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Policies Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {policiesPage} of {Math.max(1, Math.ceil(policiesTotal / pageLimit))} ({policiesTotal} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={policiesPage <= 1} onClick={() => setPoliciesPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={policiesPage >= Math.ceil(policiesTotal / pageLimit)} onClick={() => setPoliciesPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <FileText className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No Policies Found</p>
                  <p className="text-sm mb-4">
                    No insurance policies available at the moment
                  </p>
                  <Button
                    onClick={fetchPolicies}
                    style={{ backgroundColor: primaryColor }}
                    className="text-white"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Policies
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Claims Tab */}
        {activeTab === "claims" && (
          <div className="space-y-6">
            {/* Header with Refresh */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Claims Management</h2>
              <Button
                onClick={fetchAllClaims}
                variant="outline"
                disabled={claimsLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${claimsLoading ? "animate-spin" : ""}`}
                />
                Refresh All Claims
              </Button>
            </div>

            {/* Fetch Claims by Policy */}
            {/* <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">
                Fetch Claims by Policy ID
              </h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter Policy ID to view claims"
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      const input = e.target as HTMLInputElement;
                      if (input.value) fetchClaims(input.value);
                    }
                  }}
                />
                <Button
                  onClick={(e) => {
                    const input = (
                      e.target as HTMLElement
                    ).parentElement?.querySelector("input");
                    if (input?.value) fetchClaims(input.value);
                  }}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Fetch Claims
                </Button>
              </div>
            </div> */}

            {/* Search and Filter */}
            {claims.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by claim ID or policy ID..."
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
                    <option value="rejected">Rejected</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
            )}

            {/* Claims Table */}
            {claimsLoading ? (
              <div className="bg-card border border-border rounded-lg p-12">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No Claims Found</p>
                  <p className="text-sm mb-4">
                    No insurance claims available at the moment
                  </p>
                  <Button
                    onClick={fetchAllClaims}
                    style={{ backgroundColor: primaryColor }}
                    className="text-white"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Claims
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Claim ID
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Policy ID
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Amount
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Status
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Claim Date
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredClaims.map((claim) => (
                      <tr key={claim.claim_id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 text-sm font-medium">
                          {claim.claim_id}
                        </td>
                        <td className="px-6 py-4 text-sm">{claim.policy_id}</td>
                        <td className="px-6 py-4 text-sm font-semibold">
                          ₦{claim.claim_amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(claim.status)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {new Date(claim.claim_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchClaimDetails(claim.claim_id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          {claim.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              style={{
                                backgroundColor: primaryColor,
                                color: "#fff",
                                marginLeft: 8,
                              }}
                              onClick={() =>
                                handleReviewClaim(
                                  claim.claim_id,
                                  claim.policy_id,
                                )
                              }
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Review Claim
                            </Button>
                          )}
                          {claim.status === "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              style={{
                                backgroundColor: primaryColor,
                                color: "#fff",
                                marginLeft: 8,
                              }}
                              onClick={() =>
                                handlePayClaim(claim.claim_id, claim.policy_id)
                              }
                            >
                              <DollarSign className="w-4 h-4 mr-2" />
                              Pay Claim
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Claims Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {claimsPage} of {Math.max(1, Math.ceil(claimsTotal / pageLimit))} ({claimsTotal} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={claimsPage <= 1} onClick={() => setClaimsPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={claimsPage >= Math.ceil(claimsTotal / pageLimit)} onClick={() => setClaimsPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Etherisc Policies Tab */}
        {activeTab === "etherisc" && (
          <div className="space-y-6">
            {/* Create Policy Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">
                Etherisc Policy Templates
              </h2>
              <div className="flex gap-2">
                <Button
                  onClick={fetchEtheriscPolicies}
                  variant="outline"
                  disabled={etheriscLoading}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${etheriscLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
                <Button
                  onClick={() => setShowCreatePolicyModal(true)}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Policy Template
                </Button>
              </div>
            </div>

            {/* Policy Templates Table */}
            {etheriscLoading ? (
              <div className="bg-card border border-border rounded-lg p-12">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              </div>
            ) : etheriscPolicies.length > 0 ? (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-muted/50 border-b border-border">
                  <h3 className="font-semibold">Created Policy Templates</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-6 py-4 text-sm font-semibold">
                          Policy ID
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold">
                          Insurance Type
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold">
                          Coverage
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold">
                          Premium
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold">
                          Duration
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold">
                          Status
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-semibold">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {etheriscPolicies.map((policy) => (
                        <tr
                          key={policy.policy_id}
                          className="hover:bg-muted/30"
                        >
                          <td className="px-6 py-4 text-sm font-medium">
                            {policy.policy_id}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline">
                              {policy.insurance_type
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            ₦{policy.coverage_amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            ₦{policy.premium_amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {policy.duration_days} days
                          </td>
                          <td className="px-6 py-4">
                            {policy.status ? (
                              getStatusBadge(policy.status)
                            ) : (
                              <Badge variant="default">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {policy.created_at
                              ? new Date(policy.created_at).toLocaleDateString()
                              : "Just now"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <Shield className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    No Policy Templates Found
                  </p>
                  <p className="text-sm mb-4">
                    Create your first Etherisc policy template to get started
                  </p>
                  <Button
                    onClick={() => setShowCreatePolicyModal(true)}
                    style={{ backgroundColor: primaryColor }}
                    className="text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Policy Template
                  </Button>
                </div>
              </div>
            )}

            {/* Fetch Payouts */}
            {/* <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">
                Fetch Policy Payouts
              </h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter Etherisc Policy ID"
                  value={selectedEtheriscPolicy}
                  onChange={(e) => setSelectedEtheriscPolicy(e.target.value)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button
                  onClick={() =>
                    selectedEtheriscPolicy &&
                    fetchPayouts(selectedEtheriscPolicy)
                  }
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Fetch Payouts
                </Button>
              </div>
            </div> */}

            {/* Payouts Table */}
            {payouts.length > 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-muted/50 border-b border-border">
                  <h3 className="font-semibold">Policy Payouts</h3>
                </div>
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Payout ID
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Amount
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Status
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payouts.map((payout) => (
                      <tr key={payout.payout_id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 text-sm font-medium">
                          {payout.payout_id}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold">
                          ${payout.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(payout.status)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {new Date(payout.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Policy Details Modal */}
        <Dialog
          open={showPolicyDetailsModal}
          onOpenChange={setShowPolicyDetailsModal}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Policy Details</DialogTitle>
              <DialogDescription>
                View and manage policy information
              </DialogDescription>
            </DialogHeader>

            {selectedPolicy && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Policy ID</p>
                    <p className="font-semibold">{selectedPolicy.policy_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">
                      {getStatusBadge(selectedPolicy.status)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Policy Type</p>
                    <p className="font-semibold">
                      {selectedPolicy.policy_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Coverage Amount
                    </p>
                    <p className="font-semibold text-green-600">
                      ₦{selectedPolicy.coverage_amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Premium Amount
                    </p>
                    <p className="font-semibold">
                      ₦{selectedPolicy.premium_amount.toLocaleString()}
                    </p>
                  </div>
                  {selectedPolicy.holder_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Policy Holder
                      </p>
                      <p className="font-semibold">
                        {selectedPolicy.holder_name}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => fetchClaims(selectedPolicy.policy_id)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Claims
                    </Button>
                    {selectedPolicy.status !== "active" && (
                      <Button
                        onClick={() =>
                          handleActivatePolicy(selectedPolicy.policy_id)
                        }
                        style={{ backgroundColor: primaryColor }}
                        className="text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Activate Policy
                      </Button>
                    )}
                    {selectedPolicy.status === "active" && (
                      <Button
                        onClick={() =>
                          handleDeactivatePolicy(selectedPolicy.policy_id)
                        }
                        variant="destructive"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Deactivate Policy
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPolicyDetailsModal(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Claim Details Modal */}
        <Dialog
          open={showClaimDetailsModal}
          onOpenChange={setShowClaimDetailsModal}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Claim Details</DialogTitle>
              <DialogDescription>Review and process claim</DialogDescription>
            </DialogHeader>

            {selectedClaim && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Claim ID</p>
                    <p className="font-semibold">{selectedClaim.claim_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">
                      {getStatusBadge(selectedClaim.status)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Policy ID</p>
                    <p className="font-semibold">{selectedClaim.policy_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Claim Amount
                    </p>
                    <p className="font-semibold text-green-600">
                      ₦{selectedClaim.claim_amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Claim Date</p>
                    <p className="font-semibold">
                      {new Date(selectedClaim.claim_date).toLocaleDateString()}
                    </p>
                  </div>
                  {selectedClaim.claimant_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Claimant</p>
                      <p className="font-semibold">
                        {selectedClaim.claimant_name}
                      </p>
                    </div>
                  )}
                  {selectedClaim.description && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">
                        Description
                      </p>
                      <p className="font-semibold">
                        {selectedClaim.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowClaimDetailsModal(false)}
              >
                Close
              </Button>
              {selectedClaim && selectedClaim.status === "pending" && (
                <Button
                  onClick={() =>
                    handleReviewClaim(
                      selectedClaim.claim_id,
                      selectedClaim.policy_id,
                    )
                  }
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Review Claim
                </Button>
              )}
              {selectedClaim && selectedClaim.status === "approved" && (
                <Button
                  onClick={() =>
                    handlePayClaim(
                      selectedClaim.claim_id,
                      selectedClaim.policy_id,
                    )
                  }
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Pay Claim
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Policy Modal */}
        <Dialog
          open={showCreatePolicyModal}
          onOpenChange={setShowCreatePolicyModal}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Etherisc Policy Template</DialogTitle>
              <DialogDescription>
                Create a new policy template for insurance products
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Insurance Type</label>
                <select
                  value={policyForm.insurance_type}
                  onChange={(e) => {
                    const type = e.target.value;
                    let trigger_conditions = {};

                    // Set default trigger conditions based on type
                    switch (type) {
                      case "flight_delay":
                        trigger_conditions = { delay_minutes: 60 };
                        break;
                      case "crop_weather":
                        trigger_conditions = {
                          rainfall_mm: 100,
                          temperature_celsius: 35,
                        };
                        break;
                      case "parametric_weather":
                        trigger_conditions = {
                          wind_speed_kmh: 80,
                          rainfall_mm: 50,
                        };
                        break;
                      case "hurricane":
                        trigger_conditions = {
                          wind_speed_kmh: 119,
                          category: 1,
                        };
                        break;
                      case "earthquake":
                        trigger_conditions = { magnitude: 5.0 };
                        break;
                      case "automobile":
                        trigger_conditions = {};
                        break;
                      case "home":
                        trigger_conditions = {};
                        break;
                      case "agriculture":
                        trigger_conditions = {};
                        break;
                    }

                    setPolicyForm({
                      ...policyForm,
                      insurance_type: type,
                      trigger_conditions,
                    });
                  }}
                  className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="flight_delay">Flight Delay Insurance</option>
                  <option value="crop_weather">Crop Weather Insurance</option>
                  <option value="parametric_weather">
                    Parametric Weather Insurance
                  </option>
                  <option value="hurricane">Hurricane Insurance</option>
                  <option value="earthquake">Earthquake Insurance</option>
                  <option value="automobile">Automobile Insurance</option>
                  <option value="home">Home Insurance</option>
                  <option value="agriculture">Agriculture Insurance</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">
                    Coverage Amount ($)
                  </label>
                  <input
                    type="number"
                    value={policyForm.coverage_amount}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        coverage_amount: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Premium Amount ($)
                  </label>
                  <input
                    type="number"
                    value={policyForm.premium_amount}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        premium_amount: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Duration (Days)</label>
                <input
                  type="number"
                  value={policyForm.duration_days}
                  onChange={(e) =>
                    setPolicyForm({
                      ...policyForm,
                      duration_days: e.target.value,
                    })
                  }
                  className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Dynamic Trigger Conditions based on Insurance Type */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-semibold mb-3">
                  Trigger Conditions
                </h4>

                {policyForm.insurance_type === "flight_delay" && (
                  <div>
                    <label className="text-sm font-medium">Delay Minutes</label>
                    <input
                      type="number"
                      value={policyForm.trigger_conditions.delay_minutes || 60}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          trigger_conditions: {
                            delay_minutes: parseInt(e.target.value),
                          },
                        })
                      }
                      className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum flight delay in minutes to trigger payout
                    </p>
                  </div>
                )}

                {policyForm.insurance_type === "crop_weather" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">
                        Rainfall (mm)
                      </label>
                      <input
                        type="number"
                        value={policyForm.trigger_conditions.rainfall_mm || 100}
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            trigger_conditions: {
                              ...policyForm.trigger_conditions,
                              rainfall_mm: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Temperature (°C)
                      </label>
                      <input
                        type="number"
                        value={
                          policyForm.trigger_conditions.temperature_celsius ||
                          35
                        }
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            trigger_conditions: {
                              ...policyForm.trigger_conditions,
                              temperature_celsius: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                {policyForm.insurance_type === "parametric_weather" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">
                        Wind Speed (km/h)
                      </label>
                      <input
                        type="number"
                        value={
                          policyForm.trigger_conditions.wind_speed_kmh || 80
                        }
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            trigger_conditions: {
                              ...policyForm.trigger_conditions,
                              wind_speed_kmh: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Rainfall (mm)
                      </label>
                      <input
                        type="number"
                        value={policyForm.trigger_conditions.rainfall_mm || 50}
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            trigger_conditions: {
                              ...policyForm.trigger_conditions,
                              rainfall_mm: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                {policyForm.insurance_type === "hurricane" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">
                        Wind Speed (km/h)
                      </label>
                      <input
                        type="number"
                        value={
                          policyForm.trigger_conditions.wind_speed_kmh || 119
                        }
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            trigger_conditions: {
                              ...policyForm.trigger_conditions,
                              wind_speed_kmh: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Hurricane Category
                      </label>
                      <select
                        value={policyForm.trigger_conditions.category || 1}
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            trigger_conditions: {
                              ...policyForm.trigger_conditions,
                              category: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="1">Category 1</option>
                        <option value="2">Category 2</option>
                        <option value="3">Category 3</option>
                        <option value="4">Category 4</option>
                        <option value="5">Category 5</option>
                      </select>
                    </div>
                  </div>
                )}

                {policyForm.insurance_type === "earthquake" && (
                  <div>
                    <label className="text-sm font-medium">
                      Minimum Magnitude
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={policyForm.trigger_conditions.magnitude || 5.0}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          trigger_conditions: {
                            magnitude: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="w-full mt-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Richter scale magnitude to trigger payout
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreatePolicyModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePolicy}
                style={{ backgroundColor: primaryColor }}
                className="text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Policy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Claim Modal */}
        <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Review Claim</DialogTitle>
              <DialogDescription>
                Approve or reject this claim and set the approved amount.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Decision
                </label>
                <select
                  className="w-full px-3 py-2 border border-border rounded"
                  value={reviewDecision}
                  onChange={(e) =>
                    setReviewDecision(
                      e.target.value as "approved" | "rejected" | "",
                    )
                  }
                >
                  <option value="">Select decision</option>
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                </select>
              </div>
              {reviewDecision === "approved" && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Approved Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-border rounded"
                    value={reviewApprovedAmount}
                    onChange={(e) => setReviewApprovedAmount(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowReviewModal(false)}
                disabled={reviewLoading}
              >
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: primaryColor }}
                className="text-white"
                onClick={submitReviewClaim}
                disabled={reviewLoading}
              >
                {reviewLoading ? "Submitting..." : "Submit Review"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
