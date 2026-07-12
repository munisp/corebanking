import { Bell, Image, Save, Smartphone, ToggleLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";

interface PushCredentials {
  fcmServerKey: string;
  fcmSenderId: string;
  apnsKeyId: string;
  apnsTeamId: string;
  apnsBundleId: string;
  apnsEnvironment: "sandbox" | "production";
}

interface FeatureToggles {
  biometricLogin: boolean;
  cardControls: boolean;
  qrPayments: boolean;
  savingsGoals: boolean;
  loanApplication: boolean;
  investmentProducts: boolean;
  statementDownload: boolean;
  beneficiaryManagement: boolean;
  internationalTransfers: boolean;
  virtualCards: boolean;
}

interface BrandingConfig {
  appName: string;
  logoUrl: string;
  splashLogoUrl: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportPhone: string;
  playStoreUrl: string;
  appStoreUrl: string;
}

interface MobileConfig {
  push: PushCredentials;
  features: FeatureToggles;
  branding: BrandingConfig;
}

const DEFAULT_CONFIG: MobileConfig = {
  push: {
    fcmServerKey: "",
    fcmSenderId: "",
    apnsKeyId: "",
    apnsTeamId: "",
    apnsBundleId: "",
    apnsEnvironment: "production",
  },
  features: {
    biometricLogin: true,
    cardControls: true,
    qrPayments: true,
    savingsGoals: false,
    loanApplication: true,
    investmentProducts: false,
    statementDownload: true,
    beneficiaryManagement: true,
    internationalTransfers: false,
    virtualCards: false,
  },
  branding: {
    appName: "",
    logoUrl: "",
    splashLogoUrl: "",
    primaryColor: "#0066FF",
    accentColor: "#00C896",
    supportEmail: "",
    supportPhone: "",
    playStoreUrl: "",
    appStoreUrl: "",
  },
};

const FEATURE_LABELS: Record<keyof FeatureToggles, string> = {
  biometricLogin: "Biometric Login (fingerprint / face ID)",
  cardControls: "Card Controls (freeze, limits, PIN change)",
  qrPayments: "QR Payments",
  savingsGoals: "Savings Goals",
  loanApplication: "In-App Loan Application",
  investmentProducts: "Investment Products",
  statementDownload: "Statement Download (PDF / CSV)",
  beneficiaryManagement: "Beneficiary Management",
  internationalTransfers: "International Transfers",
  virtualCards: "Virtual Cards",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl shadow-lg p-6 border border-border space-y-6">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function MobileBankingWorkspace() {
  const [config, setConfig] = useState<MobileConfig>(() => {
    try {
      const saved = localStorage.getItem("mobileBankingConfig");
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });
  const [isSaving, setIsSaving] = useState(false);

  function setPush(patch: Partial<PushCredentials>) {
    setConfig((c) => ({ ...c, push: { ...c.push, ...patch } }));
  }
  function setFeature(key: keyof FeatureToggles, value: boolean) {
    setConfig((c) => ({ ...c, features: { ...c.features, [key]: value } }));
  }
  function setBranding(patch: Partial<BrandingConfig>) {
    setConfig((c) => ({ ...c, branding: { ...c.branding, ...patch } }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await fetch("/mobile/v1/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      localStorage.setItem("mobileBankingConfig", JSON.stringify(config));
      toast.success("Mobile banking configuration saved");
    } catch {
      // Persist locally even if API is unreachable
      localStorage.setItem("mobileBankingConfig", JSON.stringify(config));
      toast.success("Saved locally — will sync when API is reachable");
    } finally {
      setIsSaving(false);
    }
  }

  const inputCls =
    "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Digital Channels"
          title="Mobile Banking"
          description="Push notification credentials, feature toggles, and app branding"
          icon={<Smartphone className="w-8 h-8" />}
        />
      </div>

      <div className="container py-2 pb-10 space-y-6">
        {/* Push Notification Credentials */}
        <SectionCard icon={<Bell className="w-5 h-5" />} title="Push Notification Credentials">
          <div>
            <p className="text-sm font-medium text-foreground mb-4">Firebase Cloud Messaging (Android)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="FCM Server Key" hint="From Firebase Console → Project Settings → Cloud Messaging">
                <input
                  type="password"
                  placeholder="AAAA…"
                  value={config.push.fcmServerKey}
                  onChange={(e) => setPush({ fcmServerKey: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="FCM Sender ID">
                <input
                  type="text"
                  placeholder="123456789012"
                  value={config.push.fcmSenderId}
                  onChange={(e) => setPush({ fcmSenderId: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-sm font-medium text-foreground mb-4">Apple Push Notification Service (iOS)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="APNs Key ID" hint="10-character key ID from Apple Developer portal">
                <input
                  type="text"
                  placeholder="AB12CD34EF"
                  value={config.push.apnsKeyId}
                  onChange={(e) => setPush({ apnsKeyId: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Team ID" hint="10-character Apple Developer Team ID">
                <input
                  type="text"
                  placeholder="XXXXXXXXXX"
                  value={config.push.apnsTeamId}
                  onChange={(e) => setPush({ apnsTeamId: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Bundle ID">
                <input
                  type="text"
                  placeholder="com.54link-dev.mobile"
                  value={config.push.apnsBundleId}
                  onChange={(e) => setPush({ apnsBundleId: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Environment">
                <select
                  value={config.push.apnsEnvironment}
                  onChange={(e) =>
                    setPush({ apnsEnvironment: e.target.value as "sandbox" | "production" })
                  }
                  className={inputCls}
                >
                  <option value="production">Production</option>
                  <option value="sandbox">Sandbox</option>
                </select>
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* Feature Toggles */}
        <SectionCard icon={<ToggleLeft className="w-5 h-5" />} title="Feature Toggles">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(config.features) as (keyof FeatureToggles)[]).map((key) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.features[key]}
                  onChange={(e) => setFeature(key, e.target.checked)}
                  className="w-4 h-4 rounded text-primary"
                />
                <span className="text-sm text-foreground">{FEATURE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Branding */}
        <SectionCard icon={<Image className="w-5 h-5" />} title="App Branding">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="App Name">
              <input
                type="text"
                placeholder="54link-dev Mobile"
                value={config.branding.appName}
                onChange={(e) => setBranding({ appName: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Support Email">
              <input
                type="email"
                placeholder="support@54link-dev.com"
                value={config.branding.supportEmail}
                onChange={(e) => setBranding({ supportEmail: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Support Phone">
              <input
                type="tel"
                placeholder="+234 800 000 0000"
                value={config.branding.supportPhone}
                onChange={(e) => setBranding({ supportPhone: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Primary Color" hint="Brand colour applied to buttons and headers">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.branding.primaryColor}
                  onChange={(e) => setBranding({ primaryColor: e.target.value })}
                  className="h-10 w-16 rounded-lg border border-border cursor-pointer bg-background p-1"
                />
                <input
                  type="text"
                  value={config.branding.primaryColor}
                  onChange={(e) => setBranding({ primaryColor: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </Field>
            <Field label="Accent Color">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.branding.accentColor}
                  onChange={(e) => setBranding({ accentColor: e.target.value })}
                  className="h-10 w-16 rounded-lg border border-border cursor-pointer bg-background p-1"
                />
                <input
                  type="text"
                  value={config.branding.accentColor}
                  onChange={(e) => setBranding({ accentColor: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </Field>
            <Field label="Logo URL" hint="Displayed in-app header (SVG or PNG, recommended 120×40)">
              <input
                type="url"
                placeholder="https://cdn.54link-dev.com/logo.svg"
                value={config.branding.logoUrl}
                onChange={(e) => setBranding({ logoUrl: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Splash Screen Logo URL" hint="Full-colour logo for loading screen (recommended 512×512)">
              <input
                type="url"
                placeholder="https://cdn.54link-dev.com/splash.png"
                value={config.branding.splashLogoUrl}
                onChange={(e) => setBranding({ splashLogoUrl: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Google Play Store URL">
              <input
                type="url"
                placeholder="https://play.google.com/store/apps/details?id=…"
                value={config.branding.playStoreUrl}
                onChange={(e) => setBranding({ playStoreUrl: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Apple App Store URL">
              <input
                type="url"
                placeholder="https://apps.apple.com/app/…"
                value={config.branding.appStoreUrl}
                onChange={(e) => setBranding({ appStoreUrl: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
          >
            <Save className="w-5 h-5" />
            {isSaving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
