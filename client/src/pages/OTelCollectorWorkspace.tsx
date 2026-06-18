import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Radio } from "lucide-react";
const config: CrudConfig = {
  domainKey: "otel-collector", title: "OTel Collector",
  subtitle: "OpenTelemetry traces/metrics for 219 services — Jaeger + Prometheus + OpenSearch exporters.",
  icon: Radio, accentColor: "violet",
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
export default function OTelCollectorWorkspace() { return <CrudWorkspace config={config} />; }
