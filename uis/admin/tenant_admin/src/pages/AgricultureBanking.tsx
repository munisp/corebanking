import { Button } from "@/components/ui/button";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import {
    BarChart3,
    Building2,
    ChevronRight,
    CloudRain,
    Cpu,
    DollarSign,
    FileText,
    Fish,
    Globe2,
    Handshake,
    Layers,
    Leaf,
    LineChart,
    Link2,
    MapPin,
    MessageSquare,
    Package,
    PiggyBank,
    RefreshCw,
    Shield,
    ShieldAlert,
    ShoppingCart,
    Sprout,
    Tag,
    TrendingUp,
    Truck,
    Users,
    Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";
import PageHeader from "../components/PageHeader";

interface Stats {
  totalFarmers: number;
  totalFarms: number;
  totalDevices: number;
  totalLoans: number;
  totalLoanAmount: number;
  activeFarmers: number;
  activeFarms: number;
}

export default function AgricultureBanking() {
  const { primaryColor } = useTenantBranding();
  const [stats, setStats] = useState<Stats>({
    totalFarmers: 0,
    totalFarms: 0,
    totalDevices: 0,
    totalLoans: 0,
    totalLoanAmount: 0,
    activeFarmers: 0,
    activeFarms: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch data from all endpoints to calculate stats
      const [farmersRes, farmsRes, devicesRes, loansRes] = await Promise.all([
        apiClient
          .get("/agriculture/api/v1/agriculture/farmers")
          .catch(() => ({ data: { farmers: [] } })),
        apiClient
          .get("/agriculture/api/v1/agriculture/farms")
          .catch(() => ({ data: { farms: [] } })),
        apiClient
          .get("/agriculture/api/v1/agtech/sensors")
          .catch(() => ({ data: { sensors: [] } })),
        apiClient
          .get("/agriculture/api/v1/agriculture/loans")
          .catch(() => ({ data: { loans: [] } })),
      ]);

      const farmers = farmersRes.data?.farmers || [];
      const farms = farmsRes.data?.farms || [];
      const devices = devicesRes.data?.sensors || [];
      const loans = loansRes.data?.loans || [];

      const totalLoanAmount = loans.reduce(
        (sum: number, loan: any) => sum + (loan.loan_amount || 0),
        0,
      );
      const activeFarmers = farmers.filter(
        (f: any) => f.status === "active",
      ).length;
      const activeFarms = farms.filter(
        (f: any) => f.status === "active",
      ).length;

      setStats({
        totalFarmers: farmers.length,
        totalFarms: farms.length,
        totalDevices: devices.length,
        totalLoans: loans.length,
        totalLoanAmount,
        activeFarmers,
        activeFarms,
      });
    } catch (error) {
      toast.error("Failed to fetch agriculture banking stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const coreModules = [
    {
      title: "Farmers",
      description: "Manage farmer registrations and profiles",
      icon: Users,
      path: "/agriculture-farmers",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      stats: `${stats.activeFarmers}/${stats.totalFarmers} Active`,
    },
    {
      title: "Farms",
      description: "Track and manage farm operations",
      icon: Leaf,
      path: "/agriculture-farms",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      stats: `${stats.activeFarms}/${stats.totalFarms} Active`,
    },
    {
      title: "AgTech Devices",
      description: "Manage IoT devices and equipment orders",
      icon: Cpu,
      path: "/agriculture-agtech",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      stats: `${stats.totalDevices} Devices`,
    },
    {
      title: "Agriculture Loans",
      description: "Process and manage agricultural loans",
      icon: Wallet,
      path: "/agriculture-loans",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      stats: `${stats.totalLoans} Loans`,
    },
    {
      title: "Analytics & Reports",
      description: "Portfolio dashboard, impact metrics, CBN/DFI reports",
      icon: BarChart3,
      path: "/agriculture-analytics",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950",
      stats: "Live Analytics",
    },
    {
      title: "Regulatory Compliance",
      description: "CBN sector codes, concentration limits, IFRS9 parameters",
      icon: Shield,
      path: "/agriculture-regulatory",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
      stats: "CBN Compliance",
    },
    {
      title: "Value Chain Finance",
      description: "Equipment loans, invoice finance, export loans, processors",
      icon: Link2,
      path: "/agriculture-value-chain",
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-950",
      stats: "Supply Chain",
    },
    {
      title: "Insurance",
      description: "NAIC-linked policies, parametric triggers, auto claims",
      icon: ShieldAlert,
      path: "/agriculture-insurance",
      color: "text-rose-600",
      bgColor: "bg-rose-50 dark:bg-rose-950",
      stats: "NAIC Integrated",
    },
    {
      title: "Partners & Programs",
      description: "Agri partners, government programs, cooperatives",
      icon: Handshake,
      path: "/agriculture-partners",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950",
      stats: "Gov. Programs",
    },
    {
      title: "Risk Management",
      description: "Area shocks, cohort rescheduling, risk-based pricing, SMS",
      icon: MessageSquare,
      path: "/agriculture-risk",
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
      stats: "Early Warning",
    },
  ];

  const specializedModules = [
    {
      title: "Fisheries & Aquaculture",
      description: "Pond management, fingerling tracking and harvest scheduling",
      icon: Fish,
      path: "/fisheries-aquaculture",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      stats: "Aquaculture",
    },
    {
      title: "Farm Boundary Mapping",
      description: "GPS boundary capture, area verification and conflict detection",
      icon: MapPin,
      path: "/farm-boundary-mapping",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
      stats: "GIS Mapping",
    },
    {
      title: "Crop Yield Prediction",
      description: "ML-powered yield forecasting with weather and soil inputs",
      icon: LineChart,
      path: "/crop-yield-prediction",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950",
      stats: "AI Prediction",
    },
    {
      title: "Crossborder Agri Trade",
      description: "Cross-border trade assessments, documentation and compliance",
      icon: Globe2,
      path: "/crossborder-agri-trade",
      color: "text-sky-600",
      bgColor: "bg-sky-50 dark:bg-sky-950",
      stats: "Export/Import",
    },
    {
      title: "Commodity Price Intelligence",
      description: "Real-time commodity pricing, trend analysis and forecasting",
      icon: DollarSign,
      path: "/commodity-price-intelligence",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950",
      stats: "Market Prices",
    },
    {
      title: "Commodity Exchange",
      description: "Marketplace listings, bidding and commodity spot prices",
      icon: Package,
      path: "/commodity-exchange",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      stats: "Exchange",
    },
    {
      title: "CBN Agri Returns",
      description: "CBN agricultural sector returns submission and compliance",
      icon: FileText,
      path: "/cbn-agri-returns",
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
      stats: "CBN Filing",
    },
    {
      title: "Area Yield Index Insurance",
      description: "Index-based crop insurance policies and claims processing",
      icon: CloudRain,
      path: "/area-yield-index-insurance",
      color: "text-cyan-500",
      bgColor: "bg-cyan-50 dark:bg-cyan-950",
      stats: "Index Insurance",
    },
    {
      title: "Agri Savings Cycles",
      description: "Seasonal savings products linked to harvest cycles",
      icon: PiggyBank,
      path: "/agri-savings-cycles",
      color: "text-pink-600",
      bgColor: "bg-pink-50 dark:bg-pink-950",
      stats: "Cycle Savings",
    },
    {
      title: "Agri Reinsurance",
      description: "Treaty management, cedant-reinsurer workflows and cessions",
      icon: Layers,
      path: "/agri-reinsurance",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      stats: "Reinsurance",
    },
    {
      title: "Agri Logistics",
      description: "Truck dispatch, route optimization and cold chain monitoring",
      icon: Truck,
      path: "/agri-logistics",
      color: "text-teal-500",
      bgColor: "bg-teal-50 dark:bg-teal-950",
      stats: "Cold Chain",
    },
    {
      title: "IoT Sensor Network",
      description: "Farm sensor data ingestion, alerts and analytics",
      icon: Cpu,
      path: "/agri-iot-sensor",
      color: "text-violet-600",
      bgColor: "bg-violet-50 dark:bg-violet-950",
      stats: "Sensor Data",
    },
    {
      title: "Input Marketplace",
      description: "Seed, fertilizer, herbicide and equipment marketplace",
      icon: ShoppingCart,
      path: "/agri-input-marketplace",
      color: "text-lime-600",
      bgColor: "bg-lime-50 dark:bg-lime-950",
      stats: "Marketplace",
    },
    {
      title: "Agri eVoucher",
      description: "Digital voucher issuance for inputs and services",
      icon: Tag,
      path: "/agri-evoucher",
      color: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-950",
      stats: "eVouchers",
    },
    {
      title: "ESG Impact",
      description: "Environmental, social and governance impact tracking",
      icon: Sprout,
      path: "/agri-esg-impact",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      stats: "ESG Metrics",
    },
    {
      title: "Crop Insurance",
      description: "Multi-peril crop insurance policies and loss assessment",
      icon: ShieldAlert,
      path: "/agricultural-insurance",
      color: "text-rose-500",
      bgColor: "bg-rose-50 dark:bg-rose-950",
      stats: "Multi-Peril",
    },
    {
      title: "NIRSAL AgroGeoCoop",
      description: "NIRSAL geospatial cooperative member registry",
      icon: Building2,
      path: "/nirsal-agro-geocoop",
      color: "text-blue-700",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      stats: "NIRSAL",
    },
    {
      title: "CBN Anchor Borrowers",
      description: "Anchor Borrowers Programme applications and disbursements",
      icon: TrendingUp,
      path: "/cbn-anchor-borrowers",
      color: "text-green-700",
      bgColor: "bg-green-50 dark:bg-green-950",
      stats: "ABP",
    },
    {
      title: "Satellite Crop Monitor",
      description: "NDVI satellite imagery, stress alerts and regional summaries",
      icon: RefreshCw,
      path: "/satellite-crop-monitor",
      color: "text-sky-700",
      bgColor: "bg-sky-50 dark:bg-sky-950",
      stats: "Satellite",
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Agriculture Finance"
          title="Agriculture Banking"
          description="Comprehensive agricultural finance and farm management platform"
          icon={<Leaf className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        {/* Overview Stats */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Total Farmers
                </span>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-foreground">
                {stats.totalFarmers}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeFarmers} active
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Total Farms
                </span>
                <Leaf className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-foreground">
                {stats.totalFarms}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeFarms} active
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  AgTech Devices
                </span>
                <Cpu className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-foreground">
                {stats.totalDevices}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                IoT & Equipment
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Total Loans
                </span>
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-foreground">
                {stats.totalLoans}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ₦{(stats.totalLoanAmount / 1000000).toFixed(1)}M disbursed
              </p>
            </div>
          </div>
        )}

        {/* Core Modules */}
        <h2 className="text-lg font-semibold text-foreground mb-4">Core Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {coreModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.path} href={module.path}>
                <a className="block">
                  <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all hover:border-primary group">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${module.bgColor}`}>
                        <Icon className={`w-8 h-8 ${module.color}`} />
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{module.title}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{module.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: primaryColor }}>{module.stats}</span>
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">View Details</Button>
                    </div>
                  </div>
                </a>
              </Link>
            );
          })}
        </div>

        {/* Specialized Services */}
        <h2 className="text-lg font-semibold text-foreground mb-4">Specialized Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {specializedModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.path} href={module.path}>
                <a className="block">
                  <div className="bg-card border border-border rounded-lg p-5 hover:shadow-lg transition-all hover:border-primary group">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg ${module.bgColor}`}>
                        <Icon className={`w-6 h-6 ${module.color}`} />
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-1">{module.title}</h3>
                    <p className="text-muted-foreground text-xs mb-3">{module.description}</p>
                    <span className="text-xs font-medium" style={{ color: primaryColor }}>{module.stats}</span>
                  </div>
                </a>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5" style={{ color: primaryColor }} />
            <h2 className="text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/agriculture-farmers">
              <a>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Register New Farmer
                </Button>
              </a>
            </Link>
            <Link href="/agriculture-agtech">
              <a>
                <Button variant="outline" className="w-full justify-start">
                  <Cpu className="w-4 h-4 mr-2" />
                  Add AgTech Device
                </Button>
              </a>
            </Link>
            <Link href="/agriculture-loans">
              <a>
                <Button variant="outline" className="w-full justify-start">
                  <Wallet className="w-4 h-4 mr-2" />
                  Process Loan
                </Button>
              </a>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
