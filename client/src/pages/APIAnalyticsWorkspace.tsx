import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BarChart3 } from "lucide-react";
const config: CrudConfig = {
  domainKey: "api-analytics", title: "API Analytics",
  subtitle: "Usage analytics, endpoint popularity, error rates, and developer insights.",
  icon: BarChart3, accentColor: "indigo",
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
export default function APIAnalyticsWorkspace() { return <CrudWorkspace config={config} />; }
