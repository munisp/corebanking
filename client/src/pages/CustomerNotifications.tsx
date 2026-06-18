// Design philosophy: restored original banking PWA shell.
// This page restores a dedicated customer alerts destination, turning the shared notification store
// into a visible mobile route with unread handling that keeps the recovered shell feeling active.

import { Link } from "wouter";
import { AlertCircle, ArrowLeft, BellRing, CheckCheck, CheckCircle2 } from "lucide-react";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
import { formatRelativeIso } from "@/lib/platform";

export default function CustomerNotifications() {
  const { notifications, unreadNotifications, markAllNotificationsAsRead, markNotificationAsRead, tenantConfiguration } = useCustomerSession();
  const enabledFeatureKeys = new Set([
    ...(tenantConfiguration?.enabledModules ?? []),
    ...((tenantConfiguration?.featureFlags ?? []).filter((flag) => flag.enabled).map((flag) => flag.key)),
  ]);
  const notificationsEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("notifications");

  return (
    <div className="min-h-screen bg-stone-50 pb-28 text-stone-900 lg:pb-10">
      <header className="px-5 pb-8 pt-6 text-white" style={{ background: `linear-gradient(135deg, ${tenantConfiguration?.whiteLabel?.primaryColor ?? "#0f172a"} 0%, ${tenantConfiguration?.whiteLabel?.accentColor ?? "#334155"} 100%)` }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">{tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"} alerts</p>
            <h1 className="text-xl font-semibold">Notifications</h1>
            <p className="mt-1 text-xs text-white/75">{tenantConfiguration?.onboardingStatus ?? "active"} governance · support {tenantConfiguration?.whiteLabel?.supportEmail ?? "platform-operations@54bank.app"}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-[1.4rem] bg-white/10 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Unread alerts</p>
            <p className="mt-2 text-2xl font-semibold">{unreadNotifications}</p>
          </div>
          <button
            type="button"
            onClick={markAllNotificationsAsRead}
            disabled={!notificationsEnabled}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        </div>
      </header>

      <main className="-mt-3 px-4">
        {!notificationsEnabled ? (
          <section className="mb-4 rounded-[1.4rem] border border-slate-200 bg-slate-100 p-4 text-sm text-slate-800">
            Notifications are paused for this tenant profile until an administrator enables the notifications module. Historic alerts remain visible for continuity.
          </section>
        ) : null}
        <section className="rounded-[1.7rem] bg-white p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <div className="space-y-3">
            {notifications.length ? (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markNotificationAsRead(notification.id)}
                  disabled={!notificationsEnabled}
                  className={`w-full rounded-[1.4rem] p-4 text-left disabled:cursor-not-allowed disabled:opacity-70 ${notification.read ? "bg-stone-50" : "bg-emerald-50"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full ${notification.read ? "bg-white text-stone-500" : "bg-white text-emerald-700"}`}>
                      {notification.type === "warning" || notification.type === "error" ? <AlertCircle size={18} /> : <BellRing size={18} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-stone-900">{notification.title}</p>
                        {!notification.read ? <span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">New</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-stone-600">{notification.message}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                        <span>{formatRelativeIso(notification.createdAt)}</span>
                        <span>{notification.actionUrl ?? "Alert center"}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[1.3rem] bg-stone-50 p-4 text-sm text-stone-500">No customer notifications are available yet.</div>
            )}
          </div>
          <div className="mt-4 rounded-[1.3rem] bg-slate-100 p-4 text-xs text-slate-700">
            Enabled modules: {(tenantConfiguration?.enabledModules ?? []).join(", ") || "default runtime set"}
          </div>
          <div className="mt-4 rounded-[1.3rem] bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={16} />
              Restored alerts route live
            </div>
            <p className="mt-2 text-emerald-800">
              The dashboard bell and the restored customer shell now share this notification state, and unread alerts can be cleared directly from here.
            </p>
          </div>
        </section>
      </main>

      <CustomerBottomNav />
    </div>
  );
}
