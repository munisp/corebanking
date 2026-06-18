import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, Users, CreditCard, ArrowRightLeft,
  Shield, TrendingUp, Calculator, Building2, Bell, Search, ChevronDown,
  ChevronRight, Star, Clock, Wallet, Heart,
} from "lucide-react";
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type NavItem = { icon: React.ElementType; label: string; path: string };
type NavCategory = { name: string; icon: React.ElementType; items: NavItem[] };

const navCategories: NavCategory[] = [
  {
    name: "Overview",
    icon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Bell, label: "Alerts", path: "/alerts" },
      { icon: TrendingUp, label: "Analytics", path: "/analytics" },
    ],
  },
  {
    name: "Customers",
    icon: Users,
    items: [
      { icon: Users, label: "Customer 360", path: "/customer-360" },
      { icon: Users, label: "Segments", path: "/customer-segments" },
      { icon: Heart, label: "Engagement", path: "/customer-engagement" },
      { icon: Users, label: "Onboarding", path: "/customer-onboarding" },
      { icon: Star, label: "Feedback", path: "/customer-feedback" },
    ],
  },
  {
    name: "Accounts",
    icon: Building2,
    items: [
      { icon: Building2, label: "Account Opening", path: "/account-opening" },
      { icon: Building2, label: "Statements", path: "/account-statements" },
      { icon: Wallet, label: "Savings", path: "/savings-products" },
      { icon: Clock, label: "Fixed Deposits", path: "/fixed-deposits" },
      { icon: Building2, label: "Dormancy", path: "/dormancy" },
    ],
  },
  {
    name: "Payments",
    icon: ArrowRightLeft,
    items: [
      { icon: ArrowRightLeft, label: "Payments Hub", path: "/payments-hub" },
      { icon: ArrowRightLeft, label: "Transfers", path: "/payment-transactions" },
      { icon: ArrowRightLeft, label: "Bulk Payments", path: "/bulk-payments" },
      { icon: ArrowRightLeft, label: "Remittance", path: "/remittance" },
      { icon: ArrowRightLeft, label: "QR Payments", path: "/qr-payments" },
    ],
  },
  {
    name: "Cards",
    icon: CreditCard,
    items: [
      { icon: CreditCard, label: "Card Management", path: "/card-management" },
      { icon: CreditCard, label: "Card Tokens", path: "/card-tokens" },
      { icon: CreditCard, label: "Virtual Cards", path: "/virtual-accounts" },
    ],
  },
  {
    name: "Lending",
    icon: Wallet,
    items: [
      { icon: Wallet, label: "Loan Origination", path: "/loan-origination" },
      { icon: Wallet, label: "Credit Facilities", path: "/credit-facilities" },
      { icon: Wallet, label: "Collections", path: "/collections" },
      { icon: Wallet, label: "Disbursement", path: "/disbursement" },
    ],
  },
  {
    name: "Treasury",
    icon: TrendingUp,
    items: [
      { icon: TrendingUp, label: "Treasury", path: "/treasury-liquidity" },
      { icon: TrendingUp, label: "FX Rates", path: "/fx-rates" },
      { icon: TrendingUp, label: "Money Market", path: "/money-market" },
    ],
  },
  {
    name: "Risk & Compliance",
    icon: Shield,
    items: [
      { icon: Shield, label: "KYC", path: "/kyc-verification" },
      { icon: Shield, label: "AML", path: "/aml-screening" },
      { icon: Shield, label: "Fraud Detection", path: "/ai-fraud-detection" },
      { icon: Shield, label: "Compliance", path: "/compliance-checks" },
      { icon: Shield, label: "Audit Trail", path: "/audit-trail" },
    ],
  },
  {
    name: "Accounting",
    icon: Calculator,
    items: [
      { icon: Calculator, label: "Chart of Accounts", path: "/chart-of-accounts" },
      { icon: Calculator, label: "GL Entries", path: "/gl-entries" },
      { icon: Calculator, label: "Reconciliation", path: "/reconciliation" },
      { icon: Calculator, label: "EOD Processing", path: "/batch-eod" },
    ],
  },
];

const allMenuItems: NavItem[] = navCategories.flatMap((c) => c.items);

// Flat list for backward compat
const menuItems = allMenuItems;

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    initial.add("Overview");
    const activeCat = navCategories.find((c) => c.items.some((i) => i.path === location));
    if (activeCat) initial.add(activeCat.name);
    return initial;
  });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = allMenuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  // Cmd+K keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[placeholder*="Search pages"]');
        input?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Navigation
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {!isCollapsed && (
              <div className="px-3 pt-2 pb-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search pages... (⌘K)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            )}
            <SidebarMenu className="px-2 py-1">
              {searchQuery ? (
                allMenuItems
                  .filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, 20)
                  .map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => { setLocation(item.path); setSearchQuery(""); }}
                          tooltip={item.label}
                          className="h-9 transition-all font-normal"
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })
              ) : (
                navCategories.map((cat) => {
                  const isCatOpen = openCategories.has(cat.name);
                  const hasActive = cat.items.some((item) => item.path === location);
                  return (
                    <div key={cat.name} className="mb-0.5">
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => {
                            setOpenCategories((prev) => {
                              const next = new Set(prev);
                              if (next.has(cat.name)) next.delete(cat.name);
                              else next.add(cat.name);
                              return next;
                            });
                          }}
                          tooltip={cat.name}
                          className={`h-9 font-medium text-xs uppercase tracking-wide ${hasActive ? "text-primary" : "text-muted-foreground"}`}
                        >
                          <cat.icon className="h-4 w-4" />
                          <span className="flex-1">{cat.name}</span>
                          {!isCollapsed && (
                            <span className="text-muted-foreground">
                              {isCatOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {isCatOpen && !isCollapsed && cat.items.map((item) => {
                        const isActive = location === item.path;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              tooltip={item.label}
                              className="h-8 pl-7 transition-all font-normal text-sm"
                            >
                              <item.icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
