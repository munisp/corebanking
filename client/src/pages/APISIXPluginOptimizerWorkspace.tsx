import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Settings } from "lucide-react";

const config: CrudConfig = {
  domainKey: "apisix-plugin",
  title: "APISIX Plugin Optimizer",
  subtitle: "Conditional plugin chain optimization",
  icon: Settings,
  accentColor: "green",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["route"],
  fields: [
    { key: "route", label: "Route", type: "text" },
    { key: "avgLatencyMs", label: "Latency (ms)", type: "number" },
    { key: "latencySaving", label: "Saving", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "route", label: "Route" },
    { key: "avgLatencyMs", label: "Latency (ms)" },
    { key: "latencySaving", label: "Saving" },
    { key: "status", label: "Status" }
  ],
};

export default function APISIXPluginOptimizerWorkspace() {
  return <CrudWorkspace config={config} />;
}
