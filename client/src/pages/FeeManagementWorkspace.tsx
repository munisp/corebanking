import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Receipt } from "lucide-react";
const config: CrudConfig = {
  domainKey: "fee-management", title: "Fee Management",
  subtitle: "Fee schedules, charge computation, waiver workflows, and revenue tracking.",
  icon: Receipt, accentColor: "blue",
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
export default function FeeManagementWorkspace() { return <CrudWorkspace config={config} />; }
