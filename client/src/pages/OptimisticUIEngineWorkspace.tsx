import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "optimistic-ui",
  title: "Optimistic UI Engine",
  subtitle: "Zero-latency optimistic UI mutations",
  icon: Zap,
  accentColor: "green",
  apiBase: "/api/db/optimistic-ui-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["action"],
  fields: [
    { key: "action", label: "Action", type: "text" },
    { key: "endpoint", label: "Endpoint", type: "text" },
    { key: "successRate", label: "Success Rate", type: "text" },
    { key: "perceivedLatencyMs", label: "Perceived (ms)", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "action", label: "Action" },
    { key: "endpoint", label: "Endpoint" },
    { key: "successRate", label: "Success Rate" },
    { key: "perceivedLatencyMs", label: "Perceived (ms)" },
    { key: "status", label: "Status" }
  ],
};

export default function OptimisticUIEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
