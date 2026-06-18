import CrudWorkspace from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";

export default function OtelConfigsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "otelconfigs",
        title: "OpenTelemetry",
        subtitle: "Distributed tracing configuration — OTLP exporters, sampling, instrumentation",
        icon: Activity,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "serviceName"],
        apiBase: "/api/db/prometheus-dashboards",
        pageSize: 25,
        columns: [
          { key: "serviceName", label: "Service", sortable: true },
          { key: "exporter", label: "Exporter", sortable: true },
          { key: "samplingRate", label: "Sample Rate", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
