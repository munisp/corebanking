import CrudWorkspace from "@/components/CrudWorkspace";
import { BarChart3 } from "lucide-react";

export default function PrometheusMetricsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "prometheusmetrics",
        title: "Prometheus Metrics",
        subtitle: "Request rates, latencies, business metrics, SLA tracking",
        icon: BarChart3,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "type",
        searchFields: ["id", "name", "category"],
        apiBase: "/api/db/prometheus-dashboards",
        pageSize: 25,
        columns: [
          { key: "name", label: "Metric", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "help", label: "Description" },
        ],
        fields: [],
      }}
    />
  );
}
