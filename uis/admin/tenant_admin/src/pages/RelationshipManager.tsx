import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import {
  type Activity,
  type Campaign,
  type CrossSellRecommendation,
  type Opportunity,
  type Portfolio,
  type RMCustomer,
  type RMDashboard,
  acceptRecommendation,
  convertRecommendation,
  createActivity,
  createCustomer,
  createOpportunity,
  getDashboard,
  getDashboardAlerts,
  getDashboardTasks,
  getPortfolio,
  listActivities,
  listCampaigns,
  listCustomers,
  listOpportunities,
  listRecommendations,
  rejectRecommendation,
  updateOpportunityStage,
} from "@/services/rmService";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  BarChart3,
  Briefcase,
  CheckCircle,
  ChevronRight,
  Clock,
  Megaphone,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000
    ? `₦${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `₦${(n / 1_000).toFixed(0)}K`
      : `₦${n}`;

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-gray-100 text-gray-700",
  qualified: "bg-blue-100 text-blue-700",
  proposal: "bg-yellow-100 text-yellow-700",
  negotiation: "bg-orange-100 text-orange-700",
  closed_won: "bg-green-100 text-green-700",
  closed_lost: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  dormant: "bg-yellow-100 text-yellow-700",
  churned: "bg-red-100 text-red-700",
  pending: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
  draft: "bg-gray-100 text-gray-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
};

const tabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "portfolio", label: "Portfolio", icon: Briefcase },
  { id: "pipeline", label: "Pipeline", icon: Target },
  { id: "activities", label: "Activities", icon: ActivityIcon },
  { id: "crosssell", label: "Cross-Sell", icon: Zap },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  icon,
  color = "blue",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${bg[color] ?? bg.blue}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  dashboard,
  alerts,
  tasks,
  loading,
}: {
  dashboard: RMDashboard | null;
  alerts: any[];
  tasks: any[];
  loading: boolean;
}) {
  if (loading)
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  if (!dashboard) return null;

  const achievementPct = Math.min(100, dashboard.achievement);

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Managed Customers"
          value={dashboard.totalCustomers}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <KPICard
          label="Portfolio Balance"
          value={fmt(dashboard.totalBalance)}
          icon={<Wallet className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          label="Revenue Achievement"
          value={`${achievementPct.toFixed(1)}%`}
          sub={`${fmt(dashboard.totalRevenue)} / ${fmt(dashboard.revenueTarget)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color={achievementPct >= 80 ? "green" : achievementPct >= 50 ? "yellow" : "red"}
        />
        <KPICard
          label="Avg NPS"
          value={dashboard.averageNPS.toFixed(1)}
          icon={<Star className="w-5 h-5" />}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Pipeline Value"
          value={fmt(dashboard.pipelineValue)}
          sub={`Weighted: ${fmt(dashboard.weightedPipeline)}`}
          icon={<Target className="w-5 h-5" />}
          color="purple"
        />
        <KPICard
          label="Opportunities"
          value={dashboard.totalOpportunities}
          icon={<Briefcase className="w-5 h-5" />}
          color="blue"
        />
        <KPICard
          label="Pending Follow‑ups"
          value={dashboard.pendingFollowUps}
          icon={<Clock className="w-5 h-5" />}
          color={dashboard.pendingFollowUps > 5 ? "red" : "yellow"}
        />
        <KPICard
          label="At‑Risk Customers"
          value={dashboard.atRiskCustomers}
          sub={`${dashboard.dormantCustomers} dormant`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={dashboard.atRiskCustomers > 0 ? "red" : "green"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Alerts
          </h3>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 text-sm py-4">
              <CheckCircle className="w-4 h-4" /> No active alerts
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    a.severity === "high"
                      ? "bg-red-50 border border-red-100"
                      : "bg-yellow-50 border border-yellow-100"
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 ${a.severity === "high" ? "text-red-500" : "text-yellow-500"}`}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.message}</p>
                    <p className="text-xs text-gray-500">{a.count} items</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-500" /> Upcoming Tasks
          </h3>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No tasks due</p>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 6).map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-2 border-b last:border-0">
                  <div
                    className={`p-1.5 rounded ${t.type === "follow_up" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}
                  >
                    {t.type === "follow_up" ? (
                      <Phone className="w-3 h-3" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {t.customerName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.type === "follow_up" ? "Follow-up" : "Review"} · {t.dueDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Portfolio tab ────────────────────────────────────────────────────────────

function PortfolioTab() {
  const [customers, setCustomers] = useState<RMCustomer[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [segFilter, setSegFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    customerType: "individual",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    segment: "mass",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        listCustomers(),
        getPortfolio(),
      ]);
      setCustomers(cRes.customers ?? []);
      setPortfolio(pRes);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = customers.filter((c) => {
    const matchSeg = segFilter === "all" || c.segment === segFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q);
    return matchSeg && matchSearch;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.phone) {
      toast.error("Email and phone are required");
      return;
    }
    setCreating(true);
    try {
      await createCustomer(form);
      toast.success("Customer added to portfolio");
      setShowCreateModal(false);
      setForm({ customerType: "individual", firstName: "", lastName: "", companyName: "", email: "", phone: "", segment: "mass" });
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to add customer");
    } finally {
      setCreating(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading portfolio…
      </div>
    );

  return (
    <div className="space-y-5">
      {/* Portfolio summary */}
      {portfolio && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPICard label="Customers" value={portfolio.totalCustomers} icon={<Users className="w-4 h-4" />} color="blue" />
          <KPICard label="AUM" value={fmt(portfolio.totalBalance)} icon={<Wallet className="w-4 h-4" />} color="green" />
          <KPICard label="Revenue" value={fmt(portfolio.actualRevenue)} sub={`Target: ${fmt(portfolio.targetRevenue)}`} icon={<TrendingUp className="w-4 h-4" />} color="purple" />
          <KPICard label="Avg NPS" value={portfolio.averageNPS.toFixed(1)} icon={<Star className="w-4 h-4" />} color="orange" />
          <KPICard label="Cross-sell Ratio" value={`${(portfolio.crossSellRatio * 100).toFixed(0)}%`} icon={<Zap className="w-4 h-4" />} color="yellow" />
        </div>
      )}

      {/* Filters + table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap gap-3 items-center p-4 border-b border-gray-50">
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={segFilter} onValueChange={setSegFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              {["mass", "affluent", "hnwi", "private", "corporate", "sme"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="flex items-center gap-1" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" /> Add Customer
          </Button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Customer", "Segment", "Balance", "Products", "NPS", "Status", "Last Contact"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">
                  No customers found
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.customerID} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {c.customerType === "corporate" ? c.companyName : `${c.firstName} ${c.lastName}`}
                    </p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{c.segment.toUpperCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{fmt(c.totalBalance)}</td>
                  <td className="px-4 py-3 text-gray-600">{c.totalProducts}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${c.nps >= 70 ? "text-green-600" : c.nps >= 30 ? "text-yellow-600" : "text-red-600"}`}>
                      {c.nps}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {c.lastContact ? new Date(c.lastContact).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create customer modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer to Portfolio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Company (if corporate)</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email *</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Customer Type</Label>
                <Select value={form.customerType} onValueChange={(v) => setForm({ ...form, customerType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["individual", "corporate", "sme", "hnwi"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Segment</Label>
                <Select value={form.segment} onValueChange={(v) => setForm({ ...form, segment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["mass", "affluent", "hnwi", "private", "corporate", "sme"].map((s) => (
                      <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {creating ? "Adding…" : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Pipeline tab ─────────────────────────────────────────────────────────────

const STAGES = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];

function PipelineTab() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    customerID: "",
    productType: "loan",
    productName: "",
    expectedValue: "",
    probability: "50",
    source: "referral",
    expectedClose: "",
    notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listOpportunities(stageFilter !== "all" ? stageFilter : undefined);
      setOpportunities(res.opportunities ?? []);
    } catch {
      toast.error("Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [stageFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerID || !form.productName || !form.expectedClose) {
      toast.error("Customer ID, product name, and expected close date are required");
      return;
    }
    setCreating(true);
    try {
      await createOpportunity({
        ...form,
        expectedValue: Number(form.expectedValue),
        probability: Number(form.probability),
      });
      toast.success("Opportunity created");
      setShowCreate(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to create opportunity");
    } finally {
      setCreating(false);
    }
  };

  const handleStageChange = async (id: string, newStage: string) => {
    try {
      await updateOpportunityStage(id, newStage);
      setOpportunities((prev) => prev.map((o) => (o.opportunityID === id ? { ...o, stage: newStage } : o)));
      toast.success("Stage updated");
    } catch {
      toast.error("Failed to update stage");
    }
  };

  // Stats
  const totalValue = opportunities.reduce((s, o) => s + o.expectedValue, 0);
  const weightedValue = opportunities.reduce((s, o) => s + o.weightedValue, 0);
  const wonCount = opportunities.filter((o) => o.stage === "closed_won").length;

  if (loading)
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading pipeline…
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Opportunities" value={opportunities.length} icon={<Briefcase className="w-4 h-4" />} color="blue" />
        <KPICard label="Pipeline Value" value={fmt(totalValue)} icon={<Wallet className="w-4 h-4" />} color="green" />
        <KPICard label="Weighted Value" value={fmt(weightedValue)} icon={<TrendingUp className="w-4 h-4" />} color="purple" />
        <KPICard label="Won This Cycle" value={wonCount} icon={<CheckCircle className="w-4 h-4" />} color="green" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap gap-3 items-center p-4 border-b border-gray-50">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setShowCreate(true)} className="flex items-center gap-1">
              <Plus className="w-4 h-4" /> New Opportunity
            </Button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Customer", "Product", "Expected Value", "Probability", "Stage", "Close Date", "Move Stage"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {opportunities.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No opportunities</td></tr>
            ) : (
              opportunities.map((o) => (
                <tr key={o.opportunityID} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.customerName}</p>
                    <p className="text-xs text-gray-400">{o.source}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800">{o.productName}</p>
                    <p className="text-xs text-gray-400">{o.productType}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(o.expectedValue)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${o.probability >= 0.7 ? "text-green-600" : o.probability >= 0.4 ? "text-yellow-600" : "text-red-600"}`}>
                      {(o.probability * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[o.stage] ?? "bg-gray-100 text-gray-700"}`}>
                      {o.stage.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {o.expectedClose ? new Date(o.expectedClose).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={o.stage}
                      onValueChange={(v) => handleStageChange(o.opportunityID, v)}
                    >
                      <SelectTrigger className="w-36 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Opportunity</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label>Customer ID *</Label>
              <Input required value={form.customerID} onChange={(e) => setForm({ ...form, customerID: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Product Type</Label>
                <Select value={form.productType} onValueChange={(v) => setForm({ ...form, productType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["loan", "deposit", "card", "insurance", "investment"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Product Name *</Label>
                <Input required value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expected Value (₦)</Label>
                <Input type="number" value={form.expectedValue} onChange={(e) => setForm({ ...form, expectedValue: e.target.value })} />
              </div>
              <div>
                <Label>Probability (%)</Label>
                <Input type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["referral", "campaign", "cross_sell", "walk_in", "digital"].map((s) => (
                      <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expected Close *</Label>
                <Input type="date" required value={form.expectedClose} onChange={(e) => setForm({ ...form, expectedClose: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Activities tab ───────────────────────────────────────────────────────────

function ActivitiesTab() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    customerID: "",
    activityType: "call",
    subject: "",
    description: "",
    outcome: "",
    duration: "30",
    followUpDate: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listActivities(typeFilter !== "all" ? typeFilter : undefined);
      setActivities(res.activities ?? []);
    } catch {
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [typeFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerID || !form.subject) {
      toast.error("Customer ID and subject are required");
      return;
    }
    setCreating(true);
    try {
      await createActivity({ ...form, duration: Number(form.duration) });
      toast.success("Activity logged");
      setShowCreate(false);
      setForm({ customerID: "", activityType: "call", subject: "", description: "", outcome: "", duration: "30", followUpDate: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to log activity");
    } finally {
      setCreating(false);
    }
  };

  const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
    call: <Phone className="w-3.5 h-3.5" />,
    meeting: <Users className="w-3.5 h-3.5" />,
    email: <ChevronRight className="w-3.5 h-3.5" />,
    visit: <User className="w-3.5 h-3.5" />,
    review: <Star className="w-3.5 h-3.5" />,
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading activities…
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap gap-3 items-center p-4 border-b border-gray-50">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {["call", "meeting", "email", "visit", "review"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setShowCreate(true)} className="flex items-center gap-1">
              <Plus className="w-4 h-4" /> Log Activity
            </Button>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ActivityIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No activities found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activities.map((a) => (
              <div key={a.activityID} className="flex items-start gap-3 p-4 hover:bg-gray-50">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg mt-0.5 shrink-0">
                  {ACTIVITY_ICONS[a.activityType] ?? <ActivityIcon className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{a.subject}</p>
                    <Badge variant="outline" className="text-xs">{a.activityType}</Badge>
                    {a.duration > 0 && <span className="text-xs text-gray-400">{a.duration}min</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{a.customerName}</p>
                  {a.description && <p className="text-xs text-gray-400 mt-1 truncate">{a.description}</p>}
                  {a.outcome && <p className="text-xs text-green-600 mt-1">Outcome: {a.outcome}</p>}
                  {a.followUpDate && (
                    <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Follow-up: {new Date(a.followUpDate).toLocaleDateString("en-GB")}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Customer Activity</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label>Customer ID *</Label>
              <Input required value={form.customerID} onChange={(e) => setForm({ ...form, customerID: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Activity Type</Label>
                <Select value={form.activityType} onValueChange={(v) => setForm({ ...form, activityType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["call", "meeting", "email", "visit", "review"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Subject *</Label>
              <Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Outcome</Label>
              <Input value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
            </div>
            <div>
              <Label>Follow-up Date</Label>
              <Input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {creating ? "Logging…" : "Log Activity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Cross-Sell tab ───────────────────────────────────────────────────────────

function CrossSellTab() {
  const [recs, setRecs] = useState<CrossSellRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listRecommendations(statusFilter !== "all" ? statusFilter : undefined);
      setRecs(res.recommendations ?? []);
    } catch {
      toast.error("Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const act = async (id: string, action: "accept" | "reject" | "convert") => {
    if (processing.has(id)) return;
    setProcessing((p) => new Set(p).add(id));
    try {
      const fn = action === "accept" ? acceptRecommendation : action === "reject" ? rejectRecommendation : convertRecommendation;
      const updated = await fn(id);
      setRecs((prev) => prev.map((r) => (r.recommendationID === id ? updated : r)));
      toast.success(`Recommendation ${action}ed`);
    } catch {
      toast.error(`Failed to ${action} recommendation`);
    } finally {
      setProcessing((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading recommendations…
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {["pending", "accepted", "rejected", "converted"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500">{recs.length} recommendation{recs.length !== 1 ? "s" : ""}</span>
      </div>

      {recs.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No recommendations</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recs.map((r) => (
            <div key={r.recommendationID} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{r.customerName}</p>
                  <p className="text-sm text-gray-500">{r.productName} · {r.productType}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700"}`}>
                  {r.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{r.reason}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <span>Score: <strong className={r.score >= 70 ? "text-green-600" : r.score >= 40 ? "text-yellow-600" : "text-red-600"}>{r.score.toFixed(0)}/100</strong></span>
                <span>·</span>
                <span>Expected: <strong className="text-gray-800">{fmt(r.expectedValue)}</strong></span>
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-green-700 border-green-200 hover:bg-green-50"
                    disabled={processing.has(r.recommendationID)} onClick={() => act(r.recommendationID, "accept")}>
                    <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-purple-700 border-purple-200 hover:bg-purple-50"
                    disabled={processing.has(r.recommendationID)} onClick={() => act(r.recommendationID, "convert")}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Convert
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-red-700 border-red-200 hover:bg-red-50"
                    disabled={processing.has(r.recommendationID)} onClick={() => act(r.recommendationID, "reject")}>
                    <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </div>
              )}
              {r.status === "accepted" && (
                <Button size="sm" className="w-full" disabled={processing.has(r.recommendationID)}
                  onClick={() => act(r.recommendationID, "convert")}>
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Mark as Converted
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Campaigns tab ────────────────────────────────────────────────────────────

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await listCampaigns(statusFilter !== "all" ? statusFilter : undefined);
        setCampaigns(res.campaigns ?? []);
      } catch {
        toast.error("Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    })();
  }, [statusFilter]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading campaigns…
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["draft", "active", "paused", "completed"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No campaigns found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const convRate = c.contactedCount > 0 ? ((c.conversionCount / c.contactedCount) * 100).toFixed(1) : "0.0";
            const roi = c.spent > 0 ? (((c.revenue - c.spent) / c.spent) * 100).toFixed(1) : "—";
            return (
              <div key={c.campaignID} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{c.campaignName}</p>
                    <p className="text-xs text-gray-500">{c.campaignType.replace("_", " ")} · {c.targetSegment.toUpperCase()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {c.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="font-bold text-gray-900">{c.contactedCount}/{c.targetCount}</p>
                    <p className="text-gray-500">Contacted</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="font-bold text-gray-900">{convRate}%</p>
                    <p className="text-gray-500">Conversion</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className={`font-bold ${Number(roi) >= 0 ? "text-green-600" : "text-red-600"}`}>{roi !== "—" ? `${roi}%` : "—"}</p>
                    <p className="text-gray-500">ROI</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-between text-xs text-gray-400">
                  <span>{new Date(c.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                  <span>→</span>
                  <span>{new Date(c.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RelationshipManager() {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState("overview");

  // Overview data
  const [dashboard, setDashboard] = useState<RMDashboard | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const fetchOverview = async (showLoader = true) => {
    if (showLoader) setOverviewLoading(true);
    try {
      const [dash, alertRes, taskRes] = await Promise.all([
        getDashboard(),
        getDashboardAlerts(),
        getDashboardTasks(),
      ]);
      setDashboard(dash);
      setAlerts(alertRes.alerts ?? []);
      setTasks(taskRes.tasks ?? []);
    } catch (err) {
      console.error("Failed to load RM dashboard", err);
    } finally {
      if (showLoader) setOverviewLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(true);
    const interval = setInterval(() => fetchOverview(false), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Get user name
  let firstName = "RM";
  try {
    const u = JSON.parse(localStorage.getItem("auth_user") ?? "{}");
    firstName = u.first_name || "Relationship Manager";
  } catch {}

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Relationship Manager"
          title="Relationship Manager"
          description={`Welcome back, ${firstName}. Manage your customer portfolio and drive growth.`}
          icon={<Users className="w-8 h-8" />}
          action={{
            label: "Refresh",
            onClick: () => fetchOverview(true)
          }}
        />
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container">
          <div className="flex gap-1 overflow-x-auto pb-0">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === id
                    ? "border-b-2 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                style={activeTab === id ? { borderBottomColor: primaryColor, color: primaryColor } : {}}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="container py-8">
        {activeTab === "overview" && (
          <OverviewTab dashboard={dashboard} alerts={alerts} tasks={tasks} loading={overviewLoading} />
        )}
        {activeTab === "portfolio" && <PortfolioTab />}
        {activeTab === "pipeline" && <PipelineTab />}
        {activeTab === "activities" && <ActivitiesTab />}
        {activeTab === "crosssell" && <CrossSellTab />}
        {activeTab === "campaigns" && <CampaignsTab />}
      </div>
    </div>
  );
}
