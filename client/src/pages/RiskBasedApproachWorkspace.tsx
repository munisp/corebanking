import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";
const config: CrudConfig = {
  domainKey: "risk-based-approach", title: "Risk-Based Approach Engine",
  subtitle: "ML-powered customer risk scoring — static factors (occupation, geography, PEP status) + dynamic factors (transaction patterns, alert history). Auto-tier assignment.",
  icon: Shield, accentColor: "purple",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "riskTier", label: "Risk Tier", type: "select", options: ["low", "medium", "high", "very_high"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "customerId", label: "Customer ID", sortable: true },
    { key: "staticScore", label: "Static Score" }, { key: "dynamicScore", label: "Dynamic Score" },
    { key: "totalScore", label: "Total Score", sortable: true }, { key: "riskTier", label: "Risk Tier", sortable: true },
    { key: "factors", label: "Factors" },
  ],
  idField: "id", statusField: "riskTier", searchFields: ["customerId", "riskTier"],
  apiBase: "/api/db/risk-scores",
};
export default function RiskBasedApproachWorkspace() { return <CrudWorkspace config={config} />; }
