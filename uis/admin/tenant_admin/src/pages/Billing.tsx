import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
  Activity,
  AlertCircle,
  ArrowUpCircle,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Gauge,
  Receipt,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "../components/PageHeader";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../services/api";

interface BillingPlanDef {
  id: string;
  name: string;
  label: string;
  monthlyFee: number;
  currency: string;
  description: string;
  features: string[];
  popular: boolean;
}

interface BillingInfo {
  plan: string;
  billingCycle: "monthly" | "yearly";
  nextBillingDate: string;
  status: "active" | "past_due" | "canceled";
}

export default function Billing() {
  const { primaryColor } = useTenantBranding();
  const queryClient = useQueryClient();

  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<BillingPlanDef | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () =>
      apiClient.get("/tenant-billing/v1/billing/plans").then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: billingInfoData, isLoading: billingLoading } = useQuery({
    queryKey: ["billing", "me"],
    queryFn: () =>
      apiClient
        .get("/tenant-billing/v1/billing/me")
        .then((r) => r.data?.billing_info ?? null)
        .catch(() => null),
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["billing", "invoices"],
    queryFn: () =>
      apiClient
        .get("/tenant-billing/v1/billing/invoices")
        .then((r) => r.data)
        .catch(() => null),
    refetchInterval: 10000,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["billing", "stats"],
    queryFn: () =>
      apiClient
        .get("/tenant-billing/v1/stats")
        .then((r) => r.data)
        .catch(() => null),
    refetchInterval: 10000,
  });

  const { data: trendsData } = useQuery({
    queryKey: ["billing", "trends"],
    queryFn: () =>
      apiClient
        .get("/tenant-billing/v1/billing/trends")
        .then((r) => r.data)
        .catch(() => null),
    refetchInterval: 10000,
  });

  const { data: metersData } = useQuery({
    queryKey: ["billing", "meters"],
    queryFn: () =>
      apiClient
        .get("/billing-enforcement/v1/billing/meters")
        .then((r) => r.data)
        .catch(() => null),
    refetchInterval: 30000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["billing", "enforcement-alerts"],
    queryFn: () =>
      apiClient
        .get("/billing-enforcement/v1/billing/alerts")
        .then((r) => r.data)
        .catch(() => null),
    refetchInterval: 30000,
  });

  // ── Normalise ──────────────────────────────────────────────────────────────

  const plans: BillingPlanDef[] = plansData?.items ?? [];
  const billingInfo: BillingInfo | null = billingInfoData ?? null;
  const invoices = invoicesData
    ? { list: invoicesData.items ?? invoicesData.invoices ?? [], total: invoicesData.total ?? 0 }
    : null;
  const stats = statsData ?? null;
  const trends: any[] = trendsData?.items ?? trendsData?.trends ?? [];
  const meters: any[] = metersData?.meters ?? metersData?.items ?? [];
  const activeAlerts: any[] = alertsData?.alerts ?? alertsData?.items ?? [];

  const currentPlanDef = plans.find((p) => p.name === billingInfo?.plan);
  const isLoading = invoicesLoading || statsLoading;

  const totalBilled = stats?.total_mrr ?? 0;
  const totalPaid = stats?.paidRevenue ? parseFloat(stats.paidRevenue) : 0;
  const totalPending = stats?.pendingRevenue ? parseFloat(stats.pendingRevenue) : 0;

  const revenueData = trends.map((t: any) => ({
    date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    billed: parseFloat(t.totalAmount ?? t.amount ?? "0") / 1000,
    paid: parseFloat(t.paidAmount ?? "0") / 1000,
  }));

  // ── Actions ────────────────────────────────────────────────────────────────

  const handlePlanSelect = (plan: BillingPlanDef) => {
    if (plan.name === billingInfo?.plan) return;
    setConfirmPlan(plan);
  };

  const confirmSwitch = async () => {
    if (!confirmPlan) return;
    const target = confirmPlan;
    setConfirmPlan(null);
    setSwitchingTo(target.name);
    try {
      await apiClient.put("/tenant-billing/v1/billing/plan", { plan: target.name });
      queryClient.invalidateQueries({ queryKey: ["billing", "me"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "trends"] });
      toast.success(`Plan updated to ${target.label}`);
    } catch {
      toast.error("Failed to update plan. Please try again.");
    } finally {
      setSwitchingTo(null);
    }
  };

  // ── Exports ────────────────────────────────────────────────────────────────

  const handleExportExcel = () => {
    if (!invoices?.list) return;
    exportToExcel(
      invoices.list.map((inv: any) => ({
        "Invoice Number": inv.invoiceNumber,
        Amount: `${inv.currency} ${parseFloat(inv.amount).toLocaleString()}`,
        Status: inv.status,
        "Due Date": new Date(inv.dueDate).toLocaleDateString(),
        "Paid At": inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "N/A",
        Created: new Date(inv.createdAt).toLocaleDateString(),
      })),
      "invoices",
    );
  };

  const handleExportPDF = () => {
    if (!invoices?.list) return;
    exportToPDF(
      ["Invoice #", "Amount", "Status", "Due Date"],
      invoices.list.map((inv: any) => [
        inv.invoiceNumber,
        `${inv.currency} ${parseFloat(inv.amount).toLocaleString()}`,
        inv.status,
        new Date(inv.dueDate).toLocaleDateString(),
      ]),
      "invoices-report",
      "Invoice History",
    );
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-primary/10 text-primary";
      case "pending": return "bg-muted text-muted-foreground";
      case "overdue": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid": return <CheckCircle className="w-4 h-4" />;
      case "pending": return <Clock className="w-4 h-4" />;
      case "overdue": return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getBillingStatusBadge = (status?: string) => {
    const base = "px-2.5 py-0.5 rounded-full text-xs font-semibold";
    switch (status) {
      case "active": return <span className={`${base} bg-primary/10 text-primary`}>Active</span>;
      case "past_due": return <span className={`${base} bg-destructive/10 text-destructive`}>Past Due</span>;
      case "canceled": return <span className={`${base} bg-muted text-muted-foreground`}>Canceled</span>;
      default: return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <PageHeader
          label="Subscription & Billing"
          title="Billing Management"
          description="Manage your subscription plan and view your invoice history"
          icon={<DollarSign className="w-8 h-8" />}
        />
      </div>

      <div className="container pb-12 space-y-8">
        {/* Quick actions */}
        <div className="flex items-center justify-end">
          <Link href="/billing-ledger">
            <a className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
              <Receipt className="w-4 h-4" />
              Transaction Ledger
            </a>
          </Link>
        </div>

        {/* Current Plan + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-xl shadow-sm p-6 border border-border">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}18` }}>
                  <CreditCard className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Current Plan</h3>
                  <p className="text-sm text-muted-foreground">Your active subscription</p>
                </div>
              </div>
              {!billingLoading && getBillingStatusBadge(billingInfo?.status)}
            </div>

            {billingLoading || plansLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-10 w-40 bg-muted rounded" />
                <div className="h-4 w-56 bg-muted rounded" />
                <div className="h-4 w-44 bg-muted rounded" />
              </div>
            ) : billingInfo ? (
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="text-4xl font-bold capitalize mb-1" style={{ color: primaryColor }}>
                    {currentPlanDef?.label ?? billingInfo.plan}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ₦{(currentPlanDef?.monthlyFee ?? 0).toLocaleString()} / {billingInfo.billingCycle ?? "month"}
                  </div>
                  {billingInfo.nextBillingDate && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <Calendar className="w-3.5 h-3.5" />
                      Next invoice:{" "}
                      {new Date(billingInfo.nextBillingDate).toLocaleDateString("en-NG", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground capitalize bg-muted px-3 py-1.5 rounded-lg">
                  {billingInfo.billingCycle} billing
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No active billing plan found.</p>
            )}
          </div>

          <div className="bg-card rounded-xl shadow-sm p-6 border border-border">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}18` }}>
                <TrendingUp className="w-4 h-4" style={{ color: primaryColor }} />
              </div>
              <h3 className="text-base font-semibold text-foreground">Last 30 Days</h3>
            </div>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-4 bg-muted rounded" />)}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Billed</span>
                  <span className="font-semibold text-foreground">₦{(totalBilled / 1000).toFixed(1)}K</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-semibold text-primary">₦{(totalPaid / 1000).toFixed(1)}K</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className={`font-semibold ${totalPending > 0 ? "text-destructive" : "text-foreground"}`}>
                    ₦{(totalPending / 1000).toFixed(1)}K
                  </span>
                </div>
                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Next bill</span>
                    <span className="font-bold" style={{ color: primaryColor }}>
                      ₦{((currentPlanDef?.monthlyFee ?? 0) / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subscription Plans */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5" style={{ color: primaryColor }} />
            <h2 className="text-lg font-semibold text-foreground">Subscription Plans</h2>
            <span className="text-sm text-muted-foreground">— upgrade or downgrade at any time</span>
          </div>

          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-xl border-2 border-border p-6 animate-pulse space-y-4">
                  <div className="h-5 w-24 bg-muted rounded" />
                  <div className="h-8 w-16 bg-muted rounded" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((j) => <div key={j} className="h-3 bg-muted rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No subscription plans available yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Contact your platform administrator.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const isCurrent = billingInfo?.plan === plan.name;
                const currentIndex = plans.findIndex((p) => p.name === billingInfo?.plan);
                const planIndex = plans.findIndex((p) => p.name === plan.name);
                const isUpgrade = !billingLoading && billingInfo && planIndex > currentIndex;
                const isSwitching = switchingTo === plan.name;

                return (
                  <div
                    key={plan.id}
                    className={`relative bg-card rounded-xl border-2 p-6 transition-all ${
                      isCurrent
                        ? "border-primary shadow-md"
                        : plan.popular
                          ? "border-border shadow-sm hover:border-primary/40"
                          : "border-border shadow-sm hover:border-border/80"
                    }`}
                  >
                    {plan.popular && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: primaryColor }}>
                          Most Popular
                        </span>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Current Plan
                        </span>
                      </div>
                    )}

                    <div className="mb-4 mt-1">
                      <h3 className="text-base font-bold text-foreground">{plan.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                    </div>

                    <div className="mb-5">
                      <span className="text-2xl font-bold text-foreground">
                        ₦{(plan.monthlyFee / 1000).toFixed(0)}K
                      </span>
                      <span className="text-sm text-muted-foreground"> / month</span>
                    </div>

                    {plan.features.length > 0 && (
                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      onClick={() => handlePlanSelect(plan)}
                      disabled={isCurrent || isSwitching || billingLoading}
                      className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        isCurrent
                          ? "bg-primary/10 text-primary cursor-default"
                          : "bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                      }`}
                    >
                      {isSwitching ? (
                        <Activity className="w-4 h-4 animate-spin" />
                      ) : isCurrent ? (
                        "Current Plan"
                      ) : isUpgrade ? (
                        <><ArrowUpCircle className="w-4 h-4" /> Upgrade</>
                      ) : (
                        "Switch Plan"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Usage & Overage */}
        {(meters.length > 0 || activeAlerts.length > 0) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5" style={{ color: primaryColor }} />
              <h2 className="text-lg font-semibold text-foreground">Usage & Overage</h2>
              <span className="text-sm text-muted-foreground">— current billing period</span>
              {activeAlerts.length > 0 && (
                <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {activeAlerts.length} alert{activeAlerts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {activeAlerts.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                {activeAlerts.slice(0, 3).map((alert: any, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-destructive">
                        {alert.feature ?? alert.meter_key ?? "Overage"}:{" "}
                      </span>
                      <span className="text-muted-foreground">
                        {alert.message ?? `Usage at ${alert.pct_used ?? "—"}% of limit`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {meters.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-6 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Meter Usage</span>
                </div>
                {meters.map((meter: any, i: number) => {
                  const used = Number(meter.current_value ?? meter.used ?? meter.quantity ?? 0);
                  const included = Number(meter.included_units ?? meter.threshold ?? 0);
                  const cap = Number(meter.hard_cap ?? meter.cap ?? included * 2);
                  const pct = included > 0 ? Math.min((used / Math.max(cap, included)) * 100, 100) : 0;
                  const overUsed = used > included;
                  const overagePct = included > 0 ? Math.round(((used - included) / included) * 100) : 0;
                  return (
                    <div key={meter.id ?? i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground capitalize">
                          {(meter.meter_key ?? meter.feature ?? meter.name ?? "meter").replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          {overUsed && (
                            <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                              +{overagePct}% over
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {used.toLocaleString()} / {included.toLocaleString()} included
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : primaryColor,
                          }}
                        />
                      </div>
                      {overUsed && (
                        <p className="text-xs text-muted-foreground">
                          Overage:{" "}
                          <span className="text-destructive font-medium">
                            {(used - included).toLocaleString()} units
                          </span>
                          {meter.unit_rate && (
                            <> · est. ₦{((used - included) * Number(meter.unit_rate)).toLocaleString()} extra</>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Confirm Modal */}
        {confirmPlan && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-xl shadow-2xl p-6 max-w-md w-full border border-border">
              <h3 className="text-lg font-bold text-foreground mb-2">Confirm Plan Change</h3>
              <p className="text-sm text-muted-foreground mb-6">
                You're switching from{" "}
                <strong className="text-foreground capitalize">
                  {currentPlanDef?.label ?? billingInfo?.plan ?? "your current plan"}
                </strong>{" "}
                to{" "}
                <strong className="text-foreground">{confirmPlan.label}</strong>. This takes effect
                immediately and your next invoice will reflect the new rate (₦
                {(confirmPlan.monthlyFee / 1000).toFixed(0)}K/month).
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmPlan(null)}
                  className="flex-1 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSwitch}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Spending Trend */}
        {trends.length > 0 && (
          <div className="bg-card rounded-xl shadow-sm p-6 border border-border">
            <h3 className="text-base font-semibold text-foreground mb-5">Billing Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" stroke="currentColor" />
                <YAxis className="text-xs" stroke="currentColor" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number | undefined) =>
                    value !== undefined ? `₦${value.toFixed(1)}K` : ""
                  }
                />
                <Line type="monotone" dataKey="billed" stroke={primaryColor} strokeWidth={2.5} name="Billed" dot={false} />
                <Line type="monotone" dataKey="paid" stroke="#10b981" strokeWidth={2} name="Paid" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Invoice History */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-base font-semibold text-foreground">Invoice History</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportExcel}
                  disabled={isLoading}
                  className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted flex items-center gap-1.5 text-xs text-foreground disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isLoading}
                  className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted flex items-center gap-1.5 text-xs text-foreground disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <Activity className="w-10 h-10 text-muted-foreground animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading invoices…</p>
            </div>
          ) : !invoices?.list || invoices.list.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No invoices yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {["Invoice #", "Amount", "Status", "Due Date", "Paid At", ""].map((col) => (
                      <th key={col} className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.list.map((invoice: any) => (
                    <tr key={invoice.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4 font-mono text-sm text-foreground">{invoice.invoiceNumber}</td>
                      <td className="px-5 py-4 font-semibold text-foreground">
                        {invoice.currency} {parseFloat(invoice.amount).toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)} flex items-center gap-1 w-fit capitalize`}>
                          {getStatusIcon(invoice.status)}
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {new Date(invoice.dueDate).toLocaleDateString("en-NG")}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("en-NG") : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <button className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="View Invoice">
                          <FileText className="w-4 h-4 text-primary" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoices && (
            <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
              Showing {invoices.list.length} of {invoices.total} invoices
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
