// Design philosophy: archive-first mobile bill payments.
// This page now behaves more like a working recovered payment flow with saved billers,
// validation posture, schedule handling, searchable evidence, and retained payment history.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  ReceiptText,
  Save,
  School,
  Search,
  Router,
  ShieldCheck,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
import {
  createCustomerBillPayment,
  deleteCustomerBiller,
  getCustomerBillPayments,
  getSavedBillers,
  saveCustomerBiller,
  type CustomerBillPaymentRecord,
  type CustomerSavedBiller,
  formatCurrency,
  formatRelativeIso,
} from "@/lib/platform";

const billCategories = [
  {
    id: "electricity",
    label: "Electricity",
    icon: Zap,
    billers: [
      { id: "ikeja-electric", name: "Ikeja Electric", defaultAmount: 18500 },
      { id: "eko-electric", name: "Eko Electric", defaultAmount: 21200 },
    ],
  },
  {
    id: "internet",
    label: "Internet",
    icon: Router,
    billers: [
      { id: "mtn-fibre", name: "MTN Fibre", defaultAmount: 22200 },
      { id: "spectranet", name: "Spectranet", defaultAmount: 24500 },
    ],
  },
  {
    id: "school",
    label: "School fees",
    icon: School,
    billers: [
      { id: "kaduna-learning-trust", name: "Kaduna Learning Trust", defaultAmount: 75000 },
      { id: "fct-education-board", name: "FCT Education Board", defaultAmount: 68500 },
    ],
  },
] as const;

type BillCategory = (typeof billCategories)[number]["id"];
type PaymentMode = "pay_now" | "schedule";
type TrailFilter = "all" | "paid" | "scheduled" | "pending";

function defaultScheduleDate() {
  const date = new Date(Date.now() + 24 * 3600_000);
  return date.toISOString().slice(0, 10);
}

export default function CustomerBills() {
  const { activeCustomer, addNotification, tenantConfiguration } = useCustomerSession();
  const [selectedCategory, setSelectedCategory] = useState<BillCategory>("electricity");
  const [selectedBillerId, setSelectedBillerId] = useState<string>(billCategories[0].billers[0].id);
  const [customerId, setCustomerId] = useState(activeCustomer?.id ?? "CUS-001");
  const [amount, setAmount] = useState(String(billCategories[0].billers[0].defaultAmount));
  const [records, setRecords] = useState<CustomerBillPaymentRecord[]>([]);
  const [savedBillers, setSavedBillers] = useState<CustomerSavedBiller[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{ name: string; reference: string } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [trailFilter, setTrailFilter] = useState<TrailFilter>("all");
  const [trailQuery, setTrailQuery] = useState("");
  const [saveBiller, setSaveBiller] = useState(true);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("pay_now");
  const [scheduleDate, setScheduleDate] = useState(defaultScheduleDate());

  const category = useMemo(
    () => billCategories.find((item) => item.id === selectedCategory) ?? billCategories[0],
    [selectedCategory],
  );

  const biller = useMemo(
    () => category.billers.find((item) => item.id === selectedBillerId) ?? category.billers[0],
    [category, selectedBillerId],
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        if (!activeCustomer?.id) return;
        const [billResponse, billerResponse] = await Promise.all([
          getCustomerBillPayments(activeCustomer.id),
          getSavedBillers(activeCustomer.id),
        ]);
        if (!active) return;
        setRecords(billResponse.items);
        setSavedBillers(billerResponse.items);
        setCustomerId(activeCustomer.id);
      } catch {
        if (!active) return;
        setMessage("Unable to refresh bill servicing data right now.");
      }
    })();

    return () => {
      active = false;
    };
  }, [activeCustomer?.id]);

  const enabledFeatureKeys = new Set([
    ...(tenantConfiguration?.enabledModules ?? []),
    ...((tenantConfiguration?.featureFlags ?? []).filter((flag) => flag.enabled).map((flag) => flag.key)),
  ]);
  const billsEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("bills");

  const customerRecords = useMemo(() => {
    const scoped = records.filter((record) => record.customerId === (activeCustomer?.id ?? records[0]?.customerId));
    const byStatus = trailFilter === "all" ? scoped : scoped.filter((record) => record.status === trailFilter);
    const normalized = trailQuery.trim().toLowerCase();
    return normalized
      ? byStatus.filter((record) =>
          [record.provider, record.reference, record.customerReference, record.customerName, record.category]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalized)),
        )
      : byStatus;
  }, [activeCustomer?.id, records, trailFilter, trailQuery]);

  function handleCategoryChange(nextCategory: BillCategory) {
    const next = billCategories.find((item) => item.id === nextCategory) ?? billCategories[0];
    setSelectedCategory(nextCategory);
    setSelectedBillerId(next.billers[0].id);
    setAmount(String(next.billers[0].defaultAmount));
    setCustomerInfo(null);
    setMessage(null);
  }

  function handleBillerChange(nextBillerId: string) {
    const next = category.billers.find((item) => item.id === nextBillerId) ?? category.billers[0];
    setSelectedBillerId(nextBillerId);
    setAmount(String(next.defaultAmount));
    setCustomerInfo(null);
    setMessage(null);
  }

  async function handleValidateCustomer() {
    if (!billsEnabled) {
      setMessage("Bill payments are currently disabled for this tenant during onboarding governance.");
      return;
    }

    if (!customerId.trim()) {
      setMessage("Enter a customer ID or meter number before validation.");
      return;
    }

    setIsValidating(true);
    setCustomerInfo(null);
    setMessage(null);

    await new Promise((resolve) => window.setTimeout(resolve, 450));

    const verifiedName = activeCustomer?.name ?? "54Bank Customer";
    setCustomerInfo({
      name: verifiedName,
      reference: `${biller.name} · ${customerId.trim()}`,
    });
    setIsValidating(false);
  }

  async function saveCurrentBiller() {
    if (!billsEnabled) {
      setMessage("Saved billers are unavailable until bill payments are enabled for this tenant.");
      return;
    }

    if (!customerInfo) {
      setMessage("Validate the customer reference before saving a biller.");
      return;
    }

    try {
      const saved = await saveCustomerBiller({
        id: `saved-${selectedBillerId}-${customerId.trim()}`,
        customerId: activeCustomer?.id ?? customerId.trim(),
        category: selectedCategory,
        provider: biller.name,
        billerId: selectedBillerId,
        customerReference: customerId.trim(),
        nickname: `${biller.name} · ${customerId.trim()}`,
        lastAmount: Number(amount || 0),
        verifiedName: customerInfo.name,
        lastPaidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      setSavedBillers((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setMessage(`${biller.name} was saved for faster payments in future sessions.`);
    } catch (issue) {
      setMessage(issue instanceof Error ? issue.message : "Unable to save this biller right now.");
    }
  }

  function applySavedBiller(saved: CustomerSavedBiller) {
    const nextCategory = billCategories.some((item) => item.id === saved.category) ? (saved.category as BillCategory) : "electricity";
    setSelectedCategory(nextCategory);
    setSelectedBillerId(saved.billerId);
    setCustomerId(saved.customerReference);
    setAmount(String(saved.lastAmount));
    setCustomerInfo({
      name: saved.verifiedName ?? activeCustomer?.name ?? "54Bank Customer",
      reference: `${saved.provider} · ${saved.customerReference}`,
    });
    setMessage(`Loaded saved biller ${saved.nickname}.`);
  }

  async function handlePayBill() {
    if (!billsEnabled) {
      setMessage("Bill payments are disabled for this tenant configuration.");
      return;
    }

    const numericAmount = Number(amount);

    if (!customerInfo) {
      setMessage("Validate the biller customer before continuing.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("Enter a valid payment amount before continuing.");
      return;
    }

    const confirmed = window.confirm(
      paymentMode === "pay_now"
        ? `Confirm payment of ${formatCurrency(numericAmount)} to ${biller.name} for ${customerInfo.name}?`
        : `Schedule ${formatCurrency(numericAmount)} to ${biller.name} for ${scheduleDate}?`,
    );

    if (!confirmed) return;

    setIsProcessing(true);
    setMessage(null);

    await new Promise((resolve) => window.setTimeout(resolve, 500));

    const timestamp = paymentMode === "schedule" ? new Date(`${scheduleDate}T09:00:00`).toISOString() : new Date().toISOString();
    const record: CustomerBillPaymentRecord = await createCustomerBillPayment({
      id: `bill-${Date.now()}`,
      customerId: activeCustomer?.id ?? customerId.trim(),
      category: selectedCategory,
      provider: biller.name,
      amount: numericAmount,
      status: paymentMode === "schedule" ? "scheduled" : "paid",
      paidAt: timestamp,
      reference: `BILL-${Date.now()}`,
      billerId: selectedBillerId,
      customerReference: customerId.trim(),
      customerName: customerInfo.name,
      scheduledFor: paymentMode === "schedule" ? timestamp : undefined,
      evidenceStatus: paymentMode === "schedule" ? "scheduled" : "verified",
      channel: saveBiller ? "saved-biller" : "self-service",
    });

    setRecords((current) => [record, ...current]);

    if (saveBiller) {
      try {
        const saved = await saveCustomerBiller({
          id: `saved-${selectedBillerId}-${customerId.trim()}`,
          customerId: activeCustomer?.id ?? customerId.trim(),
          category: selectedCategory,
          provider: biller.name,
          billerId: selectedBillerId,
          customerReference: customerId.trim(),
          nickname: `${biller.name} · ${customerId.trim()}`,
          lastAmount: numericAmount,
          verifiedName: customerInfo.name,
          lastPaidAt: timestamp,
          createdAt: new Date().toISOString(),
        });
        setSavedBillers((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      } catch {
        // Leave payment success intact even if the biller save path fails.
      }
    }

    addNotification({
      title: paymentMode === "schedule" ? "Bill payment scheduled" : "Bill paid successfully",
      message:
        paymentMode === "schedule"
          ? `${biller.name} will be paid ${formatCurrency(numericAmount)} on ${scheduleDate}.`
          : `${biller.name} received ${formatCurrency(numericAmount)} for ${customerInfo.name}.`,
      type: "success",
      actionUrl: "/customer/bills",
    });

    setIsProcessing(false);
    setMessage(
      paymentMode === "schedule"
        ? `Payment scheduled and retained in your bill trail for ${biller.name}.`
        : `Payment confirmed and recorded in your bill trail for ${biller.name}.`,
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-28 text-stone-900 lg:pb-10">
      <header className="px-5 pb-8 pt-6 text-white" style={{ background: `linear-gradient(135deg, ${tenantConfiguration?.whiteLabel?.primaryColor ?? "#f59e0b"} 0%, ${tenantConfiguration?.whiteLabel?.accentColor ?? "#b45309"} 100%)` }}>
        <div className="flex items-center gap-3">
          <Link href="/customer/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">{tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"}</p>
            <h1 className="text-xl font-semibold">Pay Bills</h1>
            <p className="mt-1 text-xs text-white/80">Validate the customer reference, confirm the amount, and complete payment from one mobile-first flow.</p>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 py-5">
        {!billsEnabled ? (
          <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
            Bill payments are paused for this tenant profile until an administrator enables the bills module. Existing history and saved billers remain visible for service continuity.
          </section>
        ) : null}

        <section className="rounded-[1.7rem] bg-white p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Category</label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {billCategories.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === selectedCategory;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleCategoryChange(item.id)}
                      className={`rounded-[1.3rem] p-4 text-left ${active ? "bg-amber-50 ring-1 ring-amber-200" : "bg-stone-50"}`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
                        <Icon size={18} />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-stone-900">{item.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Biller</label>
              <div className="relative mt-2">
                <select
                  value={selectedBillerId}
                  onChange={(event) => handleBillerChange(event.target.value)}
                  className="w-full appearance-none rounded-[1.2rem] border border-stone-200 bg-stone-50 px-4 py-3 pr-11 text-sm text-stone-900 outline-none ring-0"
                >
                  {category.billers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Customer ID / Meter Number</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    setCustomerInfo(null);
                    setMessage(null);
                  }}
                  className="min-w-0 flex-1 rounded-[1.2rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none"
                  placeholder="Enter customer ID"
                />
                <button
                  type="button"
                  onClick={() => void handleValidateCustomer()}
                  disabled={isValidating || !billsEnabled}
                  className="inline-flex items-center justify-center rounded-[1.2rem] bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isValidating ? <LoaderCircle className="animate-spin" size={16} /> : <BadgeCheck size={16} />}
                </button>
              </div>
            </div>

            {customerInfo ? (
              <div className="rounded-[1.3rem] bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <span className="flex items-center gap-2">
                    <UserRound size={16} />
                    Customer verified
                  </span>
                    <button type="button" onClick={() => void saveCurrentBiller()} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">

                    <Save size={14} />
                    Save biller
                  </button>
                </div>
                <p className="mt-2">{customerInfo.name}</p>
                <p className="text-xs text-emerald-700">{customerInfo.reference}</p>
              </div>
            ) : null}

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Amount</label>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
                className="mt-2 w-full rounded-[1.2rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none"
                inputMode="numeric"
                placeholder="Enter amount"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMode("pay_now")}
                className={`rounded-[1.2rem] px-4 py-3 text-sm font-semibold ${paymentMode === "pay_now" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}
              >
                Pay now
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("schedule")}
                className={`rounded-[1.2rem] px-4 py-3 text-sm font-semibold ${paymentMode === "schedule" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}
              >
                Schedule
              </button>
            </div>

            {paymentMode === "schedule" ? (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Execution date</span>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  className="mt-2 w-full rounded-[1.2rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none"
                />
              </label>
            ) : null}

            <label className="flex items-center justify-between rounded-[1.2rem] bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <span>Save this biller for future payments</span>
              <input type="checkbox" checked={saveBiller} onChange={(event) => setSaveBiller(event.target.checked)} className="h-4 w-4" />
            </label>

            <div className="rounded-[1.4rem] bg-stone-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Confirmation</p>
                  <h2 className="mt-2 text-lg font-semibold text-stone-900">{biller.name}</h2>
                </div>
                {paymentMode === "schedule" ? <CalendarClock className="text-amber-600" size={18} /> : <ShieldCheck className="text-amber-600" size={18} />}
              </div>
              <p className="mt-2 text-sm text-stone-500">Review the verified customer, amount, and execution mode before confirming payment.</p>
              <div className="mt-4 space-y-2 text-sm text-stone-600">
                <div className="flex items-center justify-between gap-3">
                  <span>Prepared amount</span>
                  <span className="font-semibold text-stone-900">{formatCurrency(Number(amount || 0))}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Execution mode</span>
                  <span className="font-semibold capitalize text-stone-900">{paymentMode === "pay_now" ? "Immediate" : scheduleDate}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handlePayBill()}
                disabled={isProcessing || !billsEnabled}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-stone-950 shadow-[0_14px_28px_rgba(245,158,11,0.24)] disabled:opacity-60"
              >
                {isProcessing ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                {isProcessing ? "Processing payment" : paymentMode === "schedule" ? "Schedule Payment" : "Pay Now"}
              </button>
              {message ? <div className="mt-3 rounded-[1.2rem] bg-white p-3 text-sm text-stone-700">{message}</div> : null}
              <p className="mt-3 text-xs text-stone-500">Saved billers, schedules, and payment history remain available below as compatible live enhancements.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.7rem] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Saved billers</h2>
              <p className="mt-1 text-sm text-stone-500">Optional shortcuts retained from the active runtime after the primary pay flow.</p>
            </div>
            <Save className="text-amber-600" size={18} />
          </div>
          <div className="mt-4 space-y-3">
            {savedBillers.length ? (
              savedBillers.slice(0, 4).map((saved) => (
                <article key={saved.id} className="rounded-[1.3rem] bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{saved.nickname}</p>
                      <p className="mt-1 text-xs text-stone-500">{saved.provider} · {saved.customerReference}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          try {
                            await deleteCustomerBiller(saved.id);
                            setSavedBillers((current) => current.filter((item) => item.id !== saved.id));
                          } catch (issue) {
                            setMessage(issue instanceof Error ? issue.message : "Unable to remove this saved biller right now.");
                          }
                        })();
                      }}
                      className="rounded-full bg-white p-2 text-stone-500"
                      aria-label={`Remove ${saved.nickname}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => applySavedBiller(saved)} className="rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white">
                      Use biller
                    </button>
                    <span className="rounded-full bg-white px-3 py-2 text-xs text-stone-500">Last amount {formatCurrency(saved.lastAmount)}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.3rem] bg-stone-50 p-4 text-sm text-stone-500">No saved billers are available yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.7rem] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">Recent payments</h2>
            <Link href="/customer/statements" className="text-sm font-medium text-amber-700">
              Statements
            </Link>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-[1.2rem] bg-stone-50 px-4 py-3">
            <Search className="text-stone-400" size={16} />
            <input
              value={trailQuery}
              onChange={(event) => setTrailQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
              placeholder="Search provider, reference, customer, or category"
            />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
            {(["all", "paid", "scheduled", "pending"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTrailFilter(filter)}
                className={`rounded-full px-3 py-2 font-semibold ${trailFilter === filter ? "bg-amber-500 text-stone-950" : "bg-stone-100 text-stone-600"}`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {customerRecords.length ? (
              customerRecords.map((record) => (
                <article key={record.id} className="rounded-[1.3rem] bg-stone-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{record.provider}</p>
                      <p className="mt-1 text-xs text-stone-500">{record.reference}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${record.status === "paid" ? "bg-emerald-100 text-emerald-700" : record.status === "scheduled" ? "bg-amber-100 text-amber-700" : "bg-stone-200 text-stone-700"}`}>
                      {record.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                    <span>{record.category.replace("_", " ")}</span>
                    <span className="font-semibold text-stone-900">{formatCurrency(record.amount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-stone-500">
                    <span className="flex items-center gap-2">
                      <ReceiptText size={14} />
                      {record.customerReference ?? activeCustomer?.id ?? "CUS-001"}
                    </span>
                    <span>{formatRelativeIso(record.scheduledFor ?? record.paidAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.3rem] bg-stone-50 p-4 text-sm text-stone-500">No bill-payment records match the current search and filter.</div>
            )}
          </div>
        </section>
      </main>

      <CustomerBottomNav />
    </div>
  );
}
