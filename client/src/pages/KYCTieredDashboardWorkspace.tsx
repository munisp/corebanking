import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldCheck } from "lucide-react";
const config: CrudConfig = {
  domainKey: "kyc-tiered-dashboard", title: "CBN Tiered KYC Dashboard",
  subtitle: "CBN 3-tier KYC system — Tier 1 (₦300K/day), Tier 2 (₦5M/day), Tier 3 (unlimited). Auto-downgrade on document expiry, real-time limit enforcement.",
  icon: ShieldCheck, accentColor: "emerald",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "currentTier", label: "Current Tier", type: "select", options: ["1", "2", "3"] },
    { key: "status", label: "Status", type: "select", options: ["active", "review_pending", "downgrade_pending"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "customerName", label: "Customer", sortable: true },
    { key: "currentTier", label: "Tier", sortable: true }, { key: "dailyLimitNGN", label: "Daily Limit (₦)" },
    { key: "dailyUsedNGN", label: "Used Today (₦)" }, { key: "evaluationScore", label: "Score" },
    { key: "status", label: "Status", sortable: true }, { key: "riskFlags", label: "Risk Flags" },
  ],
  idField: "id", statusField: "status", searchFields: ["customerName", "customerId", "status"],
  apiBase: "/api/db/kyc-tiers",
};
export default function KYCTieredDashboardWorkspace() { return <CrudWorkspace config={config} />; }
