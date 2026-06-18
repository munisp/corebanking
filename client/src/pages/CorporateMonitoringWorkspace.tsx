import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Building2 } from "lucide-react";
const config: CrudConfig = {
  domainKey: "corporate-monitoring", title: "Ongoing Corporate Monitoring",
  subtitle: "Director change alerts, share structure changes, annual return overdue detection, financial deterioration signals, EFCC/investigation status tracking.",
  icon: Building2, accentColor: "slate",
  fields: [],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "companyId", label: "Company" },
    { key: "eventType", label: "Event Type", sortable: true }, { key: "riskImpact", label: "Risk Impact", sortable: true },
  ],
  idField: "id", statusField: "riskImpact", searchFields: ["companyId", "eventType"],
  apiBase: "/api/db/accounts",
};
export default function CorporateMonitoringWorkspace() { return <CrudWorkspace config={config} />; }
