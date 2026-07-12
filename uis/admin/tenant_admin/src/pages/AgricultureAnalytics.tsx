import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import {
    AlertCircle,
    ArrowLeft,
    BarChart3,
    Download,
    FileText,
    Leaf,
    TrendingUp,
    Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface PortfolioDashboard {
  total_loans: number;
  total_disbursed: number;
  total_outstanding: number;
  npl_ratio: number;
  active_farmers: number;
  crop_distribution: Record<string, number>;
  regional_distribution: Record<string, number>;
}

interface ImpactMetrics {
  total_farmers_reached: number;
  total_farms_financed: number;
  yield_improvement_pct: number;
  financial_inclusion_rate: number;
  jobs_created: number;
  sdg_alignment: Record<string, number>;
}

interface ReportItem {
  report_id: string;
  type: string;
  period: string;
  status: string;
  created_at: string;
}

type ActiveTab = "portfolio" | "impact" | "reports" | "realtime";

export default function AgricultureAnalytics() {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<ActiveTab>("portfolio");
  const [portfolio, setPortfolio] = useState<PortfolioDashboard | null>(null);
  const [impact, setImpact] = useState<ImpactMetrics | null>(null);
  const [cbnReports, setCbnReports] = useState<ReportItem[]>([]);
  const [dfiReports, setDfiReports] = useState<ReportItem[]>([]);
  const [realtimeDisbursements, setRealtimeDisbursements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(
        "/agricultural/api/v1/analytics/portfolio/dashboard"
      ).catch(() => ({ data: {} }));
      setPortfolio(res.data?.dashboard || res.data || null);
    } catch {
      toast.error("Failed to fetch portfolio analytics");
    } finally {
      setLoading(false);
    }
  };

  const fetchImpact = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(
        "/agricultural/api/v1/analytics/impact"
      ).catch(() => ({ data: {} }));
      setImpact(res.data?.metrics || res.data || null);
    } catch {
      toast.error("Failed to fetch impact metrics");
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [cbnRes, dfiRes] = await Promise.all([
        apiClient.get("/agricultural/api/v1/analytics/reports/cbn/list").catch(() => ({ data: { reports: [] } })),
        apiClient.get("/agricultural/api/v1/analytics/reports/dfi/list").catch(() => ({ data: { reports: [] } })),
      ]);
      setCbnReports(cbnRes.data?.reports || []);
      setDfiReports(dfiRes.data?.reports || []);
    } catch {
      toast.error("Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchRealtime = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(
        "/agricultural/api/v1/analytics/realtime/disbursements"
      ).catch(() => ({ data: { disbursements: [] } }));
      setRealtimeDisbursements(res.data?.disbursements || []);
    } catch {
      toast.error("Failed to fetch real-time data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "portfolio") fetchPortfolio();
    else if (activeTab === "impact") fetchImpact();
    else if (activeTab === "reports") fetchReports();
    else if (activeTab === "realtime") fetchRealtime();
  }, [activeTab]);

  const handleGenerateCBN = async () => {
    setGeneratingReport("cbn");
    try {
      await apiClient.post("/agricultural/api/v1/analytics/reports/cbn", {
        period: new Date().toISOString().slice(0, 7),
      });
      toast.success("CBN report generated successfully");
      fetchReports();
    } catch {
      toast.error("Failed to generate CBN report");
    } finally {
      setGeneratingReport(null);
    }
  };

  const handleGenerateDFI = async () => {
    setGeneratingReport("dfi");
    try {
      await apiClient.post("/agricultural/api/v1/analytics/reports/dfi", {
        period: new Date().toISOString().slice(0, 7),
      });
      toast.success("DFI report generated successfully");
      fetchReports();
    } catch {
      toast.error("Failed to generate DFI report");
    } finally {
      setGeneratingReport(null);
    }
  };

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    try {
      const res = await apiClient.get(
        `/agricultural/api/v1/analytics/export/${format}`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `agriculture-analytics.${format === "excel" ? "xlsx" : format}`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to export as ${format}`);
    }
  };

  const tabs: { key: ActiveTab; label: string; icon: React.ElementType }[] = [
    { key: "portfolio", label: "Portfolio", icon: BarChart3 },
    { key: "impact", label: "Impact Metrics", icon: TrendingUp },
    { key: "reports", label: "Regulatory Reports", icon: FileText },
    { key: "realtime", label: "Real-time", icon: Leaf },
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                  <BarChart3 className="w-8 h-8" style={{ color: primaryColor }} />
                  Agriculture Analytics
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Portfolio analytics, impact metrics and regulatory reporting
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
                  <Download className="w-4 h-4 mr-2" />Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
                  <Download className="w-4 h-4 mr-2" />PDF
                </Button>
              </div>
            </div>
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

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Portfolio Tab */}
        {!loading && activeTab === "portfolio" && (
          <div className="space-y-6">
            {portfolio ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-card border border-border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground mb-1">Total Loans</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{portfolio.total_loans ?? "—"}</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground mb-1">Total Disbursed</p>
                    <p className="text-3xl font-bold text-green-600">
                      ₦{((portfolio.total_disbursed || 0) / 1_000_000).toFixed(1)}M
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
                    <p className="text-3xl font-bold text-blue-600">
                      ₦{((portfolio.total_outstanding || 0) / 1_000_000).toFixed(1)}M
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground mb-1">NPL Ratio</p>
                    <p className={`text-3xl font-bold ${(portfolio.npl_ratio || 0) > 5 ? "text-red-600" : "text-green-600"}`}>
                      {(portfolio.npl_ratio || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {portfolio.crop_distribution && Object.keys(portfolio.crop_distribution).length > 0 && (
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="font-semibold text-foreground mb-4">Crop Distribution</h3>
                    <div className="space-y-3">
                      {Object.entries(portfolio.crop_distribution).map(([crop, count]) => (
                        <div key={crop} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-32 capitalize">{crop}</span>
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                backgroundColor: primaryColor,
                                width: `${Math.min(100, (count / portfolio.total_loans) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-foreground w-10 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No portfolio data available</p>
              </div>
            )}
          </div>
        )}

        {/* Impact Tab */}
        {!loading && activeTab === "impact" && (
          <div className="space-y-6">
            {impact ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <p className="text-sm text-muted-foreground">Farmers Reached</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{impact.total_farmers_reached ?? "—"}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Leaf className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-muted-foreground">Farms Financed</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{impact.total_farms_financed ?? "—"}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <p className="text-sm text-muted-foreground">Yield Improvement</p>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{(impact.yield_improvement_pct || 0).toFixed(1)}%</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <p className="text-sm text-muted-foreground mb-1">Financial Inclusion Rate</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{(impact.financial_inclusion_rate || 0).toFixed(1)}%</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <p className="text-sm text-muted-foreground mb-1">Jobs Created</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{impact.jobs_created ?? "—"}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No impact data available</p>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {!loading && activeTab === "reports" && (
          <div className="space-y-6">
            <div className="flex gap-3">
              <Button
                onClick={handleGenerateCBN}
                disabled={generatingReport === "cbn"}
                style={{ backgroundColor: primaryColor }}
                className="text-white"
              >
                {generatingReport === "cbn" ? "Generating..." : "Generate CBN Report"}
              </Button>
              <Button
                onClick={handleGenerateDFI}
                disabled={generatingReport === "dfi"}
                variant="outline"
              >
                {generatingReport === "dfi" ? "Generating..." : "Generate DFI Report"}
              </Button>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-foreground">CBN Reports</h3>
              </div>
              {cbnReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <FileText className="w-10 h-10 mb-3" />
                  <p>No CBN reports yet</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Report ID</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Period</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Status</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cbnReports.map((r) => (
                      <tr key={r.report_id} className="hover:bg-muted/30">
                        <td className="px-6 py-3 text-sm font-medium">{r.report_id}</td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">{r.period}</td>
                        <td className="px-6 py-3">
                          <Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge>
                        </td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-foreground">DFI Reports</h3>
              </div>
              {dfiReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <FileText className="w-10 h-10 mb-3" />
                  <p>No DFI reports yet</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Report ID</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Period</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Status</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dfiReports.map((r) => (
                      <tr key={r.report_id} className="hover:bg-muted/30">
                        <td className="px-6 py-3 text-sm font-medium">{r.report_id}</td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">{r.period}</td>
                        <td className="px-6 py-3">
                          <Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge>
                        </td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Realtime Tab */}
        {!loading && activeTab === "realtime" && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={fetchRealtime}>
                Refresh
              </Button>
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Recent Disbursements</h3>
              </div>
              {realtimeDisbursements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <TrendingUp className="w-10 h-10 mb-3" />
                  <p>No recent disbursements</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Loan ID</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Amount</th>
                      <th className="text-left px-6 py-3 text-sm font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {realtimeDisbursements.map((d, i) => (
                      <tr key={d.loan_id || i} className="hover:bg-muted/30">
                        <td className="px-6 py-3 text-sm font-medium">{d.loan_id || "—"}</td>
                        <td className="px-6 py-3 text-sm text-green-600 font-semibold">
                          ₦{(d.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">
                          {d.timestamp ? new Date(d.timestamp).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
