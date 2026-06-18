import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";
const config: CrudConfig = {
  domainKey: "apm-sentry", title: "APM & Sentry",
  subtitle: "Error tracking, performance monitoring, alerting — p50 12ms, p95 89ms, 0.94 Apdex.",
  icon: Activity, accentColor: "orange",
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
export default function APMSentryWorkspace() { return <CrudWorkspace config={config} />; }
