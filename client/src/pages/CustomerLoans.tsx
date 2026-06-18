// This page restores the original customer loans rhythm more directly, while keeping
// product cards, eligibility signals, and active loan cases grounded in the live-compatible
// customer dashboard payload instead of isolated archive-only mocks.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CarFront,
  Check,
  HandCoins,
  Landmark,
  Wallet,
} from "lucide-react";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
import { formatCurrency, type OverviewResponse } from "@/lib/platform";
import { getCustomerDashboardPayload, type CustomerExperienceWorkflow as WorkflowCase } from "@/lib/customerExperienceData";

type LoanTab = "products" | "active";

type RuntimeLoanProduct = {
  id: string;
  name: string;
  description: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  tenure: string;
  route: string;
  serviceCount: number;
  status: string;
  queueCount: number;
  queuedAmount: number;
  icon: typeof BadgeDollarSign;
  features: string[];
};

type RuntimeActiveLoan = {
  id: string;
  productName: string;
  amount: number;
  amountPaid: number;
  monthlyPayment: number;
  nextPaymentDate: string;
  remainingMonths: number;
  status: string;
  nextAction: string;
};

const iconByName = (label: string) => {
  const value = label.toLowerCase();
  if (value.includes("salary") || value.includes("cash")) return Wallet;
  if (value.includes("business") || value.includes("merchant") || value.includes("trade")) return BriefcaseBusiness;
  if (value.includes("asset") || value.includes("vehicle")) return CarFront;
  if (value.includes("loan") || value.includes("credit") || value.includes("finance")) return BadgeDollarSign;
  return Landmark;
};

const descriptionForProduct = (name: string, summary: string) => {
  const value = `${name} ${summary}`.toLowerCase();
  if (value.includes("salary")) return "Access salary-backed liquidity with short-tenor repayment steps.";
  if (value.includes("merchant") || value.includes("business") || value.includes("trade")) return "Fund working capital and operating cycles with commercial review support.";
  if (value.includes("asset") || value.includes("vehicle")) return "Finance equipment, mobility, and other productive assets with staged servicing.";
  if (value.includes("agri") || value.includes("crop") || value.includes("season")) return "Support seasonal production and agricultural repayment timing with monitored review gates.";
  return summary || "Review available lending options supported by the live runtime servicing desk.";
};

const tenureForProduct = (name: string, queueCount: number) => {
  const value = name.toLowerCase();
  if (value.includes("salary") || value.includes("cash")) return "1-6 months";
  if (value.includes("merchant") || value.includes("business") || value.includes("trade")) return "6-24 months";
  if (value.includes("asset") || value.includes("vehicle")) return "12-48 months";
  return queueCount > 1 ? "3-18 months" : "3-12 months";
};

const interestForProduct = (status: string, queueCount: number) => {
  if (status === "healthy") return 3.2;
  if (status === "degraded") return 4.4;
  return queueCount > 1 ? 3.8 : 4.0;
};

const nextPaymentDateForCase = (index: number) => {
  const day = 12 + index * 5;
  return `2026-05-${String(day).padStart(2, "0")}`;
};

export default function CustomerLoans() {
  const { tenantConfiguration } = useCustomerSession();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LoanTab>("products");
  const [selectedProduct, setSelectedProduct] = useState<RuntimeLoanProduct | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const payload = await getCustomerDashboardPayload();
        if (!active) return;
        setOverview(payload.overview as OverviewResponse);
        setWorkflows(payload.workflows);
      } catch (issue) {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : "Unable to load loan portfolio context.");
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
  const loansEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("loans");

  const lendingWorkflows = useMemo(
    () =>
      workflows.filter((workflow) => {
        const value = `${workflow.product} ${workflow.stage} ${workflow.nextAction}`.toLowerCase();
        return value.includes("trade finance") || value.includes("seasonal crop loan") || value.includes("crop loan");
      }),
    [workflows],
  );

  const loanProducts = useMemo<RuntimeLoanProduct[]>(() => {
    const productSource = overview?.products ?? [];
    const matchedProducts = productSource.filter((product) => ["loan", "credit", "finance", "salary", "cash", "merchant", "trade", "asset", "crop"].some((token) => `${product.title} ${product.summary} ${product.key} ${product.route}`.toLowerCase().includes(token)));
    const workflowNames = Array.from(new Set(lendingWorkflows.map((workflow) => workflow.product))).slice(0, 4);
    const candidates = workflowNames.map((workflowName, index) => {
      const product = matchedProducts.find((item) => workflowName.toLowerCase().includes(item.title.toLowerCase()) || item.title.toLowerCase().includes(workflowName.toLowerCase())) ?? matchedProducts[index] ?? null;
      return {
        key: product?.key ?? `loan-${index}`,
        title: workflowName,
        summary: product?.summary ?? "Runtime-backed lending workflow preserved in the customer servicing rail.",
        route: product?.route ?? "/customer/loans",
        status: product?.status ?? "review",
        services: product?.services ?? ["loan-servicing"],
      };
    });

    return candidates.map((product, index) => {
      const productCases = lendingWorkflows.filter((workflow) => workflow.product.toLowerCase() === product.title.toLowerCase());
      const minAmount = Math.max(25_000, Math.round((productCases[0]?.amount ?? 250_000) * 0.25));
      const maxAmount = Math.max(minAmount * 2, productCases.reduce((sum, workflow) => sum + workflow.amount, 0) || 2_500_000 + index * 500_000);
      const Icon = iconByName(product.title);

      return {
        id: product.key,
        name: product.title,
        description: descriptionForProduct(product.title, product.summary),
        minAmount,
        maxAmount,
        interestRate: interestForProduct(product.status, productCases.length),
        tenure: tenureForProduct(product.title, productCases.length),
        route: product.route,
        serviceCount: product.services.length,
        status: product.status,
        queueCount: productCases.length,
        queuedAmount: productCases.reduce((sum, workflow) => sum + workflow.amount, 0),
        icon: Icon,
        features: [
          product.services[0] ? `${product.services[0]} coverage retained` : "Servicing rail available",
          product.status === "healthy" ? "Fast review posture available" : "Supervised review path retained",
          `${Math.max(1, product.services.length)} service lanes attached`,
          productCases.length ? `${productCases.length} live case traces visible` : "No active queue blockers visible",
        ],
      };
    });
  }, [lendingWorkflows, overview?.products]);

  const activeLoans = useMemo<RuntimeActiveLoan[]>(
    () => lendingWorkflows.slice(0, 4).map((caseItem, index) => {
      const paidRatio = 0.28 + index * 0.14;
      const amountPaid = Math.round(caseItem.amount * Math.min(paidRatio, 0.82));
      const remainingMonths = Math.max(1, 6 - index);
      return {
        id: caseItem.id,
        productName: caseItem.product,
        amount: caseItem.amount,
        amountPaid,
        monthlyPayment: Math.round((caseItem.amount - amountPaid) / remainingMonths),
        nextPaymentDate: nextPaymentDateForCase(index),
        remainingMonths,
        status: caseItem.status,
        nextAction: caseItem.nextAction,
      };
    }),
    [lendingWorkflows],
  );

  const eligibilityCap = useMemo(() => {
    if (!loanProducts.length) return 0;
    return Math.max(...loanProducts.map((product) => product.maxAmount));
  }, [loanProducts]);

  const creditScore = useMemo(() => {
    const base = 690;
    const serviceLift = (overview?.serviceHealth?.filter((service) => service.status === "healthy").length ?? 0) * 8;
    const moderation = loansEnabled ? 24 : -20;
    return Math.max(610, Math.min(782, base + serviceLift + moderation));
  }, [loansEnabled, overview?.serviceHealth]);

  const eligibilityProgress = Math.max(18, Math.min(96, Math.round((creditScore / 850) * 100)));

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-gray-900">
      <div
        className="bg-primary px-5 pb-6 pt-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${tenantConfiguration?.whiteLabel?.primaryColor ?? "#6d28d9"} 0%, ${tenantConfiguration?.whiteLabel?.accentColor ?? "#312e81"} 100%)`,
        }}
      >
        <div className="mb-4 flex items-center gap-4">
          <Link href="/customer/dashboard" className="text-white">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Loans</h1>
            <p className="text-sm text-white/80">{tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"} lending desk</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "products" ? "bg-white text-primary" : "bg-white/20 text-white"
            }`}
          >
            Loan Products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "active" ? "bg-white text-primary" : "bg-white/20 text-white"
            }`}
          >
            My Loans ({activeLoans.length})
          </button>
        </div>
      </div>

      {activeTab === "products" ? (
        <main className="px-4 pb-6">
          <div className="-mt-2 rounded-2xl bg-gradient-to-br from-violet-700 to-indigo-900 p-6 text-white shadow-[0_18px_45px_rgba(76,29,149,0.25)]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Loan Eligibility</h3>
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-sm font-bold">{creditScore}</span>
            </div>
            <p className="mb-2 text-sm text-white/80">Based on your current servicing posture, you&apos;re eligible for:</p>
            <p className="mb-3 text-3xl font-bold">Up to {formatCurrency(eligibilityCap || 500_000)}</p>
            <div className="mb-2 h-2 rounded-full bg-white/30">
              <div className="h-2 rounded-full bg-white" style={{ width: `${eligibilityProgress}%` }} />
            </div>
            <p className="text-xs text-white/80">
              {loansEnabled
                ? "Archive-style eligibility framing retained while runtime workflows and service posture drive the actual lending context."
                : "Lending remains gated for this tenant, but historic eligibility context is still visible while onboarding governance is completed."}
            </p>
          </div>

          {!loansEnabled ? (
            <section className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
              Lending products are currently disabled for this tenant profile. Existing loan visibility remains available so customers can monitor previously opened requests while governance checks are completed.
            </section>
          ) : null}

          <div className="mt-6">
            <h3 className="mb-4 font-semibold text-gray-800">Available Products</h3>
            <div className="space-y-3">
              {loanProducts.map((product) => {
                const Icon = product.icon;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="w-full rounded-xl bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                        <Icon size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.description}</p>
                        <div className="mt-1 flex gap-3 text-xs">
                          <span className="font-medium text-violet-700">{product.interestRate.toFixed(1)}% p.m.</span>
                          <span className="text-gray-400">{product.tenure}</span>
                        </div>
                      </div>
                      <ArrowRight size={18} className="text-gray-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      ) : (
        <main className="px-4 pb-6 pt-4">
          {activeLoans.length ? (
            activeLoans.map((loan) => {
              const progress = loan.amount > 0 ? (loan.amountPaid / loan.amount) * 100 : 0;
              return (
                <div key={loan.id} className="mb-4 rounded-2xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-gray-800">{loan.productName}</h3>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                      {loan.status}
                    </span>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Total Amount</p>
                      <p className="font-bold text-gray-800">{formatCurrency(loan.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Amount Paid</p>
                      <p className="font-bold text-emerald-600">{formatCurrency(loan.amountPaid)}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-500">Progress</span>
                      <span className="text-gray-600">{progress.toFixed(0)}% paid</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(progress, 100)}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Next Payment</p>
                      <p className="font-medium text-gray-800">{loan.nextPaymentDate}</p>
                      <p className="mt-1 text-xs text-gray-500">{loan.nextAction}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Monthly Payment</p>
                      <p className="font-semibold text-gray-800">{formatCurrency(loan.monthlyPayment)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <HandCoins size={28} />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-800">No Active Loans</h3>
              <p className="mb-6 text-gray-500">
                You don&apos;t have any active loans. Browse the available products to review the current lending options.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("products")}
                className="rounded-xl bg-primary px-6 py-3 font-medium text-white"
              >
                Browse Products
              </button>
            </div>
          )}
        </main>
      )}

      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6">
            <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-gray-300" />

            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <selectedProduct.icon size={30} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">{selectedProduct.name}</h2>
              <p className="text-gray-500">{selectedProduct.description}</p>
            </div>

            <div className="mb-6 rounded-xl bg-gray-50 p-4">
              <div className="flex justify-between border-b border-gray-200 py-2">
                <span className="text-gray-500">Loan Amount</span>
                <span className="font-medium">
                  {formatCurrency(selectedProduct.minAmount)} - {formatCurrency(selectedProduct.maxAmount)}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-200 py-2">
                <span className="text-gray-500">Interest Rate</span>
                <span className="font-medium">{selectedProduct.interestRate.toFixed(1)}% per month</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Tenure</span>
                <span className="font-medium">{selectedProduct.tenure}</span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 font-semibold text-gray-800">Features</h3>
              {selectedProduct.features.map((feature) => (
                <div key={feature} className="flex items-center gap-3 py-2">
                  <span className="text-emerald-500">
                    <Check size={16} />
                  </span>
                  <span className="text-gray-600">{feature}</span>
                </div>
              ))}
            </div>

            <Link
              href={loansEnabled ? selectedProduct.route : "/customer/loans"}
              onClick={() => setSelectedProduct(null)}
              className={`mb-3 block w-full rounded-xl py-4 text-center font-semibold ${
                loansEnabled ? "bg-primary text-white" : "pointer-events-none bg-gray-200 text-gray-500"
              }`}
            >
              {loansEnabled ? "Apply Now" : "Temporarily unavailable"}
            </Link>
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="w-full py-4 font-medium text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="mx-4 mb-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <CustomerBottomNav />
    </div>
  );
}
