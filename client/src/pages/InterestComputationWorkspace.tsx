import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Calculator } from "lucide-react";
const config: CrudConfig = {
  domainKey: "interest-computation", title: "Interest Computation",
  subtitle: "Daily/monthly accrual engine for savings, loans, FD, and treasury products.",
  icon: Calculator, accentColor: "emerald",
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
export default function InterestComputationWorkspace() { return <CrudWorkspace config={config} />; }
