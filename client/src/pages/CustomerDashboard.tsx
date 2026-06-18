// Design philosophy: extracted mobile-first customer dashboard as canonical base.
// This rewrite restores the simpler archive rhythm: gradient header, total-balance card,
// compact quick actions, promo banner, recent transactions, and the anchored mobile bottom nav.
// Active-platform data is retained only where it can supply the recovered layout without distorting it.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Bell, Eye, EyeOff, Palette, User } from "lucide-react";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
import {
  formatCurrency,
  formatRelativeIso,
  getCustomerStatements,
  getCustomerTransfers,
  type CustomerStatementRecord,
  type CustomerTransferRecord,
} from "@/lib/platform";

const quickActions = [
  { id: "1", icon: "↗️", label: "Transfer", path: "/customer/transfers", feature: "transfers" },
  { id: "2", icon: "📄", label: "Pay Bills", path: "/customer/bills", feature: "bills" },
  { id: "3", icon: "💳", label: "Cards", path: "/customer/cards", feature: "cards" },
  { id: "4", icon: "💰", label: "Savings", path: "/customer/savings", feature: "savings" },
  { id: "5", icon: "📊", label: "Loans", path: "/customer/loans", feature: "loans" },
  { id: "6", icon: "🛡️", label: "Alerts", path: "/customer/notifications", feature: "notifications" },
  { id: "7", icon: "📱", label: "Statements", path: "/customer/statements", feature: "statements" },
  { id: "8", icon: "📷", label: "Scan", path: "/customer/qr", feature: "qr" },
] as const;

function directionTone(direction: string) {
  return direction === "credit" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600";
}

function directionSymbol(direction: string) {
  return direction === "credit" ? "↓" : "↑";
}

export default function CustomerDashboard() {
  const { activeCustomer, customers, unreadNotifications, loading, error, tenantConfiguration } = useCustomerSession();
  const [showBalance, setShowBalance] = useState(true);
  const [statements, setStatements] = useState<CustomerStatementRecord[]>([]);
  const [transfers, setTransfers] = useState<CustomerTransferRecord[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  const reserveCustomer = customers.find((customer) => customer.id !== activeCustomer?.id) ?? null;

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        if (!activeCustomer?.id) return;
        const [statementResponse, transferResponse] = await Promise.all([
          getCustomerStatements(activeCustomer.id),
          getCustomerTransfers(activeCustomer.id),
        ]);
        if (!active) return;
        setStatements(statementResponse.items);
        setTransfers(transferResponse.items);
        setActivityError(null);
      } catch {
        if (!active) return;
        setActivityError("Recent customer activity is temporarily unavailable.");
      }
    })();

    return () => {
      active = false;
    };
  }, [activeCustomer?.id]);

  const accountCards = useMemo(
    () =>
      [
        activeCustomer
          ? { id: activeCustomer.id, name: "Main Account", balance: activeCustomer.balance ?? 0 }
          : null,
        reserveCustomer
          ? { id: reserveCustomer.id, name: "Savings Account", balance: reserveCustomer.balance ?? 0 }
          : null,
      ].filter(Boolean) as Array<{ id: string; name: string; balance: number }>,
    [activeCustomer, reserveCustomer],
  );

  const totalBalance = accountCards.reduce((sum, account) => sum + account.balance, 0);
  const enabledFeatureKeys = useMemo(() => {
    const configuredFlags = tenantConfiguration?.featureFlags ?? [];
    const enabledFlags = configuredFlags.filter((flag) => flag.enabled).map((flag) => flag.key);
    return new Set([...(tenantConfiguration?.enabledModules ?? []), ...enabledFlags]);
  }, [tenantConfiguration]);

  const visibleQuickActions = useMemo(
    () => quickActions.filter((action) => enabledFeatureKeys.size === 0 || enabledFeatureKeys.has(action.feature)),
    [enabledFeatureKeys],
  );

  const recentTransactions = useMemo(() => {
    const statementRows = statements.map((row) => ({
      id: row.id,
      title: row.title,
      date: formatRelativeIso(row.timestamp),
      amount: row.amount,
      direction: row.direction,
      timestamp: row.timestamp,
    }));

    const transferRows = transfers.map((transfer) => ({
      id: `transfer-${transfer.id}`,
      title: transfer.beneficiaryName,
      date: formatRelativeIso(transfer.confirmedAt ?? transfer.createdAt),
      amount: transfer.amount,
      direction: "debit" as const,
      timestamp: transfer.confirmedAt ?? transfer.createdAt,
    }));

    return [...statementRows, ...transferRows]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 5);
  }, [statements, transfers]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      <div className="mx-auto w-full max-w-md bg-slate-50 shadow-none lg:mt-6 lg:max-w-xl lg:overflow-hidden lg:rounded-[2rem] lg:shadow-[0_18px_60px_rgba(15,23,42,0.10)]">
        <header
          className="rounded-b-[2rem] p-6 text-white"
          style={{
            background: `linear-gradient(135deg, ${tenantConfiguration?.whiteLabel?.primaryColor ?? "#059669"} 0%, ${tenantConfiguration?.whiteLabel?.accentColor ?? "#065f46"} 100%)`,
          }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Welcome back,</p>
              <h1 className="text-xl font-bold">{activeCustomer?.name ?? tenantConfiguration?.whiteLabel?.displayName ?? "54Bank Customer"}</h1>
              <p className="mt-1 text-xs text-white/75">{tenantConfiguration?.whiteLabel?.loginHeadline ?? "Tenant-aware banking shell active for customer workflows."}</p>
            </div>
            <div className="flex gap-3">
              <Link href="/customer/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Bell size={18} />
                {unreadNotifications ? <span className="absolute -right-1 -top-1 rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-950">{unreadNotifications}</span> : null}
              </Link>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <User size={18} />
              </div>
            </div>
          </div>

          <section className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-white/80">Total Balance</span>
              <button type="button" onClick={() => setShowBalance((current) => !current)} className="text-white/80 transition hover:text-white">
                {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <h2 className="mb-4 text-3xl font-bold">{showBalance ? formatCurrency(totalBalance) : "••••••••"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {accountCards.length ? (
                accountCards.map((account) => (
                  <article key={account.id} className="rounded-xl bg-white/10 p-3">
                    <p className="text-xs text-white/70">{account.name}</p>
                    <p className="mt-2 font-semibold">{showBalance ? formatCurrency(account.balance) : "••••••••"}</p>
                  </article>
                ))
              ) : (
                <article className="rounded-xl bg-white/10 p-3 text-sm text-white/75">Customer balances will appear here once the session finishes loading.</article>
              )}
            </div>
          </section>
        </header>

        <main className="px-4 pb-8">
          <section className="-mt-4 rounded-2xl bg-white p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-3 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">{tenantConfiguration?.name ?? "Tenant workspace"}</p>
                <p className="text-xs text-slate-500">{tenantConfiguration?.region ?? "Multi-region"} · {tenantConfiguration?.onboardingStatus ?? "active"} onboarding</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Palette size={14} />
                {tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {visibleQuickActions.map((action) => (
                <Link key={action.id} href={action.path} className="flex flex-col items-center gap-2 rounded-xl p-2 text-center transition-colors hover:bg-slate-50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl">{action.icon}</div>
                  <span className="text-xs text-slate-600">{action.label}</span>
                </Link>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {tenantConfiguration?.whiteLabel?.supportEmail ?? "platform-operations@54bank.app"} · {((tenantConfiguration?.featureFlags ?? []).filter((flag) => flag.enabled).slice(0, 2).map((flag) => flag.label).join(" · ")) || "feature-aware onboarding"}
            </p>
          </section>

          <section className="mt-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold">Get 5% Cashback</h3>
                <p className="text-sm text-white/80">{tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"} bill-pay activation offer</p>
              </div>
              <Link href="/customer/bills" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-orange-600">
                Claim Now
              </Link>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Recent Transactions</h3>
              <Link href="/customer/statements" className="text-sm font-medium text-emerald-700">
                View All
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {loading ? (
                <div className="p-4 text-sm text-slate-500">Loading customer activity…</div>
              ) : error || activityError ? (
                <div className="p-4 text-sm text-amber-700">{error ?? activityError}</div>
              ) : recentTransactions.length ? (
                recentTransactions.map((tx, index) => (
                  <div key={tx.id} className={`flex items-center gap-4 p-4 ${index !== recentTransactions.length - 1 ? "border-b border-slate-100" : ""}`}>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${directionTone(tx.direction)}`}>
                      <span>{directionSymbol(tx.direction)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{tx.title}</p>
                      <p className="text-xs text-slate-500">{tx.date}</p>
                    </div>
                    <p className={`font-semibold ${tx.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.direction === "credit" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-sm text-slate-500">No transactions are visible yet for this session.</div>
              )}
            </div>
          </section>
        </main>
      </div>

      <CustomerBottomNav />
    </div>
  );
}
