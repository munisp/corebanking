import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, Building2, Loader2, QrCode, ScanLine, ShieldCheck } from "lucide-react";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
import { formatRelativeIso, getCustomerQrOverview, type CustomerQrOverview } from "@/lib/platform";

function statusTone(status: CustomerQrOverview["serviceStatus"]) {
  if (status === "healthy") return "bg-emerald-100 text-emerald-700";
  if (status === "degraded") return "bg-amber-100 text-amber-700";
  if (status === "down") return "bg-rose-100 text-rose-700";
  return "bg-stone-100 text-stone-700";
}

function flowTone(status: CustomerQrOverview["supportedFlows"][number]["status"]) {
  if (status === "ready") return "bg-emerald-100 text-emerald-700";
  if (status === "review") return "bg-amber-100 text-amber-700";
  return "bg-stone-100 text-stone-700";
}

export default function CustomerQr() {
  const { tenantConfiguration } = useCustomerSession();
  const enabledFeatureKeys = new Set([
    ...(tenantConfiguration?.enabledModules ?? []),
    ...((tenantConfiguration?.featureFlags ?? []).filter((flag) => flag.enabled).map((flag) => flag.key)),
  ]);
  const qrEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("qr");

  const [overview, setOverview] = useState<CustomerQrOverview | null>(null);
  const [loading, setLoading] = useState(qrEnabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!qrEnabled) {
      setOverview(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void getCustomerQrOverview()
      .then((response) => {
        if (cancelled) return;
        setOverview(response);
        setError(null);
      })
      .catch((issue) => {
        if (cancelled) return;
        setError(issue instanceof Error ? issue.message : "Unable to load QR payment posture.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [qrEnabled]);

  return (
    <div className="min-h-screen bg-stone-50 pb-28 text-stone-900 lg:pb-10">
      <header
        className="px-5 pb-8 pt-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${tenantConfiguration?.whiteLabel?.primaryColor ?? "#047857"} 0%, ${tenantConfiguration?.whiteLabel?.accentColor ?? "#022c22"} 100%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <Link href="/customer/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">
              {tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"} QR payments
            </p>
            <h1 className="text-xl font-semibold">Scan and pay</h1>
            <p className="mt-1 text-xs text-white/80">
              {tenantConfiguration?.onboardingStatus ?? "active"} governance · support {tenantConfiguration?.whiteLabel?.supportEmail ?? "platform-operations@54bank.app"}
            </p>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 py-5">
        {!qrEnabled ? (
          <section className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            QR payments are currently disabled for this tenant profile. The operational handoff destinations remain visible for service orientation while onboarding governance is completed.
          </section>
        ) : null}

        <section className="rounded-[2rem] bg-white p-6 text-center shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[1.8rem] bg-emerald-50 text-emerald-700">
            <QrCode size={42} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-stone-900">QR payment rail restored</h2>
          <p className="mt-3 text-sm leading-7 text-stone-500">
            The QR surface now reads live platform posture from the customer-servicing API so operators and customers can see settlement routing, compliance checks, and recent evidence instead of a static navigation placeholder.
          </p>
        </section>

        {loading ? (
          <section className="flex items-center gap-3 rounded-[1.5rem] bg-white p-4 text-sm text-stone-500 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
            <Loader2 className="animate-spin text-emerald-600" size={18} /> Loading QR servicing posture…
          </section>
        ) : null}

        {error ? (
          <section className="flex items-start gap-3 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <AlertTriangle size={18} className="mt-0.5" />
            <div>
              <p className="font-semibold">QR servicing posture unavailable</p>
              <p className="mt-1 leading-6">{error}</p>
            </div>
          </section>
        ) : null}

        {overview ? (
          <>
            <section className="grid grid-cols-2 gap-3">
              <article className="rounded-[1.4rem] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(overview.serviceStatus)}`}>
                  {overview.serviceStatus}
                </span>
                <p className="mt-3 text-sm font-semibold text-stone-900">Service posture</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">Current QR servicing status exposed by the active platform runtime.</p>
              </article>
              <article className="rounded-[1.4rem] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <Building2 size={18} />
                </span>
                <p className="mt-3 text-sm font-semibold text-stone-900">Settlement route</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">{overview.settlementRoute}</p>
              </article>
            </section>

            <section className="rounded-[1.4rem] bg-emerald-50 p-3 text-xs text-emerald-900">
              Last QR-linked servicing evidence: {overview.lastUsedAt ? formatRelativeIso(overview.lastUsedAt) : "No QR-linked servicing evidence yet."}
            </section>

            <section className="space-y-3">
              {overview.supportedFlows.map((flow) => (
                <Link
                  key={flow.key}
                  href={qrEnabled ? flow.route : "/customer/qr"}
                  className={`flex items-center justify-between rounded-[1.6rem] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)] ${!qrEnabled ? "pointer-events-none opacity-60" : ""}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-stone-900">{flow.label}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${flowTone(flow.status)}`}>{flow.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">{flow.detail}</p>
                  </div>
                  <ScanLine className="text-emerald-700" size={20} />
                </Link>
              ))}
            </section>

            <section className="rounded-[1.6rem] bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2 text-stone-900">
                <ShieldCheck size={18} className="text-emerald-700" />
                <h2 className="text-lg font-semibold">Control checks</h2>
              </div>
              <div className="mt-4 space-y-3">
                {overview.complianceChecks.map((item) => (
                  <div key={item} className="rounded-[1.1rem] bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.6rem] bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
              <h2 className="text-lg font-semibold text-stone-900">Recent evidence</h2>
              <div className="mt-4 space-y-3">
                {overview.recentAudit.length === 0 ? (
                  <p className="rounded-[1.1rem] bg-stone-50 px-4 py-3 text-sm text-stone-500">
                    No QR-linked audit records have been emitted yet. The servicing rail is available and will surface evidence here as customers and operators continue processing transfers and follow-up actions.
                  </p>
                ) : (
                  overview.recentAudit.map((entry) => (
                    <article key={entry.id} className="rounded-[1.2rem] border border-stone-200 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{entry.action}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-400">{entry.entityType} · {entry.severity}</p>
                        </div>
                        <span className="text-xs text-stone-400">{formatRelativeIso(entry.timestamp)}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-stone-600">{entry.outcome}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>

      <CustomerBottomNav />
    </div>
  );
}
