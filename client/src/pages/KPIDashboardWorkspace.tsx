/**
 * KPI Dashboard — Role-based KPI monitoring with traffic lights, flow-down hierarchy,
 * weighted scoring, auto-refresh (30s), drill-down, and rich visualizations.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCcw,
  Shield,
  TrendingUp,
  Users,
  XCircle,
  Target,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface KPIMetric {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  weight: number;
  status: "green" | "amber" | "red";
  cadence: "hourly" | "daily";
  description: string;
}

interface DirectReportScore {
  role: string;
  title: string;
  score: number;
  status: "green" | "amber" | "red";
  weight: number;
  weightedScore: number;
}

interface RoleKPIResult {
  role: string;
  title: string;
  overallScore: number;
  overallStatus: "green" | "amber" | "red";
  metrics: KPIMetric[];
  directReportScores: DirectReportScore[];
  rollUpScore: number;
  compositeScore: number;
  lastUpdated: string;
  cadence: string;
}

interface TreeNode {
  role: string;
  title: string;
  ownScore: number;
  rollUpScore: number;
  compositeScore: number;
  status: string;
  children: TreeNode[];
}

// ─── ROLE METADATA ──────────────────────────────────────────────────────────

const ROLE_ICONS: Record<string, React.ReactNode> = {
  ceo: <BarChart3 size={18} />,
  coo: <Activity size={18} />,
  cro: <AlertTriangle size={18} />,
  cto: <Shield size={18} />,
  cso: <Shield size={18} />,
  treasury: <TrendingUp size={18} />,
  credit: <BarChart3 size={18} />,
  head_teller: <Users size={18} />,
  compliance: <CheckCircle2 size={18} />,
  customer_service: <Users size={18} />,
  internal_audit: <Shield size={18} />,
};

const STATUS_COLORS = {
  green: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500", hex: "#10b981" },
  amber: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", dot: "bg-amber-500", hex: "#f59e0b" },
  red: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300", dot: "bg-red-500", hex: "#ef4444" },
};

const CHART_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

// ─── HELPER: Generate trend data (simulated 7-day history) ──────────────────
function generateTrend(current: number, volatility: number = 5): number[] {
  const points: number[] = [];
  let val = current - volatility * 2 + Math.random() * volatility;
  for (let i = 0; i < 7; i++) {
    val += (Math.random() - 0.4) * volatility;
    points.push(Math.max(0, Math.min(150, val)));
  }
  points.push(current);
  return points;
}

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function TrafficLight({ status }: { status: "green" | "amber" | "red" }) {
  const colors = STATUS_COLORS[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-full ${colors.dot} animate-pulse`} />
      <span className={`text-xs font-medium ${colors.text} uppercase`}>{status}</span>
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const status = score >= 85 ? "green" : score >= 60 ? "amber" : "red";
  const colors = STATUS_COLORS[status];
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg} ${colors.border} border`}>
      {label && <span className={`text-xs ${colors.text}`}>{label}:</span>}
      <span className={`text-sm font-bold ${colors.text}`}>{score.toFixed(1)}</span>
    </div>
  );
}

/** Radial gauge for the composite score */
function CompositeGauge({ score, label }: { score: number; label: string }) {
  const status = score >= 85 ? "green" : score >= 60 ? "amber" : "red";
  const color = STATUS_COLORS[status].hex;
  const data = [{ name: label, value: score, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={140} height={100}>
        <RadialBarChart
          cx="50%" cy="100%" innerRadius="70%" outerRadius="100%"
          startAngle={180} endAngle={0}
          barSize={12} data={data}
        >
          <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#f1f5f9" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-center -mt-4">
        <div className="text-2xl font-bold" style={{ color }}>{score.toFixed(1)}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

/** Mini sparkline trend */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width={80} height={30}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricRow({ metric }: { metric: KPIMetric }) {
  const colors = STATUS_COLORS[metric.status];
  const pct = Math.min(100, (metric.value / metric.target) * 100);
  const trend = generateTrend(metric.value, metric.value * 0.05);

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${colors.border} ${colors.bg} bg-opacity-30`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className="text-sm font-medium text-gray-900 truncate">{metric.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${metric.cadence === "hourly" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
            {metric.cadence}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 ml-4 truncate">{metric.description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Sparkline data={trend} color={colors.hex} />
        <div className="text-right w-24">
          <div className="text-sm font-bold text-gray-900">{metric.value} <span className="text-xs text-gray-500">{metric.unit}</span></div>
          <div className="text-xs text-gray-500">Target: {metric.target} {metric.unit}</div>
        </div>
        {/* Progress bar */}
        <div className="w-16">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: colors.hex }} />
          </div>
          <div className="text-xs text-center text-gray-400 mt-0.5">{Math.round(pct)}%</div>
        </div>
        <div className="text-xs text-gray-400 w-10 text-right">
          {Math.round(metric.weight * 100)}%
        </div>
        <TrafficLight status={metric.status} />
      </div>
    </div>
  );
}

/** Bar chart: metrics performance vs target */
function MetricsBarChart({ metrics }: { metrics: KPIMetric[] }) {
  const data = metrics.map(m => ({
    name: m.name.length > 15 ? m.name.substring(0, 14) + "…" : m.name,
    actual: m.value,
    target: m.target,
    pct: Math.round((m.value / m.target) * 100),
    status: m.status,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 60, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="actual" fill="#6366f1" name="Actual" radius={[4, 4, 0, 0]} />
        <Bar dataKey="target" fill="#e2e8f0" name="Target" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Radar chart: weighted metric coverage */
function MetricsRadarChart({ metrics }: { metrics: KPIMetric[] }) {
  const data = metrics.map(m => ({
    metric: m.name.length > 12 ? m.name.substring(0, 11) + "…" : m.name,
    score: Math.round((m.value / m.target) * 100),
    fullMark: 120,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
        <PolarRadiusAxis angle={90} domain={[0, 120]} tick={{ fontSize: 9 }} />
        <Radar name="Score %" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** Pie chart: status distribution */
function StatusDistributionChart({ metrics }: { metrics: KPIMetric[] }) {
  const green = metrics.filter(m => m.status === "green").length;
  const amber = metrics.filter(m => m.status === "amber").length;
  const red = metrics.filter(m => m.status === "red").length;
  const data = [
    { name: "Green", value: green, color: "#10b981" },
    { name: "Amber", value: amber, color: "#f59e0b" },
    { name: "Red", value: red, color: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={2}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
            <span>{d.name}: {d.value}</span>
          </div>
        ))}
        <div className="text-xs text-gray-400 mt-1">Total: {metrics.length} KPIs</div>
      </div>
    </div>
  );
}

/** Trend area chart (simulated 30-day performance) */
function PerformanceTrendChart({ score }: { score: number }) {
  const data = Array.from({ length: 30 }, (_, i) => {
    const base = score - 8 + Math.random() * 6;
    const drift = (i / 30) * 4;
    return { day: i + 1, score: Math.round((base + drift) * 10) / 10 };
  });

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="day" tick={{ fontSize: 9 }} label={{ value: "Days", fontSize: 10, position: "bottom" }} />
        <YAxis domain={[60, 100]} tick={{ fontSize: 9 }} />
        <Tooltip />
        <Area type="monotone" dataKey="score" stroke="#6366f1" fill="url(#scoreGradient)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Weight distribution horizontal bar chart */
function WeightDistributionChart({ metrics }: { metrics: KPIMetric[] }) {
  const data = metrics.map(m => ({
    name: m.name.length > 18 ? m.name.substring(0, 17) + "…" : m.name,
    weight: Math.round(m.weight * 100),
    fill: STATUS_COLORS[m.status].hex,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, metrics.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ left: 100, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" domain={[0, 25]} tick={{ fontSize: 10 }} unit="%" />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
        <Tooltip />
        <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DirectReportCard({ report, onDrillDown }: { report: DirectReportScore; onDrillDown: (role: string) => void }) {
  const colors = STATUS_COLORS[report.status];
  return (
    <div
      className={`p-3 rounded-lg border ${colors.border} cursor-pointer hover:shadow-md transition-shadow`}
      onClick={() => onDrillDown(report.role)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ROLE_ICONS[report.role]}
          <div>
            <div className="text-sm font-medium">{report.title}</div>
            <div className="text-xs text-gray-500">Weight: {Math.round(report.weight * 100)}%</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={report.score} />
          <ChevronRight size={16} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}

/** Direct Reports bar chart */
function DirectReportsChart({ reports }: { reports: DirectReportScore[] }) {
  const data = reports.map(r => ({
    name: r.title.length > 16 ? r.title.substring(0, 15) + "…" : r.title,
    score: r.score,
    weight: Math.round(r.weight * 100),
    fill: STATUS_COLORS[r.status].hex,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 40, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={50} />
        <YAxis domain={[0, 110]} tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HierarchyTree({ node, level = 0, onSelect }: { node: TreeNode; level?: number; onSelect: (role: string) => void }) {
  const [expanded, setExpanded] = useState(level < 2);
  const colors = STATUS_COLORS[node.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.green;

  return (
    <div className={`${level > 0 ? "ml-6 border-l-2 border-gray-200 pl-4" : ""}`}>
      <div
        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${colors.bg} bg-opacity-20`}
        onClick={() => { setExpanded(!expanded); onSelect(node.role); }}
      >
        {node.children.length > 0 && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        {ROLE_ICONS[node.role]}
        <span className="text-sm font-medium flex-1">{node.title}</span>
        <ScoreBadge score={node.compositeScore} />
        <TrafficLight status={node.status as "green" | "amber" | "red"} />
      </div>
      {expanded && node.children.map(child => (
        <HierarchyTree key={child.role} node={child} level={level + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────────────

export default function KPIDashboardWorkspace() {
  const [selectedRole, setSelectedRole] = useState<string>("ceo");
  const [roleData, setRoleData] = useState<RoleKPIResult | null>(null);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [view, setView] = useState<"metrics" | "hierarchy" | "compensation">("metrics");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [roleRes, treeRes] = await Promise.all([
        fetch(`/api/kpi/${selectedRole}`),
        fetch("/api/kpi/rollup"),
      ]);
      if (roleRes.ok) setRoleData(await roleRes.json());
      if (treeRes.ok) setTreeData(await treeRes.json());
      setLastRefresh(new Date());
    } catch {
      // Offline or service unavailable
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const roles = ["ceo", "coo", "cro", "cto", "cso", "treasury", "credit", "head_teller", "compliance", "customer_service", "internal_audit"];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI Performance Dashboard</h1>
          <p className="text-sm text-gray-500">Real-time personnel KPIs with weighted scoring, visualizations, and flow-down aggregation</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Clock size={12} />
            Last: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCcw size={14} className={autoRefresh ? "animate-spin" : ""} />
            {autoRefresh ? "Live" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCcw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* Role Selector */}
      <div className="flex gap-2 flex-wrap">
        {roles.map(role => (
          <Button
            key={role}
            variant={selectedRole === role ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedRole(role)}
            className="capitalize"
          >
            {ROLE_ICONS[role]}
            <span className="ml-1">{role.replace("_", " ")}</span>
          </Button>
        ))}
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {(["metrics", "hierarchy", "compensation"] as const).map(v => (
          <Button key={v} variant={view === v ? "default" : "ghost"} size="sm" onClick={() => setView(v)} className="capitalize">
            {v}
          </Button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-gray-500">Loading KPI data...</div>}

      {!loading && view === "metrics" && roleData && (
        <div className="space-y-6">
          {/* Score Summary with Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex flex-col items-center">
                <CompositeGauge score={roleData.overallScore} label="Own Score" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center">
                <CompositeGauge score={roleData.rollUpScore || roleData.overallScore} label="Roll-Up Score" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center">
                <CompositeGauge score={roleData.compositeScore} label="Composite (60/40)" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <div className="text-xs text-gray-500 mb-2">Status</div>
                <TrafficLight status={roleData.overallStatus} />
                <StatusDistributionChart metrics={roleData.metrics} />
              </CardContent>
            </Card>
          </div>

          {/* 30-Day Performance Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp size={16} />
                30-Day Composite Score Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceTrendChart score={roleData.compositeScore} />
            </CardContent>
          </Card>

          {/* Charts Row: Bar + Radar side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 size={16} />
                  Metrics: Actual vs Target
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricsBarChart metrics={roleData.metrics} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target size={16} />
                  Performance Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricsRadarChart metrics={roleData.metrics} />
              </CardContent>
            </Card>
          </div>

          {/* Weight Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap size={16} />
                KPI Weight Distribution by Metric
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WeightDistributionChart metrics={roleData.metrics} />
            </CardContent>
          </Card>

          {/* Metrics Detail List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {ROLE_ICONS[selectedRole]}
                {roleData.title} — KPI Metrics
                <span className="text-xs text-gray-400 font-normal">({roleData.cadence} cadence)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roleData.metrics.map(m => <MetricRow key={m.id} metric={m} />)}
            </CardContent>
          </Card>

          {/* Direct Reports Roll-Up with Chart */}
          {roleData.directReportScores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDown size={18} />
                  Flow-Down: Direct Reports
                  <span className="text-xs text-gray-400 font-normal">(40% of composite score)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DirectReportsChart reports={roleData.directReportScores} />
                <div className="space-y-2">
                  {roleData.directReportScores.map(dr => (
                    <DirectReportCard key={dr.role} report={dr} onDrillDown={setSelectedRole} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && view === "hierarchy" && treeData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization KPI Hierarchy (Flow-Down View)</CardTitle>
          </CardHeader>
          <CardContent>
            <HierarchyTree node={treeData} onSelect={setSelectedRole} />
          </CardContent>
        </Card>
      )}

      {!loading && view === "compensation" && roleData && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compensation Model — {roleData.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200">
                  <div className="text-xs text-indigo-600 mb-1">Composite Score</div>
                  <div className="text-3xl font-bold text-indigo-900">{roleData.compositeScore.toFixed(1)}</div>
                  <div className="mt-2 w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min(roleData.compositeScore, 100)}%` }} />
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
                  <div className="text-xs text-emerald-600 mb-1">Variable Multiplier</div>
                  <div className="text-3xl font-bold text-emerald-900">
                    {roleData.compositeScore >= 60 ? ((roleData.compositeScore - 60) / 40).toFixed(2) : "0.00"}x
                  </div>
                  <div className="text-xs text-emerald-600 mt-1">
                    {roleData.compositeScore >= 100 ? "Maximum payout" : roleData.compositeScore >= 85 ? "Above target" : roleData.compositeScore >= 60 ? "Partial payout" : "No variable pay"}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
                  <div className="text-xs text-purple-600 mb-1">Performance Band</div>
                  <div className="text-xl font-bold text-purple-900">
                    {roleData.compositeScore >= 110 ? "Exceptional" : roleData.compositeScore >= 95 ? "Exceeds" : roleData.compositeScore >= 80 ? "Meets" : roleData.compositeScore >= 60 ? "Needs Improvement" : "Unsatisfactory"}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {["Unsatisfactory", "Needs Improvement", "Meets", "Exceeds", "Exceptional"].map((band, i) => (
                      <div key={band} className={`h-2 flex-1 rounded-full ${
                        (i === 0 && roleData.compositeScore < 60) ||
                        (i === 1 && roleData.compositeScore >= 60 && roleData.compositeScore < 80) ||
                        (i === 2 && roleData.compositeScore >= 80 && roleData.compositeScore < 95) ||
                        (i === 3 && roleData.compositeScore >= 95 && roleData.compositeScore < 110) ||
                        (i === 4 && roleData.compositeScore >= 110)
                          ? "bg-purple-600" : "bg-purple-200"
                      }`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Compensation Breakdown Chart */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">KPI Contribution to Variable Pay</h3>
                <WeightDistributionChart metrics={roleData.metrics} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Metric Details</h3>
                {roleData.metrics.map(m => {
                  const pct = Math.min(100, (m.value / m.target) * 100);
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[m.status].dot}`} />
                      <span className="text-sm flex-1 truncate">{m.name}</span>
                      <span className="text-xs text-gray-500 w-16 text-right">{Math.round(m.weight * 100)}% wt</span>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[m.status].hex }} />
                      </div>
                      <span className="text-sm font-medium w-20 text-right">{m.value} {m.unit}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
