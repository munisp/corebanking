/**
 * KPI Dashboard — Role-based KPI monitoring backed by real transaction data
 * from /ledger/txn/metrics. Shows each user only the KPIs relevant to their
 * tenant role (super_admin can browse all roles).
 */
import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  BarChart3,
  Building,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  DollarSign,
  Lock,
  RefreshCcw,
  Server,
  Shield,
  Target,
  TrendingUp,
  Users,
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
import { useDashboardData } from "../hooks/useDashboardData";

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

// ─── TENANT ROLE DEFINITIONS ────────────────────────────────────────────────

const TENANT_ROLES = [
  "super_admin",
  "branch_manager",
  "operations_manager",
  "risk_manager",
  "internal_auditor",
  "it_admin",
  "relationship_manager",
  "trade_finance_admin",
  "vault_manager",
  "treasury_manager",
  "loan_officer",
  "compliance_officer",
  "support_agent",
] as const;

type TenantRole = (typeof TENANT_ROLES)[number];

const ROLE_METADATA: Record<
  TenantRole,
  { title: string; cadence: "hourly" | "daily"; directReports: TenantRole[] }
> = {
  super_admin: {
    title: "Super Admin",
    cadence: "daily",
    directReports: [
      "branch_manager",
      "operations_manager",
      "risk_manager",
      "it_admin",
      "trade_finance_admin",
      "compliance_officer",
    ],
  },
  branch_manager: {
    title: "Branch Manager",
    cadence: "daily",
    directReports: ["vault_manager", "loan_officer", "relationship_manager"],
  },
  operations_manager: {
    title: "Operations Manager",
    cadence: "daily",
    directReports: ["vault_manager", "support_agent"],
  },
  risk_manager: {
    title: "Risk Manager",
    cadence: "daily",
    directReports: ["internal_auditor", "compliance_officer"],
  },
  internal_auditor: { title: "Internal Auditor", cadence: "daily", directReports: [] },
  it_admin: { title: "IT Administrator", cadence: "hourly", directReports: [] },
  relationship_manager: { title: "Relationship Manager", cadence: "daily", directReports: [] },
  trade_finance_admin: {
    title: "Trade Finance Admin",
    cadence: "daily",
    directReports: ["treasury_manager"],
  },
  vault_manager: { title: "Vault Manager", cadence: "hourly", directReports: [] },
  treasury_manager: { title: "Treasury Manager", cadence: "daily", directReports: [] },
  loan_officer: { title: "Loan Officer", cadence: "daily", directReports: [] },
  compliance_officer: { title: "Compliance Officer", cadence: "daily", directReports: [] },
  support_agent: { title: "Support Agent", cadence: "daily", directReports: [] },
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  super_admin: <Crown size={18} />,
  branch_manager: <Building size={18} />,
  operations_manager: <Activity size={18} />,
  risk_manager: <AlertTriangle size={18} />,
  internal_auditor: <Shield size={18} />,
  it_admin: <Server size={18} />,
  relationship_manager: <Users size={18} />,
  trade_finance_admin: <TrendingUp size={18} />,
  vault_manager: <Lock size={18} />,
  treasury_manager: <BarChart3 size={18} />,
  loan_officer: <DollarSign size={18} />,
  compliance_officer: <CheckCircle2 size={18} />,
  support_agent: <Users size={18} />,
};

// ─── STATUS / COLOUR HELPERS ─────────────────────────────────────────────────

const STATUS_COLORS = {
  green: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
    dot: "bg-emerald-500",
    hex: "#10b981",
  },
  amber: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    dot: "bg-amber-500",
    hex: "#f59e0b",
  },
  red: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-300",
    dot: "bg-red-500",
    hex: "#ef4444",
  },
};

function kpiStatus(
  value: number,
  target: number,
  higherIsBetter = true,
): "green" | "amber" | "red" {
  if (target === 0) return "green";
  const pct = (value / target) * 100;
  if (higherIsBetter) return pct >= 85 ? "green" : pct >= 60 ? "amber" : "red";
  // lower is better: ≤50% of target = green, ≤100% = amber, >100% = red
  return pct <= 50 ? "green" : pct <= 100 ? "amber" : "red";
}

// ─── KPI COMPUTATION ────────────────────────────────────────────────────────

function computeKPIs(
  role: TenantRole,
  txns: any[],
  users: any[],
  apiMetrics: { total_count: number; total_volume: number },
): KPIMetric[] {
  const total = apiMetrics.total_count || txns.length || 0;
  // total_volume appears to be in naira (the Dashboard formats it as ÷1000 → K)
  const volumeNGN = apiMetrics.total_volume || 0;
  const volM = volumeNGN / 1_000_000;

  const successCount = txns.filter((t) => t.status?.toLowerCase() === "success").length;
  const failedCount = txns.filter((t) => t.status?.toLowerCase() === "failed").length;
  const pendingCount = txns.filter((t) => t.status?.toLowerCase() === "pending").length;
  const denominator = txns.length || 1;
  const successRate = (successCount / denominator) * 100;
  const failRate = (failedCount / denominator) * 100;
  const complianceRate = 100 - failRate;
  const userCount = users.length;

  const r = (n: number) => Math.round(n * 10) / 10;
  const s = kpiStatus;

  switch (role) {
    case "super_admin":
      return [
        { id: "total_txns", name: "Total Transactions", value: total, target: 10000, unit: "txns", weight: 0.15, status: s(total, 10000), cadence: "daily", description: "All transactions processed" },
        { id: "txn_volume", name: "Transaction Volume", value: r(volM), target: 100, unit: "₦M", weight: 0.20, status: s(volM, 100), cadence: "daily", description: "Total NGN volume (millions)" },
        { id: "success_rate", name: "Success Rate", value: r(successRate), target: 95, unit: "%", weight: 0.25, status: s(successRate, 95), cadence: "hourly", description: "Successful transaction rate" },
        { id: "user_count", name: "Active Users", value: userCount, target: 5000, unit: "users", weight: 0.15, status: s(userCount, 5000), cadence: "daily", description: "Total registered users" },
        { id: "failed_txns", name: "Failed Transactions", value: failedCount, target: 50, unit: "txns", weight: 0.15, status: s(failedCount, 50, false), cadence: "hourly", description: "Transactions needing attention" },
        { id: "pending_txns", name: "Pending Settlements", value: pendingCount, target: 100, unit: "txns", weight: 0.10, status: s(pendingCount, 100, false), cadence: "hourly", description: "Awaiting settlement" },
      ];

    case "branch_manager":
      return [
        { id: "branch_txns", name: "Branch Transactions", value: total, target: 5000, unit: "txns", weight: 0.25, status: s(total, 5000), cadence: "daily", description: "Total branch transactions" },
        { id: "success_rate", name: "Success Rate", value: r(successRate), target: 90, unit: "%", weight: 0.30, status: s(successRate, 90), cadence: "daily", description: "Transaction success ratio" },
        { id: "txn_volume", name: "Volume Processed", value: r(volM), target: 50, unit: "₦M", weight: 0.20, status: s(volM, 50), cadence: "daily", description: "Total volume handled" },
        { id: "active_users", name: "Active Customers", value: userCount, target: 2000, unit: "customers", weight: 0.15, status: s(userCount, 2000), cadence: "daily", description: "Registered customers" },
        { id: "failed_txns", name: "Failed Transactions", value: failedCount, target: 30, unit: "txns", weight: 0.10, status: s(failedCount, 30, false), cadence: "daily", description: "Failed transactions to review" },
      ];

    case "operations_manager":
      return [
        { id: "throughput", name: "Transaction Throughput", value: total, target: 8000, unit: "txns", weight: 0.20, status: s(total, 8000), cadence: "daily", description: "Operations processed" },
        { id: "efficiency", name: "Operational Efficiency", value: r(successRate), target: 92, unit: "%", weight: 0.30, status: s(successRate, 92), cadence: "hourly", description: "Success-to-total ratio" },
        { id: "pending_ops", name: "Pending Operations", value: pendingCount, target: 200, unit: "ops", weight: 0.20, status: s(pendingCount, 200, false), cadence: "hourly", description: "Operations in queue" },
        { id: "failed_ops", name: "Failed Operations", value: failedCount, target: 80, unit: "ops", weight: 0.20, status: s(failedCount, 80, false), cadence: "hourly", description: "Operations requiring retry" },
        { id: "volume", name: "Processed Volume", value: r(volM), target: 80, unit: "₦M", weight: 0.10, status: s(volM, 80), cadence: "daily", description: "Total financial throughput" },
      ];

    case "risk_manager":
      return [
        { id: "failure_rate", name: "Transaction Failure Rate", value: r(failRate), target: 5, unit: "%", weight: 0.30, status: failRate <= 5 ? "green" : failRate <= 10 ? "amber" : "red", cadence: "hourly", description: "% of transactions that failed" },
        { id: "compliance_rate", name: "Compliance Rate", value: r(complianceRate), target: 95, unit: "%", weight: 0.30, status: s(complianceRate, 95), cadence: "daily", description: "Transactions meeting compliance" },
        { id: "pending_review", name: "Pending Reviews", value: pendingCount, target: 50, unit: "items", weight: 0.20, status: s(pendingCount, 50, false), cadence: "hourly", description: "Items requiring risk review" },
        { id: "total_monitored", name: "Transactions Monitored", value: total, target: 5000, unit: "txns", weight: 0.20, status: s(total, 5000), cadence: "daily", description: "Total under monitoring" },
      ];

    case "internal_auditor":
      return [
        { id: "audit_coverage", name: "Audit Coverage", value: r(successRate), target: 95, unit: "%", weight: 0.35, status: s(successRate, 95), cadence: "daily", description: "% of transactions auditable" },
        { id: "compliance_rate", name: "Compliance Rate", value: r(complianceRate), target: 98, unit: "%", weight: 0.35, status: s(complianceRate, 98), cadence: "daily", description: "Transactions within compliance" },
        { id: "exceptions", name: "Exceptions Found", value: failedCount, target: 20, unit: "items", weight: 0.20, status: s(failedCount, 20, false), cadence: "daily", description: "Audit exceptions identified" },
        { id: "total_reviewed", name: "Transactions Reviewed", value: total, target: 3000, unit: "txns", weight: 0.10, status: s(total, 3000), cadence: "daily", description: "Total reviewed transactions" },
      ];

    case "it_admin":
      return [
        { id: "system_uptime", name: "System Uptime (proxy)", value: r(successRate), target: 99.9, unit: "%", weight: 0.35, status: s(successRate, 99.9), cadence: "hourly", description: "Transaction success as uptime proxy" },
        { id: "throughput", name: "API Throughput", value: total, target: 10000, unit: "req", weight: 0.25, status: s(total, 10000), cadence: "hourly", description: "Transaction API requests processed" },
        { id: "error_rate", name: "Error Rate", value: r(failRate), target: 1, unit: "%", weight: 0.25, status: failRate <= 1 ? "green" : failRate <= 5 ? "amber" : "red", cadence: "hourly", description: "System error percentage" },
        { id: "queue_depth", name: "Queue Depth", value: pendingCount, target: 50, unit: "items", weight: 0.15, status: s(pendingCount, 50, false), cadence: "hourly", description: "Items in processing queue" },
      ];

    case "relationship_manager":
      return [
        { id: "active_customers", name: "Active Customers", value: userCount, target: 3000, unit: "customers", weight: 0.30, status: s(userCount, 3000), cadence: "daily", description: "Customers under management" },
        { id: "txn_count", name: "Customer Transactions", value: total, target: 5000, unit: "txns", weight: 0.25, status: s(total, 5000), cadence: "daily", description: "Transactions by managed customers" },
        { id: "txn_volume", name: "Customer Volume", value: r(volM), target: 50, unit: "₦M", weight: 0.25, status: s(volM, 50), cadence: "daily", description: "Volume from managed accounts" },
        { id: "success_rate", name: "Transaction Success Rate", value: r(successRate), target: 95, unit: "%", weight: 0.20, status: s(successRate, 95), cadence: "daily", description: "Proxy for customer satisfaction" },
      ];

    case "trade_finance_admin":
      return [
        { id: "trade_volume", name: "Trade Finance Volume", value: r(volM), target: 200, unit: "₦M", weight: 0.30, status: s(volM, 200), cadence: "daily", description: "Total trade finance volume" },
        { id: "trade_count", name: "Trade Transactions", value: total, target: 3000, unit: "txns", weight: 0.25, status: s(total, 3000), cadence: "daily", description: "Trade finance transactions" },
        { id: "settlement_rate", name: "Settlement Rate", value: r(successRate), target: 90, unit: "%", weight: 0.25, status: s(successRate, 90), cadence: "daily", description: "Successful trade settlements" },
        { id: "pending_settlements", name: "Pending Settlements", value: pendingCount, target: 50, unit: "items", weight: 0.20, status: s(pendingCount, 50, false), cadence: "daily", description: "Outstanding settlements" },
      ];

    case "vault_manager":
      return [
        { id: "vault_ops", name: "Vault Operations", value: total, target: 2000, unit: "ops", weight: 0.25, status: s(total, 2000), cadence: "hourly", description: "Vault operations processed" },
        { id: "settlement_success", name: "Settlement Success", value: r(successRate), target: 99, unit: "%", weight: 0.35, status: s(successRate, 99), cadence: "hourly", description: "Successful settlement rate" },
        { id: "pending_settlements", name: "Pending Settlements", value: pendingCount, target: 30, unit: "items", weight: 0.25, status: s(pendingCount, 30, false), cadence: "hourly", description: "Items awaiting settlement" },
        { id: "failed_settlements", name: "Failed Settlements", value: failedCount, target: 10, unit: "items", weight: 0.15, status: s(failedCount, 10, false), cadence: "hourly", description: "Failed settlement items" },
      ];

    case "treasury_manager":
      return [
        { id: "assets_under_mgmt", name: "Assets Under Mgmt", value: r(volM), target: 500, unit: "₦M", weight: 0.30, status: s(volM, 500), cadence: "daily", description: "Total assets under management" },
        { id: "liquidity_ratio", name: "Liquidity Ratio", value: r(successRate), target: 90, unit: "%", weight: 0.30, status: s(successRate, 90), cadence: "daily", description: "Available liquidity proxy" },
        { id: "pending_funds", name: "Pending Funds", value: pendingCount, target: 100, unit: "items", weight: 0.20, status: s(pendingCount, 100, false), cadence: "daily", description: "Funds awaiting settlement" },
        { id: "failed_transfers", name: "Failed Transfers", value: failedCount, target: 20, unit: "items", weight: 0.20, status: s(failedCount, 20, false), cadence: "daily", description: "Failed treasury transfers" },
      ];

    case "loan_officer":
      return [
        { id: "loan_count", name: "Loan Transactions", value: total, target: 2000, unit: "txns", weight: 0.25, status: s(total, 2000), cadence: "daily", description: "Total loan transactions processed" },
        { id: "disbursement_volume", name: "Disbursement Volume", value: r(volM), target: 100, unit: "₦M", weight: 0.30, status: s(volM, 100), cadence: "daily", description: "Total loan disbursements" },
        { id: "repayment_rate", name: "Repayment Success Rate", value: r(successRate), target: 85, unit: "%", weight: 0.30, status: s(successRate, 85), cadence: "daily", description: "Successful repayment rate" },
        { id: "pending_approvals", name: "Pending Approvals", value: pendingCount, target: 50, unit: "items", weight: 0.15, status: s(pendingCount, 50, false), cadence: "daily", description: "Loan applications pending" },
      ];

    case "compliance_officer":
      return [
        { id: "compliance_rate", name: "Compliance Rate", value: r(complianceRate), target: 98, unit: "%", weight: 0.35, status: s(complianceRate, 98), cadence: "daily", description: "% compliant transactions" },
        { id: "violation_rate", name: "Violation Rate", value: r(failRate), target: 2, unit: "%", weight: 0.30, status: failRate <= 2 ? "green" : failRate <= 5 ? "amber" : "red", cadence: "daily", description: "Non-compliant transaction rate" },
        { id: "pending_reviews", name: "Pending Reviews", value: pendingCount, target: 40, unit: "items", weight: 0.20, status: s(pendingCount, 40, false), cadence: "daily", description: "Items awaiting compliance review" },
        { id: "total_monitored", name: "Transactions Monitored", value: total, target: 5000, unit: "txns", weight: 0.15, status: s(total, 5000), cadence: "daily", description: "Total compliance monitoring" },
      ];

    case "support_agent":
      return [
        { id: "customers_served", name: "Customers Served", value: userCount, target: 1000, unit: "customers", weight: 0.30, status: s(userCount, 1000), cadence: "daily", description: "Customers in system" },
        { id: "txn_success", name: "Transaction Success", value: r(successRate), target: 90, unit: "%", weight: 0.30, status: s(successRate, 90), cadence: "daily", description: "Successful transaction rate" },
        { id: "pending_issues", name: "Open Issues (pending txns)", value: pendingCount, target: 50, unit: "items", weight: 0.20, status: s(pendingCount, 50, false), cadence: "daily", description: "Support tickets (pending txns)" },
        { id: "total_volume", name: "Transactions Monitored", value: total, target: 3000, unit: "txns", weight: 0.20, status: s(total, 3000), cadence: "daily", description: "Total transactions monitored" },
      ];

    default:
      return [
        { id: "total_txns", name: "Total Transactions", value: total, target: 5000, unit: "txns", weight: 0.40, status: s(total, 5000), cadence: "daily", description: "Transactions processed" },
        { id: "success_rate", name: "Success Rate", value: r(successRate), target: 90, unit: "%", weight: 0.40, status: s(successRate, 90), cadence: "daily", description: "Transaction success ratio" },
        { id: "pending_items", name: "Pending Items", value: pendingCount, target: 100, unit: "items", weight: 0.20, status: s(pendingCount, 100, false), cadence: "daily", description: "Pending items" },
      ];
  }
}

function computeWeightedScore(kpis: KPIMetric[]): number {
  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = kpis.reduce((s, k) => {
    const pct = Math.min(120, (k.value / Math.max(k.target, 0.0001)) * 100);
    return s + pct * k.weight;
  }, 0);
  return Math.round((weighted / totalWeight) * 10) / 10;
}

function buildRoleData(
  role: TenantRole,
  txns: any[],
  users: any[],
  apiMetrics: { total_count: number; total_volume: number },
): RoleKPIResult {
  const meta = ROLE_METADATA[role] ?? { title: role, cadence: "daily", directReports: [] };
  const kpis = computeKPIs(role, txns, users, apiMetrics);
  const ownScore = computeWeightedScore(kpis);

  const drScores: DirectReportScore[] = meta.directReports.map((dr) => {
    const drMeta = ROLE_METADATA[dr] ?? { title: dr };
    const drKpis = computeKPIs(dr, txns, users, apiMetrics);
    const drScore = computeWeightedScore(drKpis);
    const status: "green" | "amber" | "red" = drScore >= 85 ? "green" : drScore >= 60 ? "amber" : "red";
    const w = 1 / Math.max(meta.directReports.length, 1);
    return {
      role: dr,
      title: drMeta.title,
      score: drScore,
      status,
      weight: w,
      weightedScore: Math.round(drScore * w * 10) / 10,
    };
  });

  const rollUpScore =
    drScores.length > 0
      ? Math.round(drScores.reduce((s, dr) => s + dr.score * dr.weight, 0) * 10) / 10
      : ownScore;
  const compositeScore =
    drScores.length > 0
      ? Math.round((ownScore * 0.6 + rollUpScore * 0.4) * 10) / 10
      : ownScore;

  const overallStatus: "green" | "amber" | "red" =
    compositeScore >= 85 ? "green" : compositeScore >= 60 ? "amber" : "red";

  return {
    role,
    title: meta.title,
    overallScore: ownScore,
    overallStatus,
    metrics: kpis,
    directReportScores: drScores,
    rollUpScore,
    compositeScore,
    lastUpdated: new Date().toISOString(),
    cadence: meta.cadence,
  };
}

function buildTree(
  txns: any[],
  users: any[],
  apiMetrics: { total_count: number; total_volume: number },
): TreeNode {
  function buildNode(role: TenantRole): TreeNode {
    const meta = ROLE_METADATA[role];
    const data = buildRoleData(role, txns, users, apiMetrics);
    return {
      role,
      title: meta.title,
      ownScore: data.overallScore,
      rollUpScore: data.rollUpScore,
      compositeScore: data.compositeScore,
      status: data.overallStatus,
      children: meta.directReports.map((dr) => buildNode(dr)),
    };
  }
  return buildNode("super_admin");
}

function getCurrentRole(): TenantRole {
  let role = localStorage.getItem("tenant_role") || "";
  if (!role) {
    try {
      const u = JSON.parse(localStorage.getItem("auth_user") || "{}");
      role = u.tenant_role || u.access_level || u.role || "";
    } catch {}
  }
  if (!role) {
    try {
      const d = JSON.parse(localStorage.getItem("admin_data") || "{}");
      role = d.access_level || d.tenant_role || "";
    } catch {}
  }
  return ((role as TenantRole) in ROLE_METADATA ? (role as TenantRole) : "super_admin");
}

// ─── SPARK-LINE TREND (visual-only; seeded from value for stability) ─────────

function generateTrend(current: number, volatility = 5): number[] {
  const points: number[] = [];
  let val = current - volatility * 2;
  for (let i = 0; i < 7; i++) {
    val += (i % 2 === 0 ? 1 : -0.5) * (volatility * 0.6);
    points.push(Math.max(0, Math.min(150, val)));
  }
  points.push(current);
  return points;
}

// ─── VISUALIZATION COMPONENTS ────────────────────────────────────────────────

function TrafficLight({ status }: { status: "green" | "amber" | "red" }) {
  const c = STATUS_COLORS[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-full ${c.dot} animate-pulse`} />
      <span className={`text-xs font-medium ${c.text} uppercase`}>{status}</span>
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const status = score >= 85 ? "green" : score >= 60 ? "amber" : "red";
  const c = STATUS_COLORS[status];
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${c.bg} ${c.border} border`}>
      {label && <span className={`text-xs ${c.text}`}>{label}:</span>}
      <span className={`text-sm font-bold ${c.text}`}>{score.toFixed(1)}</span>
    </div>
  );
}

function CompositeGauge({ score, label }: { score: number; label: string }) {
  const status = score >= 85 ? "green" : score >= 60 ? "amber" : "red";
  const color = STATUS_COLORS[status].hex;
  const data = [{ name: label, value: score, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={140} height={100}>
        <RadialBarChart cx="50%" cy="100%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} barSize={12} data={data}>
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
  const c = STATUS_COLORS[metric.status];
  const pct = Math.min(100, (metric.value / Math.max(metric.target, 0.0001)) * 100);
  const trend = generateTrend(metric.value, metric.value * 0.05 || 2);
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${c.border} ${c.bg} bg-opacity-30`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${c.dot}`} />
          <span className="text-sm font-medium text-gray-900 truncate">{metric.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${metric.cadence === "hourly" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
            {metric.cadence}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 ml-4 truncate">{metric.description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Sparkline data={trend} color={c.hex} />
        <div className="text-right w-24">
          <div className="text-sm font-bold text-gray-900">{metric.value} <span className="text-xs text-gray-500">{metric.unit}</span></div>
          <div className="text-xs text-gray-500">Target: {metric.target} {metric.unit}</div>
        </div>
        <div className="w-16">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: c.hex }} />
          </div>
          <div className="text-xs text-center text-gray-400 mt-0.5">{Math.round(pct)}%</div>
        </div>
        <div className="text-xs text-gray-400 w-10 text-right">{Math.round(metric.weight * 100)}%</div>
        <TrafficLight status={metric.status} />
      </div>
    </div>
  );
}

function MetricsBarChart({ metrics }: { metrics: KPIMetric[] }) {
  const data = metrics.map((m) => ({
    name: m.name.length > 15 ? m.name.substring(0, 14) + "…" : m.name,
    actual: m.value,
    target: m.target,
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

function MetricsRadarChart({ metrics }: { metrics: KPIMetric[] }) {
  const data = metrics.map((m) => ({
    metric: m.name.length > 12 ? m.name.substring(0, 11) + "…" : m.name,
    score: Math.round((m.value / Math.max(m.target, 0.0001)) * 100),
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

function StatusDistributionChart({ metrics }: { metrics: KPIMetric[] }) {
  const green = metrics.filter((m) => m.status === "green").length;
  const amber = metrics.filter((m) => m.status === "amber").length;
  const red = metrics.filter((m) => m.status === "red").length;
  const data = [
    { name: "Green", value: green, color: "#10b981" },
    { name: "Amber", value: amber, color: "#f59e0b" },
    { name: "Red", value: red, color: "#ef4444" },
  ].filter((d) => d.value > 0);
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
        {data.map((d) => (
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

function PerformanceTrendChart({ score }: { score: number }) {
  const data = Array.from({ length: 30 }, (_, i) => {
    const base = score - 8 + (i % 3) * 2;
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

function WeightDistributionChart({ metrics }: { metrics: KPIMetric[] }) {
  const data = metrics.map((m) => ({
    name: m.name.length > 18 ? m.name.substring(0, 17) + "…" : m.name,
    weight: Math.round(m.weight * 100),
    fill: STATUS_COLORS[m.status].hex,
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, metrics.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ left: 100, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" domain={[0, 35]} tick={{ fontSize: 10 }} unit="%" />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
        <Tooltip />
        <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DirectReportCard({
  report,
  onDrillDown,
}: {
  report: DirectReportScore;
  onDrillDown: (role: string) => void;
}) {
  const c = STATUS_COLORS[report.status];
  return (
    <div
      className={`p-3 rounded-lg border ${c.border} cursor-pointer hover:shadow-md transition-shadow`}
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

function DirectReportsChart({ reports }: { reports: DirectReportScore[] }) {
  const data = reports.map((r) => ({
    name: r.title.length > 16 ? r.title.substring(0, 15) + "…" : r.title,
    score: r.score,
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

function HierarchyTree({
  node,
  level = 0,
  onSelect,
}: {
  node: TreeNode;
  level?: number;
  onSelect: (role: string) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const c = STATUS_COLORS[node.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.green;
  return (
    <div className={level > 0 ? "ml-6 border-l-2 border-gray-200 pl-4" : ""}>
      <div
        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${c.bg} bg-opacity-20`}
        onClick={() => { setExpanded(!expanded); onSelect(node.role); }}
      >
        {node.children.length > 0 && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        {ROLE_ICONS[node.role]}
        <span className="text-sm font-medium flex-1">{node.title}</span>
        <ScoreBadge score={node.compositeScore} />
        <TrafficLight status={node.status as "green" | "amber" | "red"} />
      </div>
      {expanded &&
        node.children.map((child) => (
          <HierarchyTree key={child.role} node={child} level={level + 1} onSelect={onSelect} />
        ))}
    </div>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────

export default function KPIDashboardWorkspace() {
  // Real transaction data from /ledger/txn/metrics
  const { transactions, users, metrics, loading } = useDashboardData();

  // Resolve current user's role from localStorage (same priority as App.tsx)
  const currentRole = useMemo(() => getCurrentRole(), []);
  const canBrowseRoles = currentRole === "super_admin";

  const [selectedRole, setSelectedRole] = useState<TenantRole>(currentRole);
  const [view, setView] = useState<"metrics" | "hierarchy" | "compensation">("metrics");

  // Compute KPI result for the selected role from live data
  const roleData = useMemo<RoleKPIResult | null>(() => {
    if (loading) return null;
    return buildRoleData(selectedRole, transactions, users, metrics);
  }, [selectedRole, transactions, users, metrics, loading]);

  // Build the full org-hierarchy tree (all roles computed from same live data)
  const treeData = useMemo<TreeNode | null>(() => {
    if (loading) return null;
    return buildTree(transactions, users, metrics);
  }, [transactions, users, metrics, loading]);

  const handleRoleSelect = (role: string) => {
    if (canBrowseRoles && (role as TenantRole) in ROLE_METADATA) {
      setSelectedRole(role as TenantRole);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI Performance Dashboard</h1>
          <p className="text-sm text-gray-500">
            Role-based KPIs with weighted scoring — data from{" "}
            <span className="font-mono text-indigo-600">/ledger/txn/metrics</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Clock size={12} />
            {loading ? "Refreshing…" : "Live — auto-refresh 30s"}
          </div>
          {loading && <RefreshCcw size={14} className="animate-spin text-indigo-500" />}
        </div>
      </div>

      {/* Role Selector — super_admin sees all; others see only their own */}
      {canBrowseRoles ? (
        <div className="space-y-1">
          <p className="text-xs text-gray-400">Browse roles (Super Admin only)</p>
          <div className="flex gap-2 flex-wrap">
            {TENANT_ROLES.map((role) => (
              <Button
                key={role}
                variant={selectedRole === role ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRole(role)}
              >
                {ROLE_ICONS[role]}
                <span className="ml-1 capitalize">{role.replace(/_/g, " ")}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg w-fit">
          {ROLE_ICONS[currentRole]}
          <div>
            <p className="text-sm font-semibold text-indigo-800">
              {ROLE_METADATA[currentRole]?.title ?? currentRole}
            </p>
            <p className="text-xs text-indigo-500">Your KPI view</p>
          </div>
          <TrafficLight status={roleData?.overallStatus ?? "green"} />
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {(["metrics", "hierarchy", "compensation"] as const).map((v) => (
          <Button key={v} variant={view === v ? "default" : "ghost"} size="sm" onClick={() => setView(v)} className="capitalize">
            {v}
          </Button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500 space-y-2">
          <RefreshCcw className="animate-spin mx-auto" size={24} />
          <p>Loading KPI data from ledger…</p>
        </div>
      )}

      {/* ── METRICS VIEW ── */}
      {!loading && view === "metrics" && roleData && (
        <div className="space-y-6">
          {/* Score Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex flex-col items-center">
                <CompositeGauge score={roleData.overallScore} label="Own Score" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center">
                <CompositeGauge score={roleData.rollUpScore} label="Roll-Up Score" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center">
                <CompositeGauge score={roleData.compositeScore} label="Composite (60/40)" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center gap-3">
                <div className="text-xs text-gray-500">Status</div>
                <TrafficLight status={roleData.overallStatus} />
                <StatusDistributionChart metrics={roleData.metrics} />
              </CardContent>
            </Card>
          </div>

          {/* 30-Day Trend */}
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

          {/* Bar + Radar */}
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
                KPI Weight Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WeightDistributionChart metrics={roleData.metrics} />
            </CardContent>
          </Card>

          {/* Metric Detail List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {ROLE_ICONS[selectedRole]}
                {roleData.title} — KPI Metrics
                <span className="text-xs text-gray-400 font-normal">({roleData.cadence} cadence)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roleData.metrics.map((m) => (
                <MetricRow key={m.id} metric={m} />
              ))}
            </CardContent>
          </Card>

          {/* Direct Reports (flow-down) */}
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
                  {roleData.directReportScores.map((dr) => (
                    <DirectReportCard
                      key={dr.role}
                      report={dr}
                      onDrillDown={handleRoleSelect}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── HIERARCHY VIEW ── */}
      {!loading && view === "hierarchy" && treeData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organisation KPI Hierarchy (Flow-Down)</CardTitle>
          </CardHeader>
          <CardContent>
            <HierarchyTree node={treeData} onSelect={handleRoleSelect} />
          </CardContent>
        </Card>
      )}

      {/* ── COMPENSATION VIEW ── */}
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
                      <div
                        key={band}
                        className={`h-2 flex-1 rounded-full ${
                          (i === 0 && roleData.compositeScore < 60) ||
                          (i === 1 && roleData.compositeScore >= 60 && roleData.compositeScore < 80) ||
                          (i === 2 && roleData.compositeScore >= 80 && roleData.compositeScore < 95) ||
                          (i === 3 && roleData.compositeScore >= 95 && roleData.compositeScore < 110) ||
                          (i === 4 && roleData.compositeScore >= 110)
                            ? "bg-purple-600"
                            : "bg-purple-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">KPI Contribution to Variable Pay</h3>
                <WeightDistributionChart metrics={roleData.metrics} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Metric Details</h3>
                {roleData.metrics.map((m) => {
                  const pct = Math.min(100, (m.value / Math.max(m.target, 0.0001)) * 100);
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[m.status].dot}`} />
                      <span className="text-sm flex-1 truncate">{m.name}</span>
                      <span className="text-xs text-gray-500 w-16 text-right">{Math.round(m.weight * 100)}% wt</span>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[m.status].hex }} />
                      </div>
                      <span className="text-sm font-medium w-24 text-right">{m.value} {m.unit}</span>
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
