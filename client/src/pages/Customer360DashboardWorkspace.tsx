import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Users } from "lucide-react";
const config: CrudConfig = {
  domainKey: "customer-360-dashboard", title: "Customer 360 Dashboard",
  subtitle: "Unified customer view — accounts, transactions, KYC, risk, interactions.",
  icon: Users, accentColor: "rose",
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
export default function Customer360DashboardWorkspace() { return <CrudWorkspace config={config} />; }
