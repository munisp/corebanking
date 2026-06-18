import CrudWorkspace from "@/components/CrudWorkspace";
import { LayoutDashboard } from "lucide-react";

export default function GrafanaDashboardsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "grafanadashboards",
        title: "Grafana Dashboards",
        subtitle: "Pre-built dashboards — platform overview, banking ops, infrastructure, security, compliance",
        icon: LayoutDashboard,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "category",
        searchFields: ["id", "title", "category"],
        apiBase: "/api/db/prometheus-dashboards",
        pageSize: 25,
        columns: [
          { key: "title", label: "Dashboard", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "panels", label: "Panels", sortable: true },
          { key: "refreshInterval", label: "Refresh", sortable: true },
          { key: "timeRange", label: "Range" },
        ],
        fields: [],
      }}
    />
  );
}
