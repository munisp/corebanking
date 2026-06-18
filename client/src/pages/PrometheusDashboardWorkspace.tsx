import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BarChart2 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "prometheus-dashboard",
  title: "Prometheus Dashboard",
  subtitle: "P50/P95/P99 latency and throughput dashboards",
  icon: BarChart2,
  accentColor: "red",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["dashboard"],
  fields: [
    { key: "dashboard", label: "Dashboard", type: "text" },
    { key: "panels", label: "Panels", type: "number" },
    { key: "alertRules", label: "Alert Rules", type: "number" },
    { key: "dataSourceRetention", label: "Retention", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "dashboard", label: "Dashboard" },
    { key: "panels", label: "Panels" },
    { key: "alertRules", label: "Alert Rules" },
    { key: "dataSourceRetention", label: "Retention" },
    { key: "status", label: "Status" }
  ],
};

export default function PrometheusDashboardWorkspace() {
  return <CrudWorkspace config={config} />;
}
