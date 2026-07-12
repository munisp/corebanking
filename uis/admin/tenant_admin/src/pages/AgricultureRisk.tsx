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
    AlertTriangle,
    ArrowLeft,
    Calculator,
    MessageSquare,
    RefreshCw,
    ShieldAlert,
    Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface ShockResult {
  area: string;
  shock_type: string;
  affected_loans: number;
  affected_farmers: number;
  recommended_action: string;
  severity: string;
}

interface ReschedulingResult {
  cohort_id: string;
  loans_rescheduled: number;
  new_repayment_schedule: any;
}

interface PricingResult {
  loan_id: string;
  base_rate: number;
  risk_premium: number;
  final_rate: number;
  risk_factors: Record<string, number>;
}

interface BulkCommResult {
  sent_count: number;
  failed_count: number;
  message: string;
}

type ActiveTab = "shock" | "rescheduling" | "pricing" | "communication";

export default function AgricultureRisk() {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<ActiveTab>("shock");
  const [loading, setLoading] = useState(false);

  // Shock Detection
  const [shockArea, setShockArea] = useState("");
  const [shockType, setShockType] = useState("drought");
  const [shockResult, setShockResult] = useState<ShockResult | null>(null);

  // Cohort Rescheduling
  const [cohortId, setCohortId] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleResult, setRescheduleResult] = useState<ReschedulingResult | null>(null);

  // Risk Pricing
  const [pricingLoanId, setPricingLoanId] = useState("");
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);

  // Bulk Communication
  const [commMessage, setCommMessage] = useState("");
  const [commTarget, setCommTarget] = useState("all");
  const [commResult, setCommResult] = useState<BulkCommResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [modalContent, setModalContent] = useState<any>(null);
  const [modalTitle, setModalTitle] = useState("");

  const handleDetectShock = async () => {
    if (!shockArea.trim()) { toast.error("Enter a geographic area"); return; }
    setLoading(true);
    try {
      const res = await apiClient.post("/agricultural/api/v1/agriculture/risk/detect-shock", {
        area: shockArea,
        shock_type: shockType,
      });
      setShockResult(res.data?.result || res.data);
      setModalContent(res.data?.result || res.data);
      setModalTitle("Shock Detection Result");
      setShowResultModal(true);
    } catch {
      toast.error("Failed to detect area shock");
    } finally {
      setLoading(false);
    }
  };

  const handleCohortRescheduling = async () => {
    if (!cohortId.trim()) { toast.error("Enter a cohort ID"); return; }
    setLoading(true);
    try {
      const res = await apiClient.post("/agricultural/api/v1/agriculture/risk/cohort-rescheduling", {
        cohort_id: cohortId,
        reason: rescheduleReason,
      });
      setRescheduleResult(res.data?.result || res.data);
      setModalContent(res.data?.result || res.data);
      setModalTitle("Cohort Rescheduling Result");
      setShowResultModal(true);
      toast.success("Cohort rescheduling initiated");
    } catch {
      toast.error("Failed to create cohort rescheduling");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculatePricing = async () => {
    if (!pricingLoanId.trim()) { toast.error("Enter a loan ID"); return; }
    setLoading(true);
    try {
      const res = await apiClient.post("/agricultural/api/v1/agriculture/risk/pricing", {
        loan_id: pricingLoanId,
      });
      setPricingResult(res.data?.pricing || res.data);
      setModalContent(res.data?.pricing || res.data);
      setModalTitle("Risk-Based Pricing");
      setShowResultModal(true);
    } catch {
      toast.error("Failed to calculate risk pricing");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCommunication = async () => {
    if (!commMessage.trim()) { toast.error("Enter a message"); return; }
    setLoading(true);
    try {
      const res = await apiClient.post("/agricultural/api/v1/agriculture/risk/bulk-communication", {
        message: commMessage,
        target_segment: commTarget,
      });
      setCommResult(res.data?.result || res.data);
      toast.success(`Message sent to ${res.data?.result?.sent_count || 0} recipients`);
      setCommMessage("");
    } catch {
      toast.error("Failed to send bulk communication");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: "shock" as ActiveTab, label: "Area Shock Detection", icon: AlertTriangle },
    { key: "rescheduling" as ActiveTab, label: "Cohort Rescheduling", icon: RefreshCw },
    { key: "pricing" as ActiveTab, label: "Risk Pricing", icon: Calculator },
    { key: "communication" as ActiveTab, label: "Bulk Communication", icon: MessageSquare },
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
              <ShieldAlert className="w-8 h-8" style={{ color: primaryColor }} />
              Proactive Risk Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Area shock detection, cohort rescheduling, risk-based pricing, and bulk communications
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-muted p-1 rounded-lg w-fit flex-wrap">
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

        {/* Shock Detection */}
        {activeTab === "shock" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Detect Area Shock
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Geographic Area</label>
                  <input
                    type="text"
                    placeholder="e.g. Kano State, Northern Nigeria"
                    value={shockArea}
                    onChange={(e) => setShockArea(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Shock Type</label>
                  <select
                    value={shockType}
                    onChange={(e) => setShockType(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="drought">Drought</option>
                    <option value="flood">Flood</option>
                    <option value="pest">Pest/Disease</option>
                    <option value="price_crash">Price Crash</option>
                    <option value="conflict">Conflict</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleDetectShock}
                    disabled={loading}
                    style={{ backgroundColor: primaryColor }}
                    className="text-white w-full"
                  >
                    <Zap className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Detecting..." : "Detect Shock"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Analyzes the portfolio for loans in the specified area that may be affected by the shock event.
              </p>
            </div>

            {shockResult && (
              <div className="bg-card border border-orange-200 dark:border-orange-900 rounded-lg p-6">
                <h4 className="font-semibold text-foreground mb-4">Last Detection Result</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Area</p>
                    <p className="font-medium">{shockResult.area}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Shock Type</p>
                    <p className="font-medium capitalize">{shockResult.shock_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Affected Loans</p>
                    <p className="font-bold text-orange-600 text-xl">{shockResult.affected_loans ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Affected Farmers</p>
                    <p className="font-bold text-orange-600 text-xl">{shockResult.affected_farmers ?? "—"}</p>
                  </div>
                </div>
                {shockResult.recommended_action && (
                  <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Recommended Action: {shockResult.recommended_action}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cohort Rescheduling */}
        {activeTab === "rescheduling" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5" style={{ color: primaryColor }} />
                Create Cohort Rescheduling
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Cohort ID</label>
                  <input
                    type="text"
                    placeholder="Enter cohort ID"
                    value={cohortId}
                    onChange={(e) => setCohortId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Reason</label>
                  <input
                    type="text"
                    placeholder="Reason for rescheduling"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <Button
                onClick={handleCohortRescheduling}
                disabled={loading}
                style={{ backgroundColor: primaryColor }}
                className="text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Processing..." : "Create Rescheduling"}
              </Button>
            </div>

            {rescheduleResult && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="font-semibold text-foreground mb-3">Last Rescheduling Result</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Cohort</p>
                    <p className="font-medium">{rescheduleResult.cohort_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Loans Rescheduled</p>
                    <p className="font-bold text-xl" style={{ color: primaryColor }}>{rescheduleResult.loans_rescheduled ?? "—"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Risk Pricing */}
        {activeTab === "pricing" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5" style={{ color: primaryColor }} />
                Calculate Risk-Based Pricing
              </h3>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Loan ID</label>
                  <input
                    type="text"
                    placeholder="Enter loan ID"
                    value={pricingLoanId}
                    onChange={(e) => setPricingLoanId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <Button
                  onClick={handleCalculatePricing}
                  disabled={loading}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  <Calculator className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Calculating..." : "Calculate"}
                </Button>
              </div>
            </div>

            {pricingResult && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="font-semibold text-foreground mb-4">Pricing Result for {pricingResult.loan_id}</h4>
                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Base Rate</p>
                    <p className="text-2xl font-bold text-foreground">{pricingResult.base_rate?.toFixed(2)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Risk Premium</p>
                    <p className="text-2xl font-bold text-orange-500">+{pricingResult.risk_premium?.toFixed(2)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Final Rate</p>
                    <p className="text-2xl font-bold" style={{ color: primaryColor }}>{pricingResult.final_rate?.toFixed(2)}%</p>
                  </div>
                </div>
                {pricingResult.risk_factors && Object.keys(pricingResult.risk_factors).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Risk Factors</p>
                    <div className="space-y-2">
                      {Object.entries(pricingResult.risk_factors).map(([factor, score]) => (
                        <div key={factor} className="flex justify-between">
                          <span className="text-sm capitalize">{factor.replace(/_/g, " ")}</span>
                          <span className="text-sm font-medium">{Number(score).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bulk Communication */}
        {activeTab === "communication" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" style={{ color: primaryColor }} />
                Send Bulk Communication
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Target Segment</label>
                  <select
                    value={commTarget}
                    onChange={(e) => setCommTarget(e.target.value)}
                    className="w-full md:w-64 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">All Farmers</option>
                    <option value="defaulted">Defaulted Loans</option>
                    <option value="due_soon">Due Within 30 Days</option>
                    <option value="at_risk">At-Risk Portfolio</option>
                    <option value="cooperatives">Cooperative Members</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Message</label>
                  <textarea
                    rows={4}
                    placeholder="Type your message here..."
                    value={commMessage}
                    onChange={(e) => setCommMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{commMessage.length}/160 characters</p>
                </div>
                <Button
                  onClick={handleBulkCommunication}
                  disabled={loading}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  <MessageSquare className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </div>

            {commResult && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="font-semibold text-foreground mb-3">Last Communication Result</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Sent</p>
                    <p className="font-bold text-xl text-green-600">{commResult.sent_count ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Failed</p>
                    <p className="font-bold text-xl text-red-600">{commResult.failed_count ?? 0}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Result Modal */}
        <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{modalTitle}</DialogTitle>
            </DialogHeader>
            {modalContent && (
              <div className="space-y-3">
                {Object.entries(modalContent).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-sm font-medium">
                      {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val) || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResultModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
