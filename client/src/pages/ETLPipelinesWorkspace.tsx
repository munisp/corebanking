import CrudWorkspace from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

export default function ETLPipelinesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "etl-pipelines",
        title: "ETL Pipelines",
        subtitle: "Data lake ingestion, aggregation, regulatory extracts, real-time streaming",
        icon: Database,
        accentColor: "text-cyan-600",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "source", "destination"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Pipeline ID" },
          { key: "name", label: "Pipeline Name", sortable: true },
          { key: "source", label: "Source" },
          { key: "destination", label: "Destination" },
          { key: "schedule", label: "Schedule" },
          { key: "recordsProcessed", label: "Records", render: (v) => Number(v).toLocaleString() },
          { key: "avgDurationMs", label: "Avg Duration", render: (v) => v ? `${(Number(v) / 1000).toFixed(1)}s` : "—" },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "name", label: "Pipeline Name", type: "text", required: true },
          { key: "source", label: "Source", type: "text", required: true },
          { key: "destination", label: "Destination", type: "text", required: true },
          { key: "schedule", label: "Cron Schedule", type: "text", required: true },
        ],
      }}
    />
  );
}
