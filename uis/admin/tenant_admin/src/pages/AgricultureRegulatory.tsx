import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    CheckCircle,
    RefreshCw,
    Shield,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface CBNSector {
  code: string;
  name: string;
  description: string;
  risk_weight: number;
}

interface ConcentrationLimits {
  single_borrower_limit: number;
  sector_limit: number;
  geographic_limit: number;
  current_utilization: Record<string, number>;
}

interface LimitBreach {
  breach_id: string;
  limit_type: string;
  current_value: number;
  limit_value: number;
  severity: "low" | "medium" | "high";
  detected_at: string;
}

interface EarlyWarning {
  warning_id: string;
  indicator: string;
  value: number;
  threshold: number;
  status: "active" | "acknowledged" | "resolved";
  created_at: string;
}

interface IFRS9Params {
  pd_model: string;
  lgd_rate: number;
  ead_method: string;
  staging_criteria: Record<string, string>;
}

type ActiveTab = "sectors" | "limits" | "warnings" | "ifrs9";

export default function AgricultureRegulatory() {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<ActiveTab>("sectors");
  const [sectors, setSectors] = useState<CBNSector[]>([]);
  const [limits, setLimits] = useState<ConcentrationLimits | null>(null);
  const [breaches, setBreaches] = useState<LimitBreach[]>([]);
  const [warnings, setWarnings] = useState<EarlyWarning[]>([]);
  const [ifrs9, setIfrs9] = useState<IFRS9Params | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const fetchSectors = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/regulatory/cbn-sectors")
        .catch(() => ({ data: { sectors: [] } }));
      setSectors(res.data?.sectors || []);
    } catch {
      toast.error("Failed to fetch CBN sectors");
    } finally {
      setLoading(false);
    }
  };

  const fetchLimits = async () => {
    setLoading(true);
    try {
      const [limitsRes, breachesRes] = await Promise.all([
        apiClient.get("/agricultural/api/v1/regulatory/limits").catch(() => ({ data: {} })),
        apiClient.get("/agricultural/api/v1/regulatory/limits/breaches").catch(() => ({ data: { breaches: [] } })),
      ]);
      setLimits(limitsRes.data?.limits || limitsRes.data || null);
      setBreaches(breachesRes.data?.breaches || []);
    } catch {
      toast.error("Failed to fetch concentration limits");
    } finally {
      setLoading(false);
    }
  };

  const fetchWarnings = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/regulatory/early-warning")
        .catch(() => ({ data: { warnings: [] } }));
      setWarnings(res.data?.warnings || []);
    } catch {
      toast.error("Failed to fetch early warnings");
    } finally {
      setLoading(false);
    }
  };

  const fetchIFRS9 = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/regulatory/ifrs9/parameters")
        .catch(() => ({ data: {} }));
      setIfrs9(res.data?.parameters || res.data || null);
    } catch {
      toast.error("Failed to fetch IFRS9 parameters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "sectors") fetchSectors();
    else if (activeTab === "limits") fetchLimits();
    else if (activeTab === "warnings") fetchWarnings();
    else if (activeTab === "ifrs9") fetchIFRS9();
  }, [activeTab]);

  const handleScanWarnings = async () => {
    setScanning(true);
    try {
      await apiClient.post("/agricultural/api/v1/regulatory/early-warning/scan", {});
      toast.success("Early warning scan initiated");
      fetchWarnings();
    } catch {
      toast.error("Failed to run early warning scan");
    } finally {
      setScanning(false);
    }
  };

  const handleAcknowledgeWarning = async (id: string) => {
    try {
      await apiClient.post(`/agricultural/api/v1/regulatory/early-warning/${id}/acknowledge`, {});
      toast.success("Warning acknowledged");
      fetchWarnings();
    } catch {
      toast.error("Failed to acknowledge warning");
    }
  };

  const handleResolveWarning = async (id: string) => {
    try {
      await apiClient.post(`/agricultural/api/v1/regulatory/early-warning/${id}/resolve`, {});
      toast.success("Warning resolved");
      fetchWarnings();
    } catch {
      toast.error("Failed to resolve warning");
    }
  };

  const getSeverityBadge = (severity: string) => {
    if (severity === "high") return <Badge variant="destructive">High</Badge>;
    if (severity === "medium") return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  const getWarningSeverityIcon = (value: number, threshold: number) => {
    const ratio = value / threshold;
    if (ratio >= 1) return <XCircle className="w-4 h-4 text-red-500" />;
    if (ratio >= 0.8) return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: "sectors", label: "CBN Sectors" },
    { key: "limits", label: "Concentration Limits" },
    { key: "warnings", label: "Early Warnings" },
    { key: "ifrs9", label: "IFRS 9 / ECL" },
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
              Regulatory Compliance
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              CBN compliance, concentration limits, early warnings, and IFRS 9 management
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-muted p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        )}

        {/* CBN Sectors */}
        {!loading && activeTab === "sectors" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {sectors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No CBN sector data available</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Code</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Sector Name</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Description</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Risk Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sectors.map((s) => (
                    <tr key={s.code} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-mono font-medium">{s.code}</td>
                      <td className="px-6 py-4 text-sm font-medium">{s.name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{s.description || "—"}</td>
                      <td className="px-6 py-4 text-sm">{s.risk_weight != null ? `${s.risk_weight}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Concentration Limits */}
        {!loading && activeTab === "limits" && (
          <div className="space-y-6">
            {limits && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border rounded-lg p-6">
                  <p className="text-sm text-muted-foreground mb-1">Single Borrower Limit</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{limits.single_borrower_limit ?? "—"}%</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <p className="text-sm text-muted-foreground mb-1">Sector Limit</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{limits.sector_limit ?? "—"}%</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <p className="text-sm text-muted-foreground mb-1">Geographic Limit</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{limits.geographic_limit ?? "—"}%</p>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Limit Breaches</h3>
                {breaches.length > 0 && (
                  <Badge variant="destructive">{breaches.length} Active</Badge>
                )}
              </div>
              {breaches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mb-3 text-green-500" />
                  <p>No limit breaches detected</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Limit Type</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Current</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Limit</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Severity</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Detected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {breaches.map((b) => (
                      <tr key={b.breach_id} className="hover:bg-muted/30">
                        <td className="px-6 py-3 text-sm font-medium capitalize">{b.limit_type?.replace(/_/g, " ")}</td>
                        <td className="px-6 py-3 text-sm text-red-600 font-semibold">{b.current_value?.toFixed(1)}%</td>
                        <td className="px-6 py-3 text-sm">{b.limit_value?.toFixed(1)}%</td>
                        <td className="px-6 py-3">{getSeverityBadge(b.severity)}</td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">
                          {b.detected_at ? new Date(b.detected_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Early Warnings */}
        {!loading && activeTab === "warnings" && (
          <div className="space-y-6">
            <div className="flex justify-end gap-3">
              <Button
                onClick={handleScanWarnings}
                disabled={scanning}
                style={{ backgroundColor: primaryColor }}
                className="text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
                {scanning ? "Scanning..." : "Run Scan"}
              </Button>
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {warnings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mb-4 text-green-500" />
                  <p>No early warning indicators active</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Indicator</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Value</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Threshold</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Created</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {warnings.map((w) => (
                      <tr key={w.warning_id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 text-sm font-medium flex items-center gap-2">
                          {getWarningSeverityIcon(w.value, w.threshold)}
                          {w.indicator}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold">{w.value?.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{w.threshold?.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              w.status === "resolved"
                                ? "default"
                                : w.status === "acknowledged"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {w.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {w.created_at ? new Date(w.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {w.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAcknowledgeWarning(w.warning_id)}
                              >
                                Acknowledge
                              </Button>
                            )}
                            {w.status !== "resolved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolveWarning(w.warning_id)}
                              >
                                Resolve
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
          </div>
        )}

        {/* IFRS9 */}
        {!loading && activeTab === "ifrs9" && (
          <div className="space-y-6">
            {ifrs9 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-4">Model Parameters</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">PD Model</span>
                      <span className="text-sm font-medium">{ifrs9.pd_model || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">LGD Rate</span>
                      <span className="text-sm font-medium">{ifrs9.lgd_rate != null ? `${ifrs9.lgd_rate}%` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">EAD Method</span>
                      <span className="text-sm font-medium">{ifrs9.ead_method || "—"}</span>
                    </div>
                  </div>
                </div>
                {ifrs9.staging_criteria && Object.keys(ifrs9.staging_criteria).length > 0 && (
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="font-semibold text-foreground mb-4">Staging Criteria</h3>
                    <div className="space-y-3">
                      {Object.entries(ifrs9.staging_criteria).map(([stage, criteria]) => (
                        <div key={stage} className="flex justify-between">
                          <span className="text-sm text-muted-foreground capitalize">{stage}</span>
                          <span className="text-sm font-medium">{criteria}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No IFRS 9 parameters configured</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
