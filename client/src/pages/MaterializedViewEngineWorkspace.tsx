import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Gauge } from "lucide-react";

const config: CrudConfig = {
  domainKey: "materialized-views",
  title: "Materialized View Engine",
  subtitle: "Auto-refreshing materialized views for dashboards",
  icon: Gauge,
  accentColor: "purple",
  apiBase: "/api/db/materialized-views-perf",
  idField: "id",
  statusField: "status",
  searchFields: ["viewName"],
  fields: [
    { key: "viewName", label: "View", type: "text" },
    { key: "refreshIntervalSec", label: "Refresh (s)", type: "number" },
    { key: "lastRefreshMs", label: "Last Refresh (ms)", type: "number" },
    { key: "rowCount", label: "Rows", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "viewName", label: "View" },
    { key: "refreshIntervalSec", label: "Refresh (s)" },
    { key: "lastRefreshMs", label: "Last Refresh (ms)" },
    { key: "rowCount", label: "Rows" },
    { key: "status", label: "Status" }
  ],
};

export default function MaterializedViewEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
