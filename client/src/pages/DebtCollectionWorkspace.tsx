import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { DollarSign } from "lucide-react";
const config: CrudConfig = {
  domainKey: "debt-collection", title: "Debt Collection",
  subtitle: "Automated debt recovery workflows with SMS/email/agent escalation.",
  icon: DollarSign, accentColor: "orange",
  fields: [
    { key: "id", label: "ID", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["active", "inactive", "pending"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/anomaly-models",
};
export default function DebtCollectionWorkspace() { return <CrudWorkspace config={config} />; }
