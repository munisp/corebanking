import {
  BarChart3,
  Building2,
  ChevronRight,
  Cpu,
  DollarSign,
  Handshake,
  Leaf,
  Link2,
  MessageSquare,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { LiveIndicator } from "../components/LiveIndicator";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import { useAnimatedCounter } from "../hooks/useRealTimeData";
import apiClient from "../services/api";
import { branchService } from "../services/branch/branchService";

interface MetricCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  growth: string;
  iconBg: string;
  format?: "number" | "currency" | "large";
  isLoading?: boolean;
}

function MetricCard({
  icon,
  value,
  label,
  growth,
  iconBg,
  format = "number",
  isLoading,
}: MetricCardProps) {
  const animatedValue = useAnimatedCounter(value, 1000);

  const formatValue = (val: number) => {
    if (format === "currency") {
      return `₦${(val / 1000).toFixed(1)}K`;
    } else if (format === "large") {
      return `${(val / 1000).toFixed(1)}`;
    } else if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    }
    return val.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 ${iconBg} rounded-lg opacity-50`}>{icon}</div>
          <div className="h-4 w-12 bg-muted rounded"></div>
        </div>
        <div className="h-8 w-24 bg-muted rounded mb-2"></div>
        <div className="h-4 w-32 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 ${iconBg} rounded-lg`}>{icon}</div>
        <span className="text-sm font-semibold text-primary">{growth}</span>
      </div>
      <div className="text-3xl font-bold text-foreground">
        {formatValue(animatedValue)}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

// interface DashboardMetrics {
//   tenant_id: string;
//   total_customers: number;
//   total_accounts: number;
//   total_transactions: number;
//   total_volume: number;
//   active_users: number;
// }

interface AgriStats {
  totalFarmers: number;
  activeFarmers: number;
  totalFarms: number;
  totalLoans: number;
  totalLoanAmount: number;
  totalDevices: number;
}

export default function Dashboard() {
  const { name } = useTenantBranding();
  // State for users, transactions, branches
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [metrics, setMetrics] = useState<{
    total_count: number;
    total_volume: number;
  } | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [agriStats, setAgriStats] = useState<AgriStats>({
    totalFarmers: 0,
    activeFarmers: 0,
    totalFarms: 0,
    totalLoans: 0,
    totalLoanAmount: 0,
    totalDevices: 0,
  });
  const [agriLoading, setAgriLoading] = useState(true);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await apiClient.get("/user/user/tenant");
        const data = response.data;
        let usersData: any[] = [];
        if (Array.isArray(data)) usersData = data;
        else if (Array.isArray(data.users)) usersData = data.users;
        else if (Array.isArray(data.data)) usersData = data.data;
        setUsers(usersData);
      } catch (e) {
        console.error("Error fetching users:", e);
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch transaction metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      setMetricsLoading(true);
      try {
        const response = await apiClient.get("/ledger/txn/metrics");
        const data = response.data;
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      } catch (e) {
        console.error("Error fetching transaction metrics:", e);
        setMetrics(null);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      setBranchesLoading(true);
      try {
        const data = await branchService.getAllBranches();
        setBranches(data);
      } catch (e) {
        console.error("Error fetching users:", e);
        setBranches([]);
      } finally {
        setBranchesLoading(false);
      }
    };
    fetchBranches();
    const interval = setInterval(fetchBranches, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch agriculture stats
  useEffect(() => {
    const fetchAgriStats = async () => {
      setAgriLoading(true);
      try {
        const [farmersRes, farmsRes, devicesRes, loansRes] = await Promise.all([
          apiClient.get("/agricultural/api/v1/agriculture/farmers").catch(() => ({ data: { farmers: [] } })),
          apiClient.get("/agricultural/api/v1/agriculture/farms").catch(() => ({ data: { farms: [] } })),
          apiClient.get("/agricultural/api/v1/agtech/sensors").catch(() => ({ data: { sensors: [] } })),
          apiClient.get("/agricultural/api/v1/agriculture/loans").catch(() => ({ data: { loans: [] } })),
        ]);
        const farmers: any[] = farmersRes.data?.farmers || [];
        const farms: any[] = farmsRes.data?.farms || [];
        const devices: any[] = devicesRes.data?.sensors || [];
        const loans: any[] = loansRes.data?.loans || [];
        setAgriStats({
          totalFarmers: farmers.length,
          activeFarmers: farmers.filter((f) => f.status === "active").length,
          totalFarms: farms.length,
          totalLoans: loans.length,
          totalLoanAmount: loans.reduce((s: number, l: any) => s + (l.loan_amount || 0), 0),
          totalDevices: devices.length,
        });
      } catch {
        // silently keep zeros
      } finally {
        setAgriLoading(false);
      }
    };
    fetchAgriStats();
    const interval = setInterval(fetchAgriStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Metrics
  const totalUsers = users.length;
  const totalBranches = branches.length;
  // Transaction metrics from API
  const totalTransactions = metrics?.total_count || 0;
  const totalVolume = metrics?.total_volume || 0;

  // Top branches by transaction count (mock: just show first 5 branches)
  const topBranches = branches.slice(0, 5).map((b, i) => ({
    name: b.name,
    code: b.code,
    location: b.location,
    status: b.status,
    customers: Math.floor(Math.random() * 2000 + 500),
    spend: `₦${Math.floor(Math.random() * 100000 + 10000).toLocaleString()}`,
    tier: ["Enterprise", "Professional", "Basic"][i % 3],
  }));

  // Only show loading if any are loading
  const isLoading = usersLoading || metricsLoading || branchesLoading;


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {name} Super Admin Console
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator isLive={!isLoading} />
          <span className="text-sm text-muted-foreground">Real-time Data</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={<Users className="w-6 h-6 text-blue-600" />}
          value={totalUsers}
          label="Total Users"
          growth=""
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          isLoading={isLoading}
        />
        <MetricCard
          icon={<Building2 className="w-6 h-6 text-purple-600" />}
          value={totalBranches}
          label="Total Branches"
          growth=""
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          isLoading={isLoading}
        />
        <MetricCard
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
          value={totalTransactions}
          label="Total Transactions"
          growth=""
          iconBg="bg-green-100 dark:bg-green-900/30"
          isLoading={isLoading}
        />
        <MetricCard
          icon={<DollarSign className="w-6 h-6 text-pink-600" />}
          value={totalVolume}
          label="Total Volume (NGN)"
          growth=""
          iconBg="bg-pink-100 dark:bg-pink-900/30"
          format="currency"
          isLoading={isLoading}
        />
      </div>

      {/* Top Branches */}
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <h2 className="text-xl font-bold text-foreground mb-6">
          Top Branches
        </h2>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between animate-pulse"
              >
                <div className="h-4 w-32 bg-muted rounded"></div>
                <div className="h-4 w-20 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        ) : topBranches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No branch data available.</p>
        ) : (
          <div className="space-y-4">
            {topBranches.map((branch: any, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="font-semibold text-foreground">
                    {branch.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agriculture Banking Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-bold text-foreground">Agriculture Banking</h2>
          </div>
          <Link href="/agriculture-banking">
            <a className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium">
              View Full Portfolio <ChevronRight className="w-4 h-4" />
            </a>
          </Link>
        </div>

        {/* Agri Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Farmers", value: agriStats.totalFarmers, sub: `${agriStats.activeFarmers} active`, icon: <Users className="w-4 h-4 text-blue-600" />, bg: "bg-blue-50 dark:bg-blue-900/20" },
            { label: "Total Farms", value: agriStats.totalFarms, sub: "registered", icon: <Leaf className="w-4 h-4 text-green-600" />, bg: "bg-green-50 dark:bg-green-900/20" },
            { label: "AgTech Devices", value: agriStats.totalDevices, sub: "IoT / sensors", icon: <Cpu className="w-4 h-4 text-purple-600" />, bg: "bg-purple-50 dark:bg-purple-900/20" },
            { label: "Total Loans", value: agriStats.totalLoans, sub: "agri loans", icon: <Wallet className="w-4 h-4 text-orange-600" />, bg: "bg-orange-50 dark:bg-orange-900/20" },
            { label: "Disbursed (₦M)", value: Math.round(agriStats.totalLoanAmount / 1_000_000), sub: "loan volume", icon: <DollarSign className="w-4 h-4 text-pink-600" />, bg: "bg-pink-50 dark:bg-pink-900/20" },
            { label: "Compliance", value: agriStats.totalFarmers > 0 ? Math.round((agriStats.activeFarmers / agriStats.totalFarmers) * 100) : 0, sub: "active rate %", icon: <ShieldCheck className="w-4 h-4 text-teal-600" />, bg: "bg-teal-50 dark:bg-teal-900/20" },
          ].map((card) => (
            <div key={card.label} className={`bg-card rounded-xl border border-border p-4 ${agriLoading ? "animate-pulse" : ""}`}>
              <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>{card.icon}</div>
              <div className="text-2xl font-bold text-foreground">
                {agriLoading ? <div className="h-6 w-10 bg-muted rounded" /> : card.value.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
              <div className="text-xs text-green-600 font-medium">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Agri Module Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Farmers",        href: "/agriculture-farmers",      icon: <Users className="w-5 h-5" />,        iconBg: "bg-blue-100 dark:bg-blue-900/40",    text: "text-blue-600",   desc: `${agriStats.activeFarmers}/${agriStats.totalFarmers} active` },
            { label: "Farms",          href: "/agriculture-farms",        icon: <Leaf className="w-5 h-5" />,         iconBg: "bg-green-100 dark:bg-green-900/40",  text: "text-green-600",  desc: `${agriStats.totalFarms} registered` },
            { label: "AgTech Devices", href: "/agriculture-agtech",       icon: <Cpu className="w-5 h-5" />,          iconBg: "bg-purple-100 dark:bg-purple-900/40",text: "text-purple-600", desc: `${agriStats.totalDevices} devices` },
            { label: "Loans",          href: "/agriculture-loans",        icon: <Wallet className="w-5 h-5" />,       iconBg: "bg-orange-100 dark:bg-orange-900/40",text: "text-orange-600", desc: `${agriStats.totalLoans} loans` },
            { label: "Analytics",      href: "/agriculture-analytics",    icon: <BarChart3 className="w-5 h-5" />,    iconBg: "bg-cyan-100 dark:bg-cyan-900/40",    text: "text-cyan-600",   desc: "Portfolio & reports" },
            { label: "Regulatory",     href: "/agriculture-regulatory",   icon: <Shield className="w-5 h-5" />,       iconBg: "bg-indigo-100 dark:bg-indigo-900/40",text: "text-indigo-600", desc: "CBN compliance" },
            { label: "Value Chain",    href: "/agriculture-value-chain",  icon: <Link2 className="w-5 h-5" />,        iconBg: "bg-teal-100 dark:bg-teal-900/40",    text: "text-teal-600",   desc: "Equipment & invoices" },
            { label: "Insurance",      href: "/agriculture-insurance",    icon: <ShieldAlert className="w-5 h-5" />,  iconBg: "bg-rose-100 dark:bg-rose-900/40",    text: "text-rose-600",   desc: "NAIC policies & claims" },
            { label: "Partners",       href: "/agriculture-partners",     icon: <Handshake className="w-5 h-5" />,    iconBg: "bg-amber-100 dark:bg-amber-900/40",  text: "text-amber-600",  desc: "Gov. programs" },
            { label: "Risk Mgmt",      href: "/agriculture-risk",         icon: <MessageSquare className="w-5 h-5" />,iconBg: "bg-red-100 dark:bg-red-900/40",      text: "text-red-600",    desc: "Early warning & SMS" },
          ].map((m) => (
            <Link key={m.href} href={m.href}>
              <a className="block bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/40 transition-all group">
                <div className={`inline-flex p-2 rounded-lg ${m.iconBg} ${m.text} mb-3`}>
                  {m.icon}
                </div>
                <div className={`text-sm font-semibold ${m.text} group-hover:underline`}>{m.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
              </a>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
