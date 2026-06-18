import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BarChart3 } from "lucide-react";
const config: CrudConfig = {
  domainKey: "kyc-analytics-dash", title: "KYC Analytics Dashboard",
  subtitle: "Onboarding funnel analysis, drop-off rates, geographic heatmap, channel breakdown (PWA/Flutter/Agent), rejection reason tracking.",
  icon: BarChart3, accentColor: "sky",
  fields: [],
  columns: [
    { key: "onboardingFunnel", label: "Funnel" }, { key: "avgOnboardingTime", label: "Avg Time" },
    { key: "channelBreakdown", label: "Channels" }, { key: "rejectionReasons", label: "Rejection Reasons" },
  ],
  idField: "id", searchFields: [],
  apiBase: "/api/db/kyc-data-quality-metrics",
};
export default function KYCAnalyticsDashWorkspace() { return <CrudWorkspace config={config} />; }
