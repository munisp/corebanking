// Design philosophy: archive-first mobile card servicing.
// This page now behaves more like a working recovered servicing surface with searchable cards,
// persisted controls, retained card events, and adjustable card-management limits.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  BadgeCheck,
  Eye,
  EyeOff,
  History,
  LockKeyhole,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
import {
  getCustomerCardEvents,
  getCustomerCards,
  type AuditEntry,
  type CustomerCardEvent,
  type CustomerCardProfile,
  formatCurrency,
  formatRelativeIso,
  updateCustomerCard,
} from "@/lib/platform";

const quickActionBlueprint = [
  { label: "Show", key: "show", icon: Eye },
  { label: "Lock", key: "lock", icon: LockKeyhole },
  { label: "History", key: "history", icon: History },
  { label: "Settings", key: "settings", icon: Settings2 },
] as const;

function eventTone(event: CustomerCardEvent) {
  switch (event.severity) {
    case "warning":
      return "bg-amber-50 text-amber-800";
    case "success":
      return "bg-emerald-50 text-emerald-800";
    default:
      return "bg-gray-50 text-gray-700";
  }
}

export default function CustomerCards() {
  const { activeCustomer, audits, tenantConfiguration } = useCustomerSession();
  const [cards, setCards] = useState<CustomerCardProfile[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [cardEvents, setCardEvents] = useState<CustomerCardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [historyMode, setHistoryMode] = useState<"all" | "warnings">("all");
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        if (!activeCustomer?.id) {
          if (active) setLoading(false);
          return;
        }

        const [cardsResponse, eventsResponse] = await Promise.all([getCustomerCards(activeCustomer.id), getCustomerCardEvents(activeCustomer.id)]);
        if (!active) return;

        setCards(cardsResponse.items);
        setAuditEntries(audits as AuditEntry[]);
        setCardEvents(eventsResponse.items);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : "Unable to load card servicing details.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeCustomer?.id, audits]);

  const enabledFeatureKeys = new Set([
    ...(tenantConfiguration?.enabledModules ?? []),
    ...((tenantConfiguration?.featureFlags ?? []).filter((flag) => flag.enabled).map((flag) => flag.key)),
  ]);
  const cardsEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("cards");

  const filteredCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return cards;
    return cards.filter((card) =>
      [card.cardHolder, card.type, card.brand, card.lastFour].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [cards, query]);

  const activeCard = filteredCards[Math.min(activeCardIndex, Math.max(filteredCards.length - 1, 0))] ?? filteredCards[0] ?? null;

  const activeEvents = useMemo(() => {
    const relevant = cardEvents.filter((event) => event.cardId === activeCard?.id);
    return historyMode === "warnings" ? relevant.filter((event) => event.severity === "warning") : relevant;
  }, [activeCard?.id, cardEvents, historyMode]);

  const fraudSignals = useMemo(() => auditEntries.filter((entry) => entry.severity !== "info").length, [auditEntries]);

  useEffect(() => {
    if (activeCardIndex > Math.max(filteredCards.length - 1, 0)) {
      setActiveCardIndex(0);
    }
  }, [activeCardIndex, filteredCards.length]);

  async function persistCard(nextCard: CustomerCardProfile, _title: string, detail: string, _severity: CustomerCardEvent["severity"] = "success") {
    try {
      const updated = await updateCustomerCard(nextCard.id, nextCard);
      const [cardsResponse, eventsResponse] = await Promise.all([
        getCustomerCards(updated.customerId),
        getCustomerCardEvents(updated.customerId),
      ]);
      setCards(cardsResponse.items);
      setCardEvents(eventsResponse.items);
      setStatusMessage(detail);
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to persist card controls right now.");
    }
  }

  function toggleControl(key: keyof CustomerCardProfile["controls"]) {
    if (!cardsEnabled) {
      setStatusMessage("Card controls are disabled for this tenant configuration.");
      return;
    }
    if (!activeCard) return;
    const nextValue = !activeCard.controls[key];
    persistCard(
      {
        ...activeCard,
        controls: {
          ...activeCard.controls,
          [key]: nextValue,
        },
      },
      `${key} control updated`,
      `${key.charAt(0).toUpperCase()}${key.slice(1)} transactions are now ${nextValue ? "enabled" : "disabled"} for card •••• ${activeCard.lastFour}.`,
      nextValue ? "success" : "warning",
    ).catch(() => undefined);
  }

  function toggleLock() {
    if (!cardsEnabled) {
      setStatusMessage("Card lock and unlock operations are disabled for this tenant configuration.");
      return;
    }
    if (!activeCard) return;
    const nextLocked = !activeCard.isLocked;
    persistCard(
      {
        ...activeCard,
        isLocked: nextLocked,
      },
      nextLocked ? "Card temporarily locked" : "Card unlocked",
      nextLocked
        ? `Card •••• ${activeCard.lastFour} has been temporarily locked while control review continues.`
        : `Card •••• ${activeCard.lastFour} has been reopened for approved usage.`,
      nextLocked ? "warning" : "success",
    ).catch(() => undefined);
  }

  function updateLimit(key: keyof CustomerCardProfile["spendingLimits"], value: string) {
    if (!activeCard) return;
    const numeric = Number(value.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    setCards((current) =>
      current.map((card) =>
        card.id === activeCard.id
          ? {
              ...card,
              spendingLimits: {
                ...card.spendingLimits,
                [key]: numeric,
              },
            }
          : card,
      ),
    );
  }

  function saveLimits() {
    if (!cardsEnabled) {
      setStatusMessage("Card limit changes are disabled for this tenant configuration.");
      return;
    }
    if (!activeCard) return;
    const latest = cards.find((card) => card.id === activeCard.id) ?? activeCard;
    persistCard(
      latest,
      "Card spending limits updated",
      `Spending limits for card •••• ${latest.lastFour} were saved into the active servicing endpoint.`,
      "success",
    ).catch(() => undefined);
  }

  const cardControls = activeCard
    ? [
        { key: "online", label: "Online Transactions", desc: `${activeCard.controls.online ? "Enabled" : "Disabled"} while ${fraudSignals} non-informational audit signals remain visible.` },
        { key: "atm", label: "ATM Withdrawals", desc: `Current ATM threshold is ${formatCurrency(activeCard.spendingLimits.atm)} with retained device-control posture.` },
        { key: "international", label: "International Transactions", desc: `${activeCard.controls.international ? "Available" : "Restricted"} until travel or risk posture changes are approved.` },
      ] as const
    : [];

  return (
    <div className="min-h-screen bg-gray-50 pb-28 text-gray-900 lg:pb-10">
      <header className="px-5 pb-8 pt-6 text-white" style={{ background: `linear-gradient(135deg, ${tenantConfiguration?.whiteLabel?.primaryColor ?? "#1d4ed8"} 0%, ${tenantConfiguration?.whiteLabel?.accentColor ?? "#1e3a8a"} 100%)` }}>
        <div className="flex items-center gap-4">
          <Link href="/customer/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">{tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"}</p>
            <h1 className="text-xl font-bold">My Cards</h1>
            <p className="mt-1 text-xs text-white/80">Review your cards, manage controls, and confirm the active spending posture from one mobile-first screen.</p>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 py-5">
        {!cardsEnabled ? (
          <section className="rounded-[1.4rem] border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Card issuance and servicing controls are paused for this tenant profile until an administrator enables the cards module. Existing visibility remains available for customer support continuity.
          </section>
        ) : null}
        <section className="rounded-[1.7rem] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3 rounded-[1.2rem] bg-gray-50 px-4 py-3">
            <Search className="text-gray-400" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              placeholder="Search by card holder, brand, type, or last four"
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>{filteredCards.length} visible card profiles</span>
            <button type="button" onClick={() => setQuery("")} className="font-semibold text-blue-700">
              Reset
            </button>
          </div>
        </section>

        <section>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
            {filteredCards.map((card, index) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveCardIndex(index)}
                className={`relative h-52 w-80 flex-shrink-0 snap-center rounded-[1.8rem] p-6 text-left text-white transition-all ${card.colorTone === "blue" ? "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900" : "bg-gradient-to-br from-gray-800 to-gray-950"} ${index === activeCardIndex ? "scale-100 opacity-100" : "scale-[0.96] opacity-75"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-white/80">{card.type === "virtual" ? "Virtual Card" : "Physical Card"}</span>
                  <span className="font-bold italic tracking-[0.16em] text-white">{card.brand.toUpperCase()}</span>
                </div>
                <div className="mt-8">
                  <p className="text-xl tracking-[0.3em] text-white/95">•••• •••• •••• {showDetails ? card.lastFour : "••••"}</p>
                </div>
                <div className="mt-8 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] text-white/60">CARD HOLDER</p>
                    <p className="mt-1 text-sm font-medium">{card.cardHolder}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-white/60">EXPIRES</p>
                    <p className="mt-1 text-sm font-medium">{card.expiryDate}</p>
                  </div>
                </div>
                {card.isLocked ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-[1.8rem] bg-black/70">
                    <span className="text-2xl font-bold">LOCKED</span>
                  </div>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-1 flex justify-center gap-2">
            {filteredCards.map((card, index) => (
              <div key={card.id} className={`h-2 rounded-full transition-all ${index === activeCardIndex ? "w-6 bg-blue-600" : "w-2 bg-gray-300"}`} />
            ))}
          </div>
        </section>

        <section className="rounded-[1.7rem] bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-gray-500">Available Balance</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{formatCurrency(activeCard?.balance ?? 0)}</p>
          <p className="mt-2 text-sm text-gray-500">Updated {activeCard ? formatRelativeIso(activeCard.updatedAt) : "just now"}</p>
        </section>

        <section className="grid grid-cols-4 gap-3">
          {quickActionBlueprint.map((action) => {
            const Icon = action.icon;
            const label =
              action.key === "show"
                ? showDetails
                  ? "Hide"
                  : "Show"
                : action.key === "lock"
                  ? activeCard?.isLocked
                    ? "Unlock"
                    : "Lock"
                  : action.label;

            return (
              <button
                key={action.key}
                type="button"
                onClick={() => {
                  if (action.key === "show") setShowDetails((current) => !current);
                  if (action.key === "lock") toggleLock();
                  if (action.key === "history") setHistoryMode((current) => (current === "all" ? "warnings" : "all"));
                  if (action.key === "settings") setShowSettings((current) => !current);
                }}
                disabled={!cardsEnabled && action.key !== "history"}
                className="flex flex-col items-center gap-2 rounded-[1.2rem] bg-white p-4 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  {action.key === "show" ? showDetails ? <EyeOff size={18} /> : <Eye size={18} /> : <Icon size={18} />}
                </span>
                <span className="text-center text-xs text-gray-600">{label}</span>
              </button>
            );
          })}
        </section>

        <section className="rounded-[1.2rem] bg-gray-100 p-4 text-xs text-gray-600">
          Search, lock controls, limit settings, and retained event history remain available as compatible live enhancements.
        </section>
        {statusMessage ? <section className="rounded-[1.2rem] bg-emerald-50 p-4 text-sm text-emerald-800">{statusMessage}</section> : null}
        {error ? <section className="rounded-[1.2rem] bg-rose-50 p-4 text-sm text-rose-700">{error}</section> : null}

        <section className="rounded-[1.7rem] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Card Controls</h2>
                  <p className="mt-1 text-sm text-gray-500">Core card controls remain available in a simpler mobile-first servicing rhythm.</p>

            </div>
            <ShieldCheck className="text-blue-600" size={18} />
          </div>
          <div className="mt-4">
            {cardControls.map((control, index) => (
              <div key={control.key} className={`flex items-center justify-between gap-3 py-3 ${index !== cardControls.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div>
                  <p className="font-medium text-gray-800">{control.label}</p>
                  <p className="text-xs text-gray-500">{control.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleControl(control.key)}
                  disabled={!cardsEnabled}
                  className={`relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${activeCard?.controls[control.key] ? "bg-blue-600" : "bg-gray-200"}`}
                  aria-label={control.label}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${activeCard?.controls[control.key] ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {showSettings && activeCard ? (
          <section className="rounded-[1.7rem] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Limit Settings</h2>
                <p className="mt-1 text-sm text-gray-500">Persisted spending thresholds for the active card profile, synchronized through the server-backed servicing route.</p>
              </div>
              <Settings2 className="text-blue-600" size={18} />
            </div>
            <div className="mt-4 grid gap-4">
              {([
                ["daily", "Daily spending"],
                ["atm", "ATM withdrawal"],
                ["online", "Online transactions"],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">{label}</span>
                  <input
                    value={String(activeCard.spendingLimits[key])}
                    onChange={(event) => updateLimit(key, event.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-[1.2rem] border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={saveLimits}
              disabled={!cardsEnabled}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save card settings
            </button>
          </section>
        ) : null}

        <section className="rounded-[1.7rem] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Latest control events</h2>
              <p className="mt-1 text-sm text-gray-500">History mode is currently showing {historyMode === "all" ? "all retained card events" : "warnings only"}.</p>
            </div>
            <BadgeCheck className="text-emerald-600" size={18} />
          </div>
          <div className="mt-4 space-y-3">
            {loading ? <div className="text-sm text-gray-500">Loading card events…</div> : null}
            {!loading && !activeEvents.length ? <div className="rounded-[1.3rem] bg-gray-50 p-4 text-sm text-gray-500">No control events are available for the selected filter.</div> : null}
            {activeEvents.slice(0, 6).map((entry) => (
              <article key={entry.id} className={`rounded-[1.3rem] p-4 ${eventTone(entry)}`}>
                <p className="text-sm font-semibold">{entry.title}</p>
                <p className="mt-1 text-xs opacity-80">{entry.detail}</p>
                <p className="mt-2 text-[11px] opacity-70">{formatRelativeIso(entry.createdAt)}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <CustomerBottomNav />
    </div>
  );
}
