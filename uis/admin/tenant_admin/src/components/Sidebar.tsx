import { PERMISSION_MAP, usePermissions } from "@/_core/hooks/usePermissions";
import { authService } from "@/services/auth/authService";
import tenantService from "@/services/tenant";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BarChart2,
  Bot,
  Building,
  Building2,
  Calculator,
  CircleDollarSign,
  Clock,
  CreditCard,
  Database,
  FileCheck,
  FileText,
  Filter,
  Fingerprint,
  Globe,
  GraduationCap,
  Handshake,
  Home,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Leaf,
  LineChart,
  Link as LinkIcon,
  Lock,
  LogOut,
  MessageSquare,
  Mic,
  Monitor,
  Network,
  Package,
  PiggyBank,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Truck,
  User,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  Webhook,
  ChevronRight,
  Zap,
  Bell,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import logo from "@/assets/certifications/logos/logo.png";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
const GlobalSearch = lazy(() => import("./GlobalSearch"));
const Notifications = lazy(() => import("./Notifications"));
const AppTour = lazy(() =>
  import("./AppTour").then((m) => ({ default: m.AppTour }))
);

interface MenuItem {
  path: string;
  label: string;
  icon: any;
  tourId?: string;
  featureFlag?: string;
  permission?: { resourceType: string; permission: string } | null;
}

interface Section {
  label: string;
  items: MenuItem[];
}

const sections: Section[] = [
  // =========================
  // OVERVIEW
  // =========================
  {
    label: "Overview",
    items: [
      {
        path: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        tourId: "nav-dashboard",
        permission: PERMISSION_MAP.DASHBOARD,
      },
    ],
  },

  // =========================
  // CUSTOMERS & RELATIONSHIPS
  // =========================
  {
    label: "Customers & Relationships",
    items: [
      { path: "/users", label: "User Management", icon: User, tourId: "nav-users", featureFlag: "user_management", permission: PERMISSION_MAP.MANAGE_EMPLOYEES },
      { path: "/staff-management", label: "Employee Management", icon: Users, featureFlag: "employee_management", permission: PERMISSION_MAP.MANAGE_EMPLOYEES },
      { path: "/relationship-manager", label: "Relationship Manager", icon: Handshake, featureFlag: "relationship_manager", permission: PERMISSION_MAP.MANAGE_CUSTOMERS },
      { path: "/business-management", label: "Business Management", icon: ShieldCheck, tourId: "nav-business", featureFlag: "user_management", permission: PERMISSION_MAP.DASHBOARD },
      { path: "/institutions", label: "Institution Management", icon: Building2, tourId: "nav-institutions", featureFlag: "auth", permission: PERMISSION_MAP.MANAGE_EMPLOYEES },
      { path: "/communication-hub", label: "Communication Hub", icon: MessageSquare, tourId: "nav-comms-hub", featureFlag: "communication_hub", permission: PERMISSION_MAP.MANAGE_CUSTOMERS },
      { path: "/salary-processing", label: "Salary Processing", icon: CircleDollarSign, featureFlag: "salary_processing", permission: PERMISSION_MAP.MANAGE_EMPLOYEES },
      { path: "/beneficiary-management", label: "Beneficiaries", icon: Users, featureFlag: "accounts", permission: PERMISSION_MAP.MANAGE_CUSTOMERS },
      { path: "/cif-management", label: "CIF Management", icon: Database, featureFlag: "accounts", permission: PERMISSION_MAP.VIEW_ALL_DATA },
    ],
  },

  // =========================
  // CORE BANKING
  // =========================
  {
    label: "Core Banking",
    items: [
      { path: "/account-opening", label: "Account Management", icon: FileCheck, featureFlag: "accounts", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/account-statements", label: "Account Statements", icon: FileText, featureFlag: "accounts", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/virtual-accounts", label: "Virtual Accounts", icon: Wallet, featureFlag: "virtual_accounts", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/mandate-management", label: "Mandate Management", icon: FileCheck, featureFlag: "accounts", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/standing-orders", label: "Standing Orders", icon: RefreshCw, featureFlag: "standing_orders", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      // { path: "/standing-charges", label: "Standing Charges", icon: CircleDollarSign, featureFlag: "standing_orders", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/dormancy-management", label: "Dormancy Management", icon: Clock, featureFlag: "accounts", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/safe-deposit", label: "Safe Deposit", icon: Lock, featureFlag: "accounts", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/teller-operations", label: "Teller Station", icon: UserCog, tourId: "nav-teller-ops", featureFlag: "teller", permission: PERMISSION_MAP.TELLER_ACTIONS },
      { path: "/eod-processor", label: "EOD Processor", icon: Clock, featureFlag: "accounts", permission: PERMISSION_MAP.VIEW_ALL_DATA },
    ],
  },

  // =========================
  // PAYMENTS & TRANSFERS
  // =========================
  {
    label: "Payments & Transfers",
    items: [
      { path: "/transactions", label: "Transactions", icon: ArrowLeftRight, tourId: "nav-transactions", featureFlag: "payments", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/transfer", label: "Transfer", icon: ArrowLeftRight, tourId: "nav-transfer", featureFlag: "payments", permission: PERMISSION_MAP.INITIATE_TRANSACTIONS },
      { path: "/bulk-payments", label: "Bulk Payments", icon: Send, featureFlag: "bulk_payments", permission: PERMISSION_MAP.INITIATE_TRANSACTIONS },
      { path: "/qr-payments", label: "QR Payments", icon: Zap, featureFlag: "qr_payments", permission: PERMISSION_MAP.INITIATE_TRANSACTIONS },
      // { path: "/offline-transactions", label: "Offline Transactions", icon: Smartphone, featureFlag: "payments", permission: PERMISSION_MAP.INITIATE_TRANSACTIONS },
      { path: "/utility-payments", label: "Utility Payments", icon: CircleDollarSign, featureFlag: "bill_payments", permission: PERMISSION_MAP.INITIATE_TRANSACTIONS },
      { path: "/payment-investigation", label: "Payment Investigation", icon: Search, featureFlag: "payments", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/wire-transfer-monitor", label: "Wire Transfer Monitor", icon: Activity, featureFlag: "payments", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/remittance", label: "Remittance", icon: Globe, featureFlag: "remittance", permission: PERMISSION_MAP.INITIATE_TRANSACTIONS },
      { path: "/nibss-direct-debit", label: "NIBSS Direct Debit", icon: LinkIcon, featureFlag: "payments", permission: PERMISSION_MAP.INITIATE_TRANSACTIONS },
      { path: "/swift-messages", label: "SWIFT Messages", icon: Send, featureFlag: "payments", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/whatsapp-payment-integration", label: "WhatsApp Payments", icon: MessageSquare, featureFlag: "whatsapp_banking", permission: PERMISSION_MAP.INITIATE_TRANSACTIONS },
      { path: "/cheque-clearing", label: "Cheque Clearing", icon: FileCheck, featureFlag: "payments", permission: PERMISSION_MAP.VIEW_ALL_DATA },
    ],
  },

  // =========================
  // CARDS & CHANNELS
  // =========================
  {
    label: "Cards & Channels",
    items: [
      { path: "/atm-management", label: "ATM Management", icon: CreditCard, featureFlag: "atm_management", permission: PERMISSION_MAP.CARD_MANAGEMENT },
      { path: "/card-dashboard", label: "Card Issuance", icon: CreditCard, tourId: "nav-card-issuance", featureFlag: "card_management", permission: PERMISSION_MAP.CARD_ISSUANCE },
      { path: "/admin/cards", label: "Card Management", icon: CreditCard, tourId: "nav-cards", featureFlag: "card_management", permission: PERMISSION_MAP.CARD_MANAGEMENT },
      { path: "/card-fraud-rules", label: "Card Fraud Rules", icon: ShieldAlert, featureFlag: "card_management", permission: PERMISSION_MAP.CARD_MANAGEMENT },
      { path: "/pos-terminal", label: "POS Terminals", icon: Smartphone, featureFlag: "pos_terminal", permission: PERMISSION_MAP.CARD_MANAGEMENT },
      { path: "/agent-banking", label: "Agent Banking", icon: UserCheck, featureFlag: "agent_banking", permission: PERMISSION_MAP.VIEW_ALL_DATA },
    ],
  },

  // =========================
  // LENDING & CREDIT
  // =========================
  {
    label: "Lending & Credit",
    items: [
      { path: "/loans", label: "Loans", icon: Wallet, tourId: "nav-loans", featureFlag: "loans", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/loan-calculator", label: "Loan Calculator", icon: Calculator, featureFlag: "loans", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/credit-facilities", label: "Credit Facilities", icon: Wallet, featureFlag: "loans", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/credit-bureau", label: "Credit Bureau", icon: FileCheck, featureFlag: "loans", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      // { path: "/credit-scoring", label: "Credit Scoring", icon: BarChart3, featureFlag: "loans", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/credit-risk", label: "Credit Risk", icon: ShieldAlert, featureFlag: "risk_management", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/syndicated-loans", label: "Syndicated Loans", icon: Users, featureFlag: "loans", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/leasing", label: "Leasing", icon: Handshake, featureFlag: "leasing", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/mortgage-banking", label: "Mortgage Banking", icon: Home, featureFlag: "mortgage", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/project-finance", label: "Project Finance", icon: Building, featureFlag: "loans", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/bnpl", label: "BNPL", icon: CreditCard, featureFlag: "bnpl", permission: PERMISSION_MAP.APPLICATIONS },
    ],
  },

  // =========================
  // SAVINGS & WEALTH
  // =========================
  {
    label: "Savings & Wealth",
    items: [
      { path: "/savings", label: "Savings", icon: PiggyBank, tourId: "nav-savings", featureFlag: "savings", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/investments", label: "Investments", icon: TrendingUp, featureFlag: "investment", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/pension", label: "Pension", icon: Shield, featureFlag: "pension", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/insurance", label: "Insurance", icon: ShieldCheck, featureFlag: "insurance", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/wealth-mgmt", label: "Wealth Management", icon: TrendingUp, featureFlag: "wealth_management", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/trust-estate", label: "Trust & Estate", icon: Landmark, featureFlag: "wealth_management", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/escrow-management", label: "Escrow Management", icon: Shield, featureFlag: "escrow", permission: PERMISSION_MAP.APPLICATIONS },
    ],
  },

  // =========================
  // SPECIALIZED BANKING
  // =========================
  {
    label: "Specialized Banking",
    items: [
      { path: "/agriculture-banking", label: "Agriculture Banking", icon: Leaf, featureFlag: "agriculture_finance", permission: PERMISSION_MAP.AGRIC_BANKING },
      { path: "/islamic-banking", label: "Islamic Banking", icon: Building2, featureFlag: "islamic_banking", permission: PERMISSION_MAP.ISLAMIC_BANKING },
      { path: "/education-banking", label: "Education Banking", icon: GraduationCap, featureFlag: "education_loans", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/diaspora-banking", label: "Diaspora Banking", icon: Globe, featureFlag: "diaspora_banking", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/esusu-management", label: "Esusu Portal", icon: Users, featureFlag: "esusu", permission: PERMISSION_MAP.APPLICATIONS },
      { path: "/cooperative-management", label: "Cooperative Management", icon: Users, featureFlag: "cooperative_management", permission: PERMISSION_MAP.APPLICATIONS },
    ],
  },

  // =========================
  // TREASURY & MARKETS
  // =========================
  {
    label: "Treasury & Markets",
    items: [
      { path: "/treasury", label: "Treasury", icon: TrendingUp, featureFlag: "treasury", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/treasury-liquidity", label: "Liquidity", icon: Activity, featureFlag: "treasury", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/fx-dealing-room", label: "FX Dealing Room", icon: CircleDollarSign, featureFlag: "fx", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/fx-rates", label: "FX Rates", icon: TrendingUp, featureFlag: "fx", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/fx-positions", label: "FX Positions", icon: BarChart3, featureFlag: "fx", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/fx-revaluation", label: "FX Revaluation", icon: RefreshCw, featureFlag: "fx", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/money-market", label: "Money Market", icon: Landmark, featureFlag: "treasury", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/interbank-lending", label: "Interbank Lending", icon: Building, featureFlag: "treasury", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/cash-pooling", label: "Cash Pooling", icon: CircleDollarSign, featureFlag: "treasury", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/securities-trading", label: "Securities Trading", icon: TrendingUp, featureFlag: "securities_trading", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/treasury-investments", label: "Treasury Investments", icon: TrendingUp, featureFlag: "treasury", permission: PERMISSION_MAP.VIEW_ALL_DATA },
    ],
  },

  // =========================
  // TRADE FINANCE
  // =========================
  {
    label: "Trade Finance",
    items: [
      { path: "/trade-finance", label: "Trade Finance", icon: Globe, featureFlag: "trade_finance", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/factoring", label: "Export Factoring", icon: Handshake, featureFlag: "trade_finance", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/bank-guarantees", label: "Bank Guarantees", icon: ShieldCheck, featureFlag: "trade_finance", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/supply-chain-finance", label: "Supply Chain Finance", icon: Truck, featureFlag: "supply_chain_finance", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/lpo", label: "LPO", icon: Handshake, featureFlag: "lpo", permission: PERMISSION_MAP.APPLICATIONS },
    ],
  },

  // =========================
  // RISK & COMPLIANCE
  // =========================
  {
    label: "Risk & Compliance",
    items: [
      { path: "/aml-compliance-dashboard", label: "AML Dashboard", icon: Shield, featureFlag: "aml_compliance", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/aml-case-manager", label: "AML Case Manager", icon: AlertCircle, featureFlag: "aml_compliance", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/aml-risk-scoring", label: "AML Risk Scoring", icon: BarChart2, featureFlag: "aml_compliance", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/fraud-detection", label: "Fraud Detection", icon: Shield, featureFlag: "fraud_detection", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/fraud-rules", label: "Fraud Rules", icon: Filter, featureFlag: "fraud_detection", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/fraud-alerts", label: "Fraud Alerts", icon: AlertTriangle, featureFlag: "fraud_detection", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/sanctions-screening", label: "Sanctions Screening", icon: Shield, featureFlag: "sanctions_screening", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/beneficial-ownership", label: "Beneficial Ownership", icon: Users, featureFlag: "sanctions_screening", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/ndpr-compliance", label: "NDPR Compliance", icon: ShieldCheck, featureFlag: "compliance", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/regulatory-reporting", label: "Regulatory Reporting", icon: FileText, featureFlag: "regulatory_reporting", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/cbn-returns", label: "CBN Returns", icon: Building, featureFlag: "regulatory_reporting", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/tax-reporting", label: "Tax Reporting", icon: FileText, featureFlag: "regulatory_reporting", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/disputes", label: "Disputes", icon: AlertTriangle, tourId: "nav-disputes", featureFlag: "dispute", permission: PERMISSION_MAP.DISPUTE_MANAGEMENT },
    ],
  },

  // =========================
  // FINANCE & ACCOUNTING
  // =========================
  {
    label: "Finance & Accounting",
    items: [
      { path: "/billing", label: "Billing", icon: CreditCard, tourId: "nav-billing", permission: PERMISSION_MAP.BILLING },
      { path: "/chart-of-accounts", label: "Chart of Accounts", icon: Calculator, tourId: "nav-chart-accounts", featureFlag: "chart_of_accounts", permission: PERMISSION_MAP.BILLING },
{ path: "/fee-management", label: "Fee Management", icon: CircleDollarSign, featureFlag: "accounts", permission: PERMISSION_MAP.BILLING },
      { path: "/interest-rate", label: "Interest Rates", icon: LineChart, featureFlag: "accounts", permission: PERMISSION_MAP.BILLING },
      { path: "/expense-mgmt", label: "Expense Management", icon: CircleDollarSign, featureFlag: "accounts", permission: PERMISSION_MAP.BILLING },
      { path: "/erp-integration", label: "ERP Integration", icon: Network, featureFlag: "erp_integration", permission: PERMISSION_MAP.ERP_INTEGRATION },
    ],
  },

  // =========================
  // WORKFLOW & AUTOMATION
  // =========================
  {
    label: "Workflow & Automation",
    items: [
      { path: "/approval-workflow", label: "Approval Workflow", icon: Activity, featureFlag: "maker_checker", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/document-management", label: "Document Management", icon: FileText, featureFlag: "document_management", permission: PERMISSION_MAP.VIEW_ALL_DATA },
    ],
  },

  // =========================
  // DEVELOPER PLATFORM
  // =========================
  {
    label: "Developer Platform",
    items: [
      { path: "/api-key-management", label: "API Keys", icon: KeyRound, featureFlag: "developer_platform", permission: PERMISSION_MAP.DEVELOPER_PLATFORM },
      { path: "/oauth-app-registration", label: "OAuth Apps", icon: Shield, featureFlag: "developer_platform", permission: PERMISSION_MAP.DEVELOPER_PLATFORM },
      { path: "/webhook-engine", label: "Webhook Engine", icon: Webhook, featureFlag: "developer_platform", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/sandbox-environment", label: "Sandbox", icon: Server, featureFlag: "developer_platform", permission: PERMISSION_MAP.DEVELOPER_PLATFORM },
    ],
  },

  // =========================
  // NOTIFICATIONS
  // =========================
  {
    label: "Notifications",
    items: [
      { path: "/notification-center", label: "Notification Center", icon: AlertCircle, featureFlag: "notifications", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/notification-preferences", label: "Notification Preferences", icon: Settings, featureFlag: "notifications", permission: PERMISSION_MAP.VIEW_ALL_DATA },
    ],
  },

  // =========================
  // ANALYTICS & MONITORING
  // =========================
  {
    label: "Analytics & Monitoring",
    items: [
      { path: "/monitoring", label: "Monitoring", icon: Monitor, featureFlag: "reporting", permission: PERMISSION_MAP.VIEW_ALL_DATA },
      { path: "/usage-analytics", label: "Usage Analytics", icon: BarChart3, featureFlag: "reporting", permission: PERMISSION_MAP.ANALYTICS },
      { path: "/kpi-dashboard", label: "KPI Dashboard", icon: BarChart3, featureFlag: "reporting", permission: PERMISSION_MAP.ANALYTICS },
      { path: "/audit-logs", label: "Audit Logs", icon: Shield, tourId: "nav-audit-logs", featureFlag: "audit", permission: PERMISSION_MAP.VIEW_AUDIT_LOGS },

    ],
  },

  // =========================
  // ADMINISTRATION
  // =========================
  {
    label: "Administration",
    items: [
      { path: "/admin/admins", label: "Admin Management", icon: UserCog, tourId: "nav-admins", featureFlag: "auth", permission: PERMISSION_MAP.MANAGE_EMPLOYEES },
      { path: "/branches", label: "Branch Management", icon: Building2, tourId: "nav-branches", featureFlag: "auth", permission: PERMISSION_MAP.VIEW_BRANCH_DATA },
      { path: "/admin/temporal-access", label: "Temporal Access", icon: Clock, featureFlag: "temporal_access", permission: PERMISSION_MAP.TEMPORAL_ACCESS },
      { path: "/my-access", label: "My Permissions", icon: ShieldCheck, featureFlag: "auth", permission: PERMISSION_MAP.DASHBOARD },
    ],
  },
];

// Each nav item tagged with its section — visibility is decided per-item against tenant_config.feature_flags.
type NavItem = MenuItem & { section: string };
const NAV_ITEMS: NavItem[] = sections.flatMap((s) =>
  s.items.map((item) => ({ ...item, section: s.label }))
);

export default function Sidebar() {
  const TOUR_KEY = "tenant_admin_tour_v1";
  const COLLAPSED_KEY = "tenant_admin_collapsed_sections_v1";

  // Sections expanded by default; everything else starts collapsed
  const DEFAULT_EXPANDED = new Set([
    "Overview", "Operations", "Products & Services", "Customers",
    "Compliance & Audit", "Finance & Accounting", "Administration", "Monitoring & Alerts",
  ]);

  const [location] = useLocation();
  const { name, primaryColor } = useTenantBranding();
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string>("support_agent");
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; role: string } | null>(null);
  const { hasPermission, initialLoading, permissionCache } = usePermissions();
  const [tourRun, setTourRun] = useState(false);

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {}
    // All sections not in DEFAULT_EXPANDED start collapsed
    return new Set(sections.map((s) => s.label).filter((l) => !DEFAULT_EXPANDED.has(l)));
  });

  const toggleSection = useCallback((label: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const startTour = useCallback(() => setTourRun(true), []);
  const stopTour = useCallback(() => setTourRun(false), []);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      try {
        const authUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
        if (authUser.is_verified === false) return;
      } catch {}
      const t = setTimeout(() => setTourRun(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const update = () => {
      let role = localStorage.getItem("tenant_role") || "";
      let firstName = "";
      let lastName = "";
      let email = "";

      const authUserStr = localStorage.getItem("auth_user");
      if (authUserStr) {
        try {
          const u = JSON.parse(authUserStr);
          if (!role) role = u.tenant_role || u.access_level || u.role || "";
          firstName = u.first_name || "";
          lastName = u.last_name || "";
          email = u.email || "";
        } catch {}
      }

      if (!role) {
        const adminDataStr = localStorage.getItem("admin_data");
        if (adminDataStr) {
          try {
            const a = JSON.parse(adminDataStr);
            role = a.access_level || a.tenant_role || "";
            if (!firstName) firstName = a.first_name || "";
            if (!lastName) lastName = a.last_name || "";
            if (!email) email = a.email || "";
          } catch {}
        }
      }

      const resolvedRole = role || "support_agent";
      setUserRole(resolvedRole);
      setUserInfo({
        name: [firstName, lastName].filter(Boolean).join(" ") || email || "Admin",
        email,
        role: resolvedRole,
      });
    };
    update();
    const handler = (e: StorageEvent) => {
      if (["auth_user", "admin_data", "tenant_role", "54link-dev_auth"].includes(e.key || "")) update();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const updateFeatures = () => {
      // Branch admins: branch_feature_flags overrides tenant flags (no branch_id required at this layer)
      const branchFlagsRaw = localStorage.getItem("branch_feature_flags");
      if (branchFlagsRaw) {
        try {
          const flags = JSON.parse(branchFlagsRaw) as string[];
          setEnabledFeatures(new Set(flags));
          return;
        } catch {}
      }
      // Tenant admins: read feature_flags from tenant_config in localStorage
      const enabled = tenantService.getEnabledFeatures();
      setEnabledFeatures(new Set(enabled));
    };
    updateFeatures();
    // cross-tab storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "tenant_config" || e.key === "branch_feature_flags") updateFeatures();
    };
    // same-tab tenant_config writes (dispatched by tenantService.setTenantConfig)
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("tenant_config_updated", updateFeatures);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tenant_config_updated", updateFeatures);
    };
  }, []);

  // Check each nav item independently against the tenant config feature flags.
  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.featureFlag && !enabledFeatures.has(item.featureFlag)) return false;
      if (item.permission === null) return true;
      if (item.permission) return hasPermission(item.permission.resourceType, item.permission.permission);
      return true;
    });
  }, [enabledFeatures, hasPermission, permissionCache]);

  // Re-group visible items by section, preserving original section order.
  const visibleSections = useMemo(() => {
    const bySection = new Map<string, NavItem[]>();
    for (const item of visibleItems) {
      if (!bySection.has(item.section)) bySection.set(item.section, []);
      bySection.get(item.section)!.push(item);
    }
    return sections
      .filter((s) => bySection.has(s.label))
      .map((s) => ({ label: s.label, items: bySection.get(s.label)! }));
  }, [visibleItems]);

  const roleLabel = userRole
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <>
      <div className="w-64 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 h-screen overflow-hidden flex flex-col shadow-sm">
        {/* Header */}
        <div className="px-5 py-5 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 mb-0.5">
            <img
              src={logo}
              alt={`${name} logo`}
              className="w-7 h-7 rounded-lg object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = logo; }}
            />
            <h1 className="text-lg font-bold tracking-tight" style={{ color: primaryColor }}>
              {name}
            </h1>
          </div>
          <p className="text-[11px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">
            Admin Console
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Suspense fallback={null}>
                <GlobalSearch navItems={visibleItems} />
              </Suspense>
            </div>
            <Suspense fallback={null}>
              <Notifications />
            </Suspense>
          </div>
        </div>

        {/* Sectioned Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {initialLoading ? (
            <div className="animate-pulse space-y-5">
              {[3, 4, 3, 2, 3].map((count, i) => (
                <div key={i}>
                  <div className="h-2 w-20 bg-gray-200 dark:bg-slate-700 rounded mx-3 mb-2" />
                  <div className="space-y-0.5">
                    {Array.from({ length: count }).map((_, j) => (
                      <div key={j} className="h-9 bg-gray-100 dark:bg-slate-800 rounded-lg mx-0.5" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            visibleSections.map((section) => {
              const isCollapsed = collapsedSections.has(section.label);
              const hasActiveItem = section.items.some((i) => i.path === location);
              return (
                <div key={section.label} className="mb-1">
                  <button
                    data-tour={`section-${section.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    onClick={() => toggleSection(section.label)}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group"
                  >
                    <span className={`text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                      hasActiveItem ? "text-gray-700 dark:text-slate-200" : "text-gray-400 dark:text-slate-500"
                    } group-hover:text-gray-600 dark:group-hover:text-slate-300`}>
                      {section.label}
                    </span>
                    <ChevronRight className={`h-3 w-3 text-gray-400 dark:text-slate-500 transition-transform duration-200 ${
                      isCollapsed ? "" : "rotate-90"
                    }`} />
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5 mt-0.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.path;
                        return (
                          <Link key={item.path} href={item.path}>
                            <div
                              data-tour={item.tourId}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                                isActive
                                  ? "font-semibold"
                                  : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100 font-medium"
                              }`}
                              style={isActive ? { backgroundColor: `${primaryColor}12`, color: primaryColor } : {}}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="truncate tracking-tight">{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        {/* User Section */}
        <div className="px-3 py-3 border-t border-gray-100 dark:border-slate-800">
          {userInfo && (
            <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg bg-gray-50 dark:bg-slate-800/60">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {userInfo.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate tracking-tight">
                  {userInfo.name}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider truncate" style={{ color: primaryColor }}>
                  {roleLabel}
                </p>
              </div>
            </div>
          )}
          <Link href="/change-password">
            <div className="flex items-center gap-3 px-3 py-2.5 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors w-full text-sm font-medium cursor-pointer">
              <KeyRound className="h-4 w-4 shrink-0" />
              <span>Change Password</span>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <button
              data-tour="tour-help"
              onClick={startTour}
              title="Start guide tour"
              className="flex items-center gap-2 px-3 py-2.5 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium"
            >
              <span className="h-4 w-4 flex items-center justify-center rounded-full border border-current text-xs font-bold flex-shrink-0">?</span>
              <span>Guide Tour</span>
            </button>
            <button
              onClick={() => {
                authService.logout();
                window.location.href = "/login";
              }}
              className="flex items-center gap-3 px-3 py-2.5 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium ml-auto"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <AppTour run={tourRun} onFinish={stopTour} />
      </Suspense>
    </>
  );
}
