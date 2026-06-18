import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BarChart2 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "aml-compliance-dashboard",
  title: "AML Compliance Dashboard",
  subtitle: "Real-time compliance metrics — screenings, filings, scores",
  icon: BarChart2,
  accentColor: "blue",
  apiBase: "/api/db/aml-compliance-metrics",
  idField: "id",
  statusField: "status",
  searchFields: ["period"],
  fields: [
    { key: "period", label: "Period", type: "text" },
    { key: "totalScreenings", label: "Screenings", type: "number" },
    { key: "sarsFiled", label: "SARs", type: "number" },
    { key: "ctrsFiled", label: "CTRs", type: "number" },
    { key: "complianceScore", label: "Score", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "period", label: "Period" },
    { key: "totalScreenings", label: "Screenings" },
    { key: "sarsFiled", label: "SARs" },
    { key: "ctrsFiled", label: "CTRs" },
    { key: "complianceScore", label: "Score" },
    { key: "status", label: "Status" }
  ],
};

export default function AMLComplianceDashboardWorkspace() {
  return <CrudWorkspace config={config} />;
}
