import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle,
    Eye,
    Shield,
    Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface InsuranceProduct {
  product_id: string;
  name: string;
  type: string;
  coverage_amount: number;
  premium_rate: number;
  eligible_crops: string[];
  is_active: boolean;
}

interface InsurancePolicy {
  policy_id: string;
  farmer_id: string;
  product_id: string;
  coverage_amount: number;
  premium_paid: number;
  status: string;
  start_date: string;
  end_date: string;
}

interface NAICClaim {
  claim_id: string;
  policy_id: string;
  amount: number;
  reason: string;
  status: string;
  submitted_at: string;
}

type ActiveTab = "products" | "policies" | "claims";

export default function AgricultureInsurance() {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<NAICClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerPolicyId, setTriggerPolicyId] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/agriculture/insurance/products")
        .catch(() => ({ data: { products: [] } }));
      setProducts(res.data?.products || []);
    } catch {
      toast.error("Failed to fetch insurance products");
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/integrations/naic/policies")
        .catch(() => ({ data: { policies: [] } }));
      setPolicies(res.data?.policies || []);
    } catch {
      toast.error("Failed to fetch policies");
    } finally {
      setLoading(false);
    }
  };

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/integrations/naic/claims")
        .catch(() => ({ data: { claims: [] } }));
      setClaims(res.data?.claims || []);
    } catch {
      toast.error("Failed to fetch claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "products") fetchProducts();
    else if (activeTab === "policies") fetchPolicies();
    else if (activeTab === "claims") fetchClaims();
  }, [activeTab]);

  const handleEvaluateTrigger = async () => {
    if (!triggerPolicyId.trim()) {
      toast.error("Enter a policy ID");
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post(
        "/agricultural/api/v1/agriculture/insurance/evaluate-trigger",
        { policy_id: triggerPolicyId }
      );
      setTriggerResult(res.data);
      setShowTriggerModal(true);
    } catch {
      toast.error("Failed to evaluate trigger");
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessAutoClaim = async (policyId: string) => {
    if (!confirm(`Process auto claim for policy ${policyId}?`)) return;
    setActionLoading(true);
    try {
      await apiClient.post("/agricultural/api/v1/agriculture/insurance/auto-claim", {
        policy_id: policyId,
      });
      toast.success("Auto claim processed");
      fetchClaims();
    } catch {
      toast.error("Failed to process auto claim");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      approved: "default",
      paid: "default",
      pending: "secondary",
      submitted: "secondary",
      expired: "secondary",
      rejected: "destructive",
      cancelled: "destructive",
    };
    return <Badge variant={map[status] || "secondary"}>{status}</Badge>;
  };

  const tabs = [
    { key: "products" as ActiveTab, label: "Insurance Products", icon: Shield },
    { key: "policies" as ActiveTab, label: "Policies", icon: CheckCircle },
    { key: "claims" as ActiveTab, label: "Claims", icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Shield className="w-8 h-8" style={{ color: primaryColor }} />
              Agriculture Insurance
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage insurance products, policies, parametric triggers, and claims
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-muted p-1 rounded-lg w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Evaluate Trigger Panel */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6 flex items-center gap-3">
          <Zap className="w-5 h-5 text-yellow-500 shrink-0" />
          <span className="text-sm font-medium text-foreground">Evaluate Parametric Trigger</span>
          <input
            type="text"
            placeholder="Policy ID"
            value={triggerPolicyId}
            onChange={(e) => setTriggerPolicyId(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            size="sm"
            onClick={handleEvaluateTrigger}
            disabled={actionLoading}
            style={{ backgroundColor: primaryColor }}
            className="text-white"
          >
            Evaluate
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Products */}
        {!loading && activeTab === "products" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No insurance products available</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Product ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Name</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Type</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Coverage</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Premium Rate</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((p) => (
                    <tr key={p.product_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{p.product_id}</td>
                      <td className="px-6 py-4 text-sm font-medium">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground capitalize">{p.type}</td>
                      <td className="px-6 py-4 text-sm font-semibold">₦{p.coverage_amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">{p.premium_rate != null ? `${p.premium_rate}%` : "—"}</td>
                      <td className="px-6 py-4">
                        <Badge variant={p.is_active ? "default" : "secondary"}>
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Policies */}
        {!loading && activeTab === "policies" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {policies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No insurance policies found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Policy ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Farmer</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Coverage</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Premium</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Start</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">End</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {policies.map((p) => (
                    <tr key={p.policy_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{p.policy_id}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{p.farmer_id}</td>
                      <td className="px-6 py-4 text-sm font-semibold">₦{p.coverage_amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">₦{p.premium_paid?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {p.start_date ? new Date(p.start_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {p.end_date ? new Date(p.end_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(p.status)}</td>
                      <td className="px-6 py-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleProcessAutoClaim(p.policy_id)}
                          disabled={actionLoading}
                        >
                          Auto Claim
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Claims */}
        {!loading && activeTab === "claims" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {claims.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No insurance claims found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Claim ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Policy</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Amount</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Reason</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Submitted</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {claims.map((c) => (
                    <tr key={c.claim_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{c.claim_id}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{c.policy_id}</td>
                      <td className="px-6 py-4 text-sm font-semibold">₦{c.amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{c.reason || "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(c); setShowModal(true); }}>
                          <Eye className="w-4 h-4 mr-1" />View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Details Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Claim Details</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(selectedItem).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-sm font-medium">{String(val) || "—"}</p>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Trigger Result Modal */}
        <Dialog open={showTriggerModal} onOpenChange={setShowTriggerModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Trigger Evaluation Result</DialogTitle>
            </DialogHeader>
            {triggerResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {triggerResult.triggered ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="font-semibold">
                    {triggerResult.triggered ? "Trigger Activated" : "Trigger Not Activated"}
                  </span>
                </div>
                {triggerResult.payout_amount && (
                  <p className="text-sm text-muted-foreground">
                    Payout Amount: <span className="font-semibold text-foreground">₦{triggerResult.payout_amount?.toLocaleString()}</span>
                  </p>
                )}
                {triggerResult.reason && (
                  <p className="text-sm text-muted-foreground">Reason: {triggerResult.reason}</p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTriggerModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
