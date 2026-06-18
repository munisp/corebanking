import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare, PiggyBank, CreditCard, QrCode, ShoppingCart,
  TrendingUp, Send, Trophy, Users, DollarSign, Activity,
  ArrowUpRight, ArrowDownRight, Smartphone, Globe, Zap
} from "lucide-react";

// Chatbot metrics
const CHATBOT_DATA = {
  channels: [
    { name: "WhatsApp", users: 124500, sessions: 892000, satisfaction: 94, icon: "📱" },
    { name: "Telegram", users: 45200, sessions: 234000, satisfaction: 91, icon: "✈️" },
    { name: "In-App Chat", users: 89300, sessions: 567000, satisfaction: 96, icon: "💬" },
    { name: "USSD *545#", users: 210000, sessions: 1450000, satisfaction: 88, icon: "📞" },
  ],
  intents: [
    { intent: "check_balance", category: "Account", confidence: 0.97, responses: 1234000, escalation: 0.02 },
    { intent: "transfer_funds", category: "Payments", confidence: 0.94, responses: 890000, escalation: 0.05 },
    { intent: "pay_bill", category: "Payments", confidence: 0.93, responses: 456000, escalation: 0.04 },
    { intent: "loan_status", category: "Lending", confidence: 0.91, responses: 234000, escalation: 0.08 },
    { intent: "fraud_report", category: "Security", confidence: 0.89, responses: 45000, escalation: 0.15 },
    { intent: "branch_locator", category: "General", confidence: 0.96, responses: 123000, escalation: 0.01 },
    { intent: "open_account", category: "Onboarding", confidence: 0.88, responses: 67000, escalation: 0.12 },
    { intent: "statement_request", category: "Account", confidence: 0.95, responses: 345000, escalation: 0.03 },
  ],
  totalSessions: 3143000,
  avgResolutionTime: "45s",
  costSavings: 4200000000,
};

// Smart Savings
const SAVINGS_DATA = {
  products: [
    { name: "Round-Ups", users: 45000, balance: 890000000, avgGoal: 50000 },
    { name: "Goal-Based", users: 67000, balance: 3450000000, avgGoal: 500000 },
    { name: "Auto-Sweep", users: 23000, balance: 1200000000, avgGoal: 200000 },
    { name: "52-Week Challenge", users: 12000, balance: 450000000, avgGoal: 100000 },
    { name: "Ajo/Esusu (Group)", users: 34000, balance: 2100000000, avgGoal: 300000 },
    { name: "Lock & Earn", users: 28000, balance: 5600000000, avgGoal: 1000000 },
  ],
  totalBalance: 13690000000,
  totalUsers: 209000,
  avgInterestRate: 14.5,
  monthlyGrowth: 12.3,
};

// Virtual Cards
const CARDS_DATA = {
  types: [
    { type: "Naira Verve", issued: 89000, active: 78000, spend: 12300000000, issuanceTime: "<30s" },
    { type: "Dollar Visa", issued: 34000, active: 29000, spend: 8900000000, issuanceTime: "<60s" },
    { type: "Dollar Mastercard", issued: 23000, active: 19000, spend: 5600000000, issuanceTime: "<60s" },
    { type: "Disposable (Single-Use)", issued: 156000, active: 0, spend: 2300000000, issuanceTime: "<10s" },
  ],
  totalIssued: 302000,
  totalActive: 126000,
  totalSpend: 29100000000,
  feeRevenue: 456000000,
};

// QR Payments
const QR_DATA = {
  merchants: 45000,
  dailyTransactions: 234000,
  dailyVolume: 1890000000,
  avgTicket: 8076,
  types: [
    { type: "Static QR (Merchant-Presented)", share: 45 },
    { type: "Dynamic QR (Amount-Encoded)", share: 35 },
    { type: "Customer-Presented QR", share: 20 },
  ],
  topMerchants: [
    { name: "Shoprite Nigeria", txns: 12000, volume: 890000000 },
    { name: "Chicken Republic", txns: 8900, volume: 234000000 },
    { name: "Sweet Sensation", txns: 7600, volume: 189000000 },
    { name: "PEP Stores", txns: 6700, volume: 345000000 },
    { name: "Spar Nigeria", txns: 5400, volume: 456000000 },
  ],
};

// BNPL
const BNPL_DATA = {
  products: [
    { name: "Pay-in-4 (0% Interest)", active: 23000, portfolio: 4500000000, default_rate: 2.1 },
    { name: "Pay Monthly (3-month)", active: 12000, portfolio: 3200000000, default_rate: 3.4 },
    { name: "Pay Monthly (6-month)", active: 8000, portfolio: 2800000000, default_rate: 4.2 },
    { name: "Pay Monthly (12-month)", active: 5000, portfolio: 2100000000, default_rate: 5.1 },
  ],
  totalPortfolio: 12600000000,
  activeBorrowers: 48000,
  avgApprovalTime: "30s",
  merchantPartners: 890,
};

// Investment Marketplace
const INVESTMENT_DATA = {
  products: [
    { name: "Treasury Bills", aum: 45000000000, investors: 34000, yield: "14.5% pa", tenor: "91-364 days" },
    { name: "Mutual Funds", aum: 23000000000, investors: 18000, yield: "12-25% pa", tenor: "Open-ended" },
    { name: "Dollar Investments", aum: 12000000000, investors: 9000, yield: "5-8% pa", tenor: "30-180 days" },
    { name: "Stocks (NGX)", aum: 8000000000, investors: 6500, yield: "Variable", tenor: "Open-ended" },
  ],
  totalAUM: 88000000000,
  totalInvestors: 67500,
  monthlyInflow: 5600000000,
};

// Remittances
const REMITTANCE_DATA = {
  corridors: [
    { corridor: "UK → Nigeria", volume: 890000000, txns: 12000, avgAmount: 74167, speed: "<15min" },
    { corridor: "USA → Nigeria", volume: 1200000000, txns: 15000, avgAmount: 80000, speed: "<30min" },
    { corridor: "Canada → Nigeria", volume: 340000000, txns: 4500, avgAmount: 75556, speed: "<30min" },
    { corridor: "Nigeria → Ghana", volume: 120000000, txns: 3400, avgAmount: 35294, speed: "<10min" },
    { corridor: "Nigeria → Kenya", volume: 89000000, txns: 2100, avgAmount: 42381, speed: "<10min" },
  ],
  monthlyVolume: 2639000000,
  partnerCount: 12,
  avgFee: "1.2%",
};

// Gamification
const GAMIFICATION_DATA = {
  tiers: [
    { tier: "Bronze", users: 120000, color: "bg-amber-700" },
    { tier: "Silver", users: 67000, color: "bg-gray-400" },
    { tier: "Gold", users: 23000, color: "bg-yellow-500" },
    { tier: "Platinum", users: 5400, color: "bg-purple-600" },
  ],
  totalPoints: 45000000000,
  activeUsers: 215400,
  avgDailyActive: 89000,
  streakUsers: 34000,
  metrics: { engagement: "+40% DAU", retention: "-25% dormancy", crossSell: "+30%", referrals: "10x" },
};

function formatNaira(n: number): string {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `₦${(n / 1e3).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}

function formatNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function StatCard({ title, value, subtitle, icon: Icon, trend, color }: any) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color || "bg-primary/10"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="flex items-center mt-2 text-xs">
            {trend > 0 ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
            <span className={trend > 0 ? "text-green-500" : "text-red-500"}>{Math.abs(trend)}% vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GrowthFeaturesWorkspace() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-purple-600" />
            Growth Features Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enhancements 13-20 — Chatbot, Smart Savings, Virtual Cards, QR, BNPL, Investments, Remittances, Gamification
          </p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">ALL LIVE</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 lg:grid-cols-9 h-auto">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="chatbot" className="text-xs">Chatbot</TabsTrigger>
          <TabsTrigger value="savings" className="text-xs">Savings</TabsTrigger>
          <TabsTrigger value="cards" className="text-xs">Cards</TabsTrigger>
          <TabsTrigger value="qr" className="text-xs">QR Pay</TabsTrigger>
          <TabsTrigger value="bnpl" className="text-xs">BNPL</TabsTrigger>
          <TabsTrigger value="invest" className="text-xs">Invest</TabsTrigger>
          <TabsTrigger value="remit" className="text-xs">Remit</TabsTrigger>
          <TabsTrigger value="rewards" className="text-xs">Rewards</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="AI Chatbot Sessions" value={formatNumber(CHATBOT_DATA.totalSessions)} subtitle="Monthly sessions" icon={MessageSquare} trend={18} color="bg-purple-100" />
            <StatCard title="Smart Savings AUM" value={formatNaira(SAVINGS_DATA.totalBalance)} subtitle={`${formatNumber(SAVINGS_DATA.totalUsers)} savers`} icon={PiggyBank} trend={12.3} color="bg-green-100" />
            <StatCard title="Virtual Cards Issued" value={formatNumber(CARDS_DATA.totalIssued)} subtitle={`${formatNumber(CARDS_DATA.totalActive)} active`} icon={CreditCard} trend={22} color="bg-blue-100" />
            <StatCard title="QR Daily Volume" value={formatNaira(QR_DATA.dailyVolume)} subtitle={`${formatNumber(QR_DATA.dailyTransactions)} txns/day`} icon={QrCode} trend={35} color="bg-violet-100" />
            <StatCard title="BNPL Portfolio" value={formatNaira(BNPL_DATA.totalPortfolio)} subtitle={`${formatNumber(BNPL_DATA.activeBorrowers)} borrowers`} icon={ShoppingCart} trend={28} color="bg-orange-100" />
            <StatCard title="Investment AUM" value={formatNaira(INVESTMENT_DATA.totalAUM)} subtitle={`${formatNumber(INVESTMENT_DATA.totalInvestors)} investors`} icon={TrendingUp} trend={15} color="bg-emerald-100" />
            <StatCard title="Remittance Volume" value={formatNaira(REMITTANCE_DATA.monthlyVolume)} subtitle={`${REMITTANCE_DATA.corridors.length} corridors`} icon={Send} trend={8} color="bg-cyan-100" />
            <StatCard title="Rewards Users" value={formatNumber(GAMIFICATION_DATA.activeUsers)} subtitle={`${formatNumber(GAMIFICATION_DATA.totalPoints)} pts issued`} icon={Trophy} trend={40} color="bg-amber-100" />
          </div>

          {/* Revenue impact summary */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Growth Revenue Impact (Monthly)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { feature: "Virtual Card Fees", revenue: 456000000 },
                  { feature: "BNPL Interest/Fees", revenue: 380000000 },
                  { feature: "Investment Fees", revenue: 220000000 },
                  { feature: "Remittance Fees", revenue: 190000000 },
                  { feature: "QR Merchant Fees", revenue: 145000000 },
                  { feature: "Savings Interest Margin", revenue: 420000000 },
                  { feature: "Chatbot Cost Savings", revenue: 350000000 },
                  { feature: "Gamification Cross-Sell", revenue: 280000000 },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{item.feature}</p>
                    <p className="text-lg font-bold text-green-600">{formatNaira(item.revenue)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium">Total Monthly Growth Revenue</p>
                <p className="text-3xl font-bold text-green-600">₦2.44B/month</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CHATBOT TAB */}
        <TabsContent value="chatbot" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Sessions" value={formatNumber(CHATBOT_DATA.totalSessions)} icon={MessageSquare} color="bg-purple-100" />
            <StatCard title="Avg Resolution" value={CHATBOT_DATA.avgResolutionTime} icon={Activity} color="bg-blue-100" />
            <StatCard title="Cost Savings" value={formatNaira(CHATBOT_DATA.costSavings)} subtitle="vs call center" icon={DollarSign} color="bg-green-100" />
            <StatCard title="Channels" value="4" subtitle="WhatsApp, Telegram, App, USSD" icon={Smartphone} color="bg-violet-100" />
          </div>
          <Card>
            <CardHeader><CardTitle>Channel Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {CHATBOT_DATA.channels.map((ch, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{ch.icon}</span>
                      <div>
                        <p className="font-medium">{ch.name}</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(ch.users)} users · {formatNumber(ch.sessions)} sessions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{ch.satisfaction}%</p>
                      <p className="text-xs text-muted-foreground">satisfaction</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Intent Recognition Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Intent</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-right p-2">Confidence</th>
                      <th className="text-right p-2">Responses</th>
                      <th className="text-right p-2">Escalation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHATBOT_DATA.intents.map((intent, i) => (
                      <tr key={i} className="border-b border-muted">
                        <td className="p-2 font-medium">{intent.intent}</td>
                        <td className="p-2"><Badge variant="outline">{intent.category}</Badge></td>
                        <td className="p-2 text-right">
                          <span className={intent.confidence >= 0.93 ? "text-green-600" : intent.confidence >= 0.89 ? "text-yellow-600" : "text-red-600"}>
                            {(intent.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-2 text-right">{formatNumber(intent.responses)}</td>
                        <td className="p-2 text-right">{(intent.escalation * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SAVINGS TAB */}
        <TabsContent value="savings" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total AUM" value={formatNaira(SAVINGS_DATA.totalBalance)} icon={PiggyBank} trend={12.3} color="bg-green-100" />
            <StatCard title="Active Savers" value={formatNumber(SAVINGS_DATA.totalUsers)} icon={Users} color="bg-blue-100" />
            <StatCard title="Avg Interest Rate" value={`${SAVINGS_DATA.avgInterestRate}% pa`} icon={TrendingUp} color="bg-purple-100" />
            <StatCard title="Monthly Growth" value={`+${SAVINGS_DATA.monthlyGrowth}%`} icon={ArrowUpRight} color="bg-emerald-100" />
          </div>
          <Card>
            <CardHeader><CardTitle>Savings Products</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {SAVINGS_DATA.products.map((p, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(p.users)} users · Avg goal: {formatNaira(p.avgGoal)}</p>
                      </div>
                      <p className="font-bold">{formatNaira(p.balance)}</p>
                    </div>
                    <Progress value={(p.balance / SAVINGS_DATA.totalBalance) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VIRTUAL CARDS TAB */}
        <TabsContent value="cards" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Issued" value={formatNumber(CARDS_DATA.totalIssued)} icon={CreditCard} trend={22} color="bg-blue-100" />
            <StatCard title="Active Cards" value={formatNumber(CARDS_DATA.totalActive)} icon={CreditCard} color="bg-green-100" />
            <StatCard title="Total Spend" value={formatNaira(CARDS_DATA.totalSpend)} icon={DollarSign} color="bg-purple-100" />
            <StatCard title="Fee Revenue" value={formatNaira(CARDS_DATA.feeRevenue)} icon={TrendingUp} color="bg-amber-100" />
          </div>
          <Card>
            <CardHeader><CardTitle>Card Types</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CARDS_DATA.types.map((c, i) => (
                  <div key={i} className="p-4 rounded-lg border bg-card">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">{c.type}</p>
                        <p className="text-xs text-muted-foreground mt-1">Issuance: {c.issuanceTime}</p>
                      </div>
                      <Badge variant={c.active > 0 ? "default" : "secondary"}>{c.active > 0 ? "Active" : "Single-Use"}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div><p className="text-xs text-muted-foreground">Issued</p><p className="font-bold">{formatNumber(c.issued)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Active</p><p className="font-bold">{formatNumber(c.active)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Spend</p><p className="font-bold">{formatNaira(c.spend)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QR PAYMENTS TAB */}
        <TabsContent value="qr" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Merchants" value={formatNumber(QR_DATA.merchants)} icon={QrCode} trend={35} color="bg-violet-100" />
            <StatCard title="Daily Transactions" value={formatNumber(QR_DATA.dailyTransactions)} icon={Activity} color="bg-blue-100" />
            <StatCard title="Daily Volume" value={formatNaira(QR_DATA.dailyVolume)} icon={DollarSign} color="bg-green-100" />
            <StatCard title="Avg Ticket" value={formatNaira(QR_DATA.avgTicket)} icon={ShoppingCart} color="bg-amber-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>QR Type Distribution</CardTitle></CardHeader>
              <CardContent>
                {QR_DATA.types.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                    <span className="text-sm">{t.type}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={t.share} className="w-24 h-2" />
                      <span className="text-sm font-bold w-10 text-right">{t.share}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Merchants</CardTitle></CardHeader>
              <CardContent>
                {QR_DATA.topMerchants.map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(m.txns)} txns/day</p>
                    </div>
                    <p className="text-sm font-bold">{formatNaira(m.volume)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* BNPL TAB */}
        <TabsContent value="bnpl" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Portfolio" value={formatNaira(BNPL_DATA.totalPortfolio)} icon={ShoppingCart} trend={28} color="bg-orange-100" />
            <StatCard title="Active Borrowers" value={formatNumber(BNPL_DATA.activeBorrowers)} icon={Users} color="bg-blue-100" />
            <StatCard title="Approval Time" value={BNPL_DATA.avgApprovalTime} subtitle="AI-powered" icon={Zap} color="bg-purple-100" />
            <StatCard title="Merchant Partners" value={BNPL_DATA.merchantPartners.toString()} icon={ShoppingCart} color="bg-green-100" />
          </div>
          <Card>
            <CardHeader><CardTitle>BNPL Products</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Active</th>
                    <th className="text-right p-2">Portfolio</th>
                    <th className="text-right p-2">Default Rate</th>
                  </tr></thead>
                  <tbody>
                    {BNPL_DATA.products.map((p, i) => (
                      <tr key={i} className="border-b border-muted">
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2 text-right">{formatNumber(p.active)}</td>
                        <td className="p-2 text-right font-bold">{formatNaira(p.portfolio)}</td>
                        <td className="p-2 text-right"><Badge variant={p.default_rate < 3 ? "default" : p.default_rate < 5 ? "secondary" : "destructive"}>{p.default_rate}%</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVESTMENTS TAB */}
        <TabsContent value="invest" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total AUM" value={formatNaira(INVESTMENT_DATA.totalAUM)} icon={TrendingUp} trend={15} color="bg-emerald-100" />
            <StatCard title="Investors" value={formatNumber(INVESTMENT_DATA.totalInvestors)} icon={Users} color="bg-blue-100" />
            <StatCard title="Monthly Inflow" value={formatNaira(INVESTMENT_DATA.monthlyInflow)} icon={ArrowUpRight} color="bg-green-100" />
            <StatCard title="Products" value="4" subtitle="T-Bills, Funds, Dollar, Stocks" icon={Globe} color="bg-purple-100" />
          </div>
          <Card>
            <CardHeader><CardTitle>Investment Products</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {INVESTMENT_DATA.products.map((p, i) => (
                  <div key={i} className="p-4 rounded-lg border">
                    <p className="font-bold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.tenor} · {p.yield}</p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div><p className="text-xs text-muted-foreground">AUM</p><p className="font-bold text-green-600">{formatNaira(p.aum)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Investors</p><p className="font-bold">{formatNumber(p.investors)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REMITTANCES TAB */}
        <TabsContent value="remit" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Monthly Volume" value={formatNaira(REMITTANCE_DATA.monthlyVolume)} icon={Send} trend={8} color="bg-cyan-100" />
            <StatCard title="Active Corridors" value={REMITTANCE_DATA.corridors.length.toString()} icon={Globe} color="bg-blue-100" />
            <StatCard title="Partners" value={REMITTANCE_DATA.partnerCount.toString()} icon={Users} color="bg-purple-100" />
            <StatCard title="Avg Fee" value={REMITTANCE_DATA.avgFee} subtitle="of send amount" icon={DollarSign} color="bg-green-100" />
          </div>
          <Card>
            <CardHeader><CardTitle>Corridor Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left p-2">Corridor</th>
                    <th className="text-right p-2">Volume</th>
                    <th className="text-right p-2">Transactions</th>
                    <th className="text-right p-2">Avg Amount</th>
                    <th className="text-right p-2">Speed</th>
                  </tr></thead>
                  <tbody>
                    {REMITTANCE_DATA.corridors.map((c, i) => (
                      <tr key={i} className="border-b border-muted">
                        <td className="p-2 font-medium">{c.corridor}</td>
                        <td className="p-2 text-right font-bold">{formatNaira(c.volume)}</td>
                        <td className="p-2 text-right">{formatNumber(c.txns)}</td>
                        <td className="p-2 text-right">{formatNaira(c.avgAmount)}</td>
                        <td className="p-2 text-right"><Badge variant="outline" className="text-green-600">{c.speed}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GAMIFICATION TAB */}
        <TabsContent value="rewards" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Active Users" value={formatNumber(GAMIFICATION_DATA.activeUsers)} icon={Trophy} trend={40} color="bg-amber-100" />
            <StatCard title="Points Issued" value={formatNumber(GAMIFICATION_DATA.totalPoints)} icon={Zap} color="bg-yellow-100" />
            <StatCard title="Daily Active" value={formatNumber(GAMIFICATION_DATA.avgDailyActive)} icon={Activity} color="bg-green-100" />
            <StatCard title="Streak Users" value={formatNumber(GAMIFICATION_DATA.streakUsers)} icon={Trophy} color="bg-purple-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Tier Distribution</CardTitle></CardHeader>
              <CardContent>
                {GAMIFICATION_DATA.tiers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${t.color}`}></div>
                      <span className="font-medium">{t.tier}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={(t.users / GAMIFICATION_DATA.activeUsers) * 100} className="w-24 h-2" />
                      <span className="text-sm font-bold w-16 text-right">{formatNumber(t.users)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Business Impact</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(GAMIFICATION_DATA.metrics).map(([key, value], i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                      <span className="font-bold text-green-600">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
