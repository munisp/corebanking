import CrudWorkspace from "@/components/CrudWorkspace";
import { BarChart3 } from "lucide-react";

export default function ErrorTelemetryWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "errortelemetry",
        title: "Error Telemetry",
        subtitle: "Real-time error aggregation, rate tracking, domain breakdown, P50/P99 latency",
        icon: BarChart3,
        accentColor: "text-blue-700",
        idField: "period",
        statusField: "period",
        searchFields: ["period"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "period", label: "Period", sortable: true },
          { key: "errors", label: "Errors", sortable: true },
          { key: "retries", label: "Retries" },
          { key: "successes", label: "Successes" },
          { key: "circuitBreaks", label: "CB Trips" },
        ],
        fields: [],
      }}
    />
  );
}
