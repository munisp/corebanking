import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Gauge } from "lucide-react";
const config: CrudConfig = {
  domainKey: "load-test-runner", title: "Load Test Runner",
  subtitle: "k6 — 8 scenarios up to 500 VUs, SLA validation (p99 < 1s on 6/8 flows).",
  icon: Gauge, accentColor: "sky",
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
export default function LoadTestRunnerWorkspace() { return <CrudWorkspace config={config} />; }
