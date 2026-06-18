import CrudWorkspace from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";

export default function PerformanceMetricsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "performancemetrics",
        title: "Performance Metrics",
        subtitle: "Per-endpoint P50/P95/P99 latency, RPS, compression savings, bandwidth optimization",
        icon: Activity,
        accentColor: "text-blue-700",
        idField: "endpoint",
        statusField: "endpoint",
        searchFields: ["endpoint"],
        apiBase: "/api/db/prometheus-dashboards",
        pageSize: 25,
        columns: [
          { key: "endpoint", label: "Endpoint", sortable: true },
          { key: "p50Ms", label: "P50ms", sortable: true },
          { key: "p95Ms", label: "P95ms" },
          { key: "p99Ms", label: "P99ms", sortable: true },
          { key: "rps", label: "RPS", sortable: true },
          { key: "cacheHitRate", label: "Cache Hit" },
          { key: "compressionSaving", label: "Savings" },
        ],
        fields: [],
      }}
    />
  );
}
