// Design philosophy: restored original banking PWA shell.
// This page keeps a compact mobile savings rhythm while grounding every visible figure
// in the active customer portfolio and workflow inventory.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, PiggyBank, Target, TrendingUp, Wallet } from "lucide-react";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
import { formatCurrency } from "@/lib/platform";
import {
  getCustomerDashboardPayload,
  type CustomerExperienceCustomer as CustomerRecord,
  type CustomerExperienceWorkflow as WorkflowCase,
} from "@/lib/customerExperienceData";

type SavingsGoalCard = {
  id: string;
  title: string;
  detail: string;
  amount: number;
  badge: string;
};

export default function CustomerSavings() {
  const { tenantConfiguration } = useCustomerSession();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowCase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const payload = await getCustomerDashboardPayload();
        if (!active) return;
        setCustomers(payload.customers);
        setWorkflows(payload.workflows);
      } catch (issue) {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : "Unable to load savings context.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const enabledFeatureKeys = new Set([
    ...(tenantConfiguration?.enabledModules ?? []),
    ...((tenantConfiguration?.featureFlags ?? []).filter((flag) => flag.enabled).map((flag) => flag.key)),
  ]);
  const savingsEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("savings");

  const totalBalance = useMemo(() => customers.reduce((sum, customer) => sum + customer.balance, 0), [customers]);
  const totalWorkflowAmount = useMemo(() => workflows.reduce((sum, workflow) => sum + workflow.amount, 0), [workflows]);
  const averageBalance = useMemo(() => (customers.length > 0 ? totalBalance / customers.length : 0), [customers.length, totalBalance]);

  const topContributors = useMemo(
    () => [...customers].sort((left, right) => right.balance - left.balance).slice(0, 3),
    [customers],
  );

  const savingsSignals = useMemo(
    () =>
      workflows
        .filter((workflow) => {
          const haystack = `${workflow.product} ${workflow.stage} ${workflow.nextAction} ${workflow.channel}`.toLowerCase();
          return ["loan", "savings", "deposit", "review", "approval", "collection", "settlement"].some((token) => haystack.includes(token));
        })
        .slice(0, 3),
    [workflows],
  );

  const goalCards = useMemo<SavingsGoalCard[]>(() => {
    const contributorCard: SavingsGoalCard = {
      id: "portfolio",
      title: "Platform reserve",
      detail:
        customers.length > 0
          ? `${customers.length} active customer balances are currently contributing to this reserve view.`
          : "No customer balances are currently available for the reserve view.",
      amount: totalBalance,
      badge: `${customers.length} contributors`,
    };

    const averageCard: SavingsGoalCard = {
      id: "average",
      title: "Average reserve per contributor",
      detail:
        customers.length > 0
          ? "A compact archive-style average view built from the live customer portfolio."
          : "Average reserve will appear once customer balances are available.",
      amount: averageBalance,
      badge: customers.length > 0 ? "Live portfolio" : "Awaiting balances",
    };

    const workflowCard: SavingsGoalCard = {
      id: "pipeline",
      title: "Workflow-linked savings pressure",
      detail:
        workflows.length > 0
          ? `${workflows.length} live workflow cases remain visible for contribution planning and servicing posture.`
          : "No active workflow cases are currently affecting savings contribution posture.",
      amount: totalWorkflowAmount,
      badge: workflows.length > 0 ? `${workflows.length} live cases` : "No active pipeline",
    };

    return [contributorCard, averageCard, workflowCard];
  }, [averageBalance, customers.length, totalBalance, totalWorkflowAmount, workflows.length]);

  const primaryColor = tenantConfiguration?.whiteLabel?.primaryColor ?? "#059669";
  const accentColor = tenantConfiguration?.whiteLabel?.accentColor ?? "#065f46";

  return (
    <div className="min-h-screen bg-stone-50 pb-28 text-stone-900 lg:pb-10">
      <header
        className="px-5 pb-7 pt-6 text-white"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)` }}
      >
        <div className="flex items-center gap-3">
          <Link href="/customer/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/70">
              {tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"} savings
            </p>
            <h1 className="text-xl font-semibold">Savings</h1>
            <p className="mt-1 text-xs text-white/80">
              {(tenantConfiguration?.onboardingStatus ?? "active").toLowerCase()} governance · support {tenantConfiguration?.whiteLabel?.supportEmail ?? "platform-operations@54bank.app"}
            </p>
          </div>
        </div>
      </header>

      <main className="space-y-5 px-4 py-5">
        {!savingsEnabled ? (
          <section className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Savings products are currently disabled for this tenant profile. Portfolio visibility remains available so customers can monitor previously created reserves while onboarding governance is completed.
          </section>
        ) : null}

        <section className="rounded-[1.9rem] bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">Portfolio reserve</p>
              <h2 className="mt-2 text-3xl font-semibold text-stone-900">{formatCurrency(totalBalance)}</h2>
              <p className="mt-2 text-sm text-stone-500">
                The savings surface now follows a tighter mobile rhythm while continuing to read from the active platform customer portfolio.
              </p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <PiggyBank size={22} />
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Goals", value: `${goalCards.length}`, icon: Target },
              { label: "Contributors", value: `${customers.length}`, icon: Wallet },
              { label: "Signals", value: `${workflows.length}`, icon: TrendingUp },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className="rounded-[1.3rem] bg-emerald-50 px-3 py-4">
                  <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                    <Icon size={17} />
                  </span>
                  <p className="mt-3 text-lg font-semibold text-stone-900">{metric.value}</p>
                  <p className="text-[11px] text-stone-500">{metric.label}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <article className="rounded-[1.5rem] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Saved posture</p>
            <p className="mt-3 text-2xl font-semibold text-stone-900">{formatCurrency(averageBalance)}</p>
            <p className="mt-2 text-xs text-stone-500">Average reserve per contributor based on the live customer portfolio.</p>
          </article>
          <article className="rounded-[1.5rem] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Workflow pressure</p>
            <p className="mt-3 text-2xl font-semibold text-stone-900">{formatCurrency(totalWorkflowAmount)}</p>
            <p className="mt-2 text-xs text-stone-500">Live workflow amounts remain visible here so savings planning reflects current servicing posture.</p>
          </article>
        </section>

        <section className="rounded-[1.4rem] bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          Enabled modules: {(tenantConfiguration?.enabledModules ?? []).join(", ") || "default runtime set"}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-stone-900">Savings goals</h3>
            <span className="text-xs text-stone-500">Runtime-backed</span>
          </div>
          <div className="space-y-3">
            {goalCards.map((goal) => (
              <article
                key={goal.id}
                className={`rounded-[1.6rem] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)] ${!savingsEnabled ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-stone-900">{goal.title}</h4>
                    <p className="mt-1 text-sm text-stone-500">{goal.detail}</p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-stone-600">{goal.badge}</span>
                </div>
                <div className="mt-4 rounded-[1.2rem] bg-emerald-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700">Runtime-derived value</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-950">{formatCurrency(goal.amount)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-stone-900">Contribution signals</h3>
            <span className="text-xs text-stone-500">Top live cues</span>
          </div>
          {savingsSignals.length > 0 ? (
            <div className="space-y-3">
              {savingsSignals.map((workflow) => (
                <article key={workflow.id} className="rounded-[1.2rem] bg-stone-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-stone-900">{workflow.product}</p>
                      <p className="mt-1 text-sm text-stone-500">{workflow.customer} · {workflow.nextAction}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-stone-600">{workflow.stage}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                    <span>{workflow.channel}</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(workflow.amount)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.2rem] bg-stone-50 px-4 py-5 text-sm text-stone-500">
              No live contribution signals are currently available. The compact archive-style shell remains ready for savings workflows as they load.
            </div>
          )}
        </section>

        <section className="rounded-[1.6rem] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-stone-900">Top contributors</h3>
            <span className="text-xs text-stone-500">Portfolio view</span>
          </div>
          {topContributors.length > 0 ? (
            <div className="space-y-3">
              {topContributors.map((customer) => (
                <article key={customer.id} className="flex items-center justify-between rounded-[1.2rem] bg-stone-50 px-4 py-3">
                  <div>
                    <p className="font-medium text-stone-900">{customer.name}</p>
                    <p className="mt-1 text-sm text-stone-500">{customer.segment} · {customer.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-stone-900">{formatCurrency(customer.balance)}</p>
                    <p className="mt-1 text-xs text-stone-500">{customer.status}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.2rem] bg-stone-50 px-4 py-5 text-sm text-stone-500">
              No contributor balances are currently available.
            </div>
          )}
        </section>

        {error ? <div className="rounded-[1.4rem] bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      </main>

      <CustomerBottomNav />
    </div>
  );
}
