// Design philosophy: archive-first customer settings menu with active runtime session controls.
// The page now follows a stronger mobile profile-and-menu rhythm while keeping customer switching,
// tenant posture, notification visibility, and runtime details available from the live session.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronRight,
  CircleHelp,
  Fingerprint,
  Info,
  Lock,
  LogOut,
  Palette,
  Shield,
  UserCircle2,
} from "lucide-react";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
import { formatRelativeIso } from "@/lib/platform";

type SettingsItem = {
  key: string;
  icon: typeof UserCircle2;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  tone?: "default" | "danger";
  onClick: () => void;
};

function SettingsSection({ title, items }: { title: string; items: SettingsItem[] }) {
  return (
    <section className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
      <div className="border-b border-stone-100 px-4 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">{title}</h2>
      </div>
      <div>
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`flex w-full items-center gap-4 px-4 py-4 text-left ${index !== items.length - 1 ? "border-b border-stone-100" : ""}`}
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-stone-100 text-stone-700"}`}>
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${item.tone === "danger" ? "text-rose-700" : "text-stone-900"}`}>{item.title}</span>
                {item.subtitle ? <span className="mt-1 block text-xs leading-5 text-stone-500">{item.subtitle}</span> : null}
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold text-stone-400">
                {item.actionLabel ? <span>{item.actionLabel}</span> : null}
                <ChevronRight size={16} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function CustomerSettings() {
  const {
    activeCustomer,
    customers,
    authContext,
    tenantConfiguration,
    notifications,
    unreadNotifications,
    switchCustomer,
    error,
  } = useCustomerSession();

  const [biometricEnabled, setBiometricEnabled] = useState(Boolean(authContext?.issuer));
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(unreadNotifications >= 0);
  const [message, setMessage] = useState<string | null>(null);

  const enabledFeatures = tenantConfiguration?.featureFlags?.filter((flag) => flag.enabled) ?? [];
  const activeCustomerIndex = Math.max(
    0,
    customers.findIndex((customer) => customer.id === activeCustomer?.id),
  );
  const nextCustomer = customers.length > 1 ? customers[(activeCustomerIndex + 1) % customers.length] : null;

  const accountItems = useMemo<SettingsItem[]>(
    () => [
      {
        key: "profile",
        icon: UserCircle2,
        title: "Profile",
        subtitle: `${activeCustomer?.name ?? "Customer profile"} · ${activeCustomer?.phone ?? "contact pending"}`,
        actionLabel: "View",
        onClick: () => setMessage(`Profile shell anchored to ${activeCustomer?.name ?? "the active customer"}.`),
      },
      {
        key: "switch",
        icon: Building2,
        title: "Switch active customer",
        subtitle: nextCustomer
          ? `Next available profile: ${nextCustomer.name}`
          : "Only one active customer profile is available in this session.",
        actionLabel: nextCustomer ? "Switch" : "Locked",
        onClick: () => {
          if (nextCustomer) {
            switchCustomer(nextCustomer.id);
            setMessage(`Switched the active customer shell to ${nextCustomer.name}.`);
            return;
          }
          setMessage("Only one customer profile is currently available in this tenant session.");
        },
      },
      {
        key: "account-details",
        icon: Palette,
        title: "Account details",
        subtitle: `${tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"} · ${tenantConfiguration?.region ?? "Multi-region"}`,
        actionLabel: "Live",
        onClick: () => setMessage("Tenant branding and onboarding details remain available in the live runtime section below."),
      },
    ],
    [activeCustomer?.name, activeCustomer?.phone, nextCustomer, switchCustomer, tenantConfiguration?.region, tenantConfiguration?.whiteLabel?.displayName],
  );

  const securityItems = useMemo<SettingsItem[]>(
    () => [
      {
        key: "biometric",
        icon: Fingerprint,
        title: "Biometric authentication",
        subtitle: biometricEnabled ? "Face or fingerprint login is marked as available for this session." : "Biometric login is currently disabled in this customer shell.",
        actionLabel: biometricEnabled ? "On" : "Off",
        onClick: () => {
          setBiometricEnabled((value) => !value);
          setMessage(`Biometric authentication ${biometricEnabled ? "disabled" : "enabled"} for this local customer shell preview.`);
        },
      },
      {
        key: "pin",
        icon: Lock,
        title: "Transaction PIN",
        subtitle: authContext?.issuer ? "Protected by the current tenant identity issuer." : "Issuer details are still loading for this customer session.",
        actionLabel: authContext?.issuer ? "Ready" : "Pending",
        onClick: () => setMessage("Transaction PIN management remains governed by the current tenant identity posture."),
      },
      {
        key: "security-posture",
        icon: Shield,
        title: "Security posture",
        subtitle: `${unreadNotifications} unread alerts · ${notifications.length} total customer notifications in runtime.`,
        actionLabel: unreadNotifications ? "Alerted" : "Stable",
        onClick: () => setMessage("Security and alert posture is being derived from the active customer runtime data."),
      },
    ],
    [authContext?.issuer, biometricEnabled, notifications.length, unreadNotifications],
  );

  const notificationItems = useMemo<SettingsItem[]>(
    () => [
      {
        key: "push",
        icon: Bell,
        title: "Push notifications",
        subtitle: pushNotificationsEnabled
          ? "Transaction and servicing alerts remain visible in the active customer shell."
          : "Preview notifications are muted locally while the runtime data remains intact.",
        actionLabel: pushNotificationsEnabled ? "On" : "Off",
        onClick: () => {
          setPushNotificationsEnabled((value) => !value);
          setMessage(`Push notifications ${pushNotificationsEnabled ? "muted" : "enabled"} for the current preview state.`);
        },
      },
    ],
    [pushNotificationsEnabled],
  );

  const supportItems = useMemo<SettingsItem[]>(
    () => [
      {
        key: "help",
        icon: CircleHelp,
        title: "Help center",
        subtitle: "Access archive-shaped support navigation without leaving the authenticated customer shell.",
        actionLabel: "Info",
        onClick: () => setMessage("Help-center navigation is not yet expanded on this route, but the archive-style support entry is now represented."),
      },
      {
        key: "contact",
        icon: Bell,
        title: "Contact support",
        subtitle: tenantConfiguration?.whiteLabel?.supportEmail ?? "platform-operations@54bank.app",
        actionLabel: "Email",
        onClick: () => setMessage(`Support contact remains ${tenantConfiguration?.whiteLabel?.supportEmail ?? "platform-operations@54bank.app"}.`),
      },
      {
        key: "about",
        icon: Info,
        title: "About",
        subtitle: `Updated ${formatRelativeIso(authContext?.asOf)} · ${tenantConfiguration?.enabledModules?.length ?? 0} enabled modules`,
        actionLabel: "Version",
        onClick: () => setMessage("This customer settings route now follows a stronger archive-style profile and menu rhythm while preserving live runtime context."),
      },
      {
        key: "logout",
        icon: LogOut,
        title: "Logout",
        subtitle: "Keep the archive-style explicit sign-out affordance without leaving the current preview session.",
        actionLabel: "Preview",
        tone: "danger",
        onClick: () => setMessage("Logout remains intentionally non-destructive in preview, but the archive-style sign-out entry is now represented."),
      },
    ],
    [authContext?.asOf, tenantConfiguration?.enabledModules?.length, tenantConfiguration?.whiteLabel?.supportEmail],
  );

  return (
    <div className="min-h-screen bg-stone-50 pb-28 text-stone-900 lg:pb-10">
      <header className="bg-gradient-to-br from-stone-900 to-stone-700 px-5 pb-8 pt-6 text-white">
        <div className="flex items-center gap-3">
          <Link href="/customer/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Customer banking</p>
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 py-5">
        <section className="rounded-[1.8rem] bg-white p-6 text-center shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-stone-900 text-white">
            <span className="text-3xl font-semibold">{activeCustomer?.name?.slice(0, 1).toUpperCase() ?? "C"}</span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-stone-900">{activeCustomer?.name ?? "54Bank customer"}</h2>
          <p className="mt-2 text-sm text-stone-500">{activeCustomer?.phone ?? "Customer contact details will appear here."}</p>
          <p className="mt-1 text-sm text-stone-500">{activeCustomer?.location ?? "Location unavailable"}</p>
          <div className="mt-5 rounded-[1.4rem] bg-emerald-50 p-4 text-left text-sm text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <Shield size={16} />
              Authenticated customer shell active
            </div>
            <p className="mt-2 text-emerald-800">
              The restored dashboard, transfers, statements, bills, cards, and settings routes now share the same runtime-backed customer identity.
            </p>
          </div>
        </section>

        <SettingsSection title="Account" items={accountItems} />
        <SettingsSection title="Security" items={securityItems} />
        <SettingsSection title="Notifications" items={notificationItems} />
        <SettingsSection title="Support" items={supportItems} />

        <section className="rounded-[1.7rem] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Runtime details</h2>
              <p className="mt-1 text-sm text-stone-500">Live tenant posture and feature-rollout evidence remain available as compatible runtime enhancements.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
              <Palette size={14} />
              {tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-[1.3rem] border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Tenant</p>
              <p className="mt-2 text-sm font-semibold text-stone-900">{authContext?.tenantId ?? "54bank-platform-prod"}</p>
              <p className="mt-1 text-xs text-stone-500">{tenantConfiguration?.whiteLabel?.legalEntity ?? "54Bank tenant shell"}</p>
            </article>
            <article className="rounded-[1.3rem] border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Onboarding state</p>
              <p className="mt-2 text-sm font-semibold text-stone-900">{tenantConfiguration?.onboardingStatus ?? "active"}</p>
              <p className="mt-1 text-xs text-stone-500">Updated {formatRelativeIso(authContext?.asOf)}</p>
            </article>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {enabledFeatures.slice(0, 6).map((flag) => (
              <span key={flag.key} className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                {flag.label} · {flag.rolloutStage}
              </span>
            ))}
            {!enabledFeatures.length ? (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-stone-600">Default runtime features</span>
            ) : null}
          </div>
          {message ? <div className="mt-4 rounded-[1.2rem] bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
          {error ? <div className="mt-4 rounded-[1.2rem] bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        </section>
      </main>

      <CustomerBottomNav />
    </div>
  );
}
