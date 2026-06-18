import CrudWorkspace from "@/components/CrudWorkspace";
import { RefreshCw } from "lucide-react";

export default function TBPGSyncConfigsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "tbpgsyncconfigs",
        title: "TB ↔ PG Sync Configs",
        subtitle: "TigerBeetle ↔ Postgres sync pipeline configurations — event-driven CDC sync via Kafka",
        icon: RefreshCw,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name", "direction", "postgresTable"],
        apiBase: "/api/db/tb-batch-configs",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "direction", label: "Direction", sortable: true },
          { key: "postgresTable", label: "PG Table" },
          { key: "kafkaTopic", label: "Kafka Topic" },
          { key: "batchSize", label: "Batch" },
          { key: "status", label: "Status", sortable: true },
          { key: "eventsProcessed", label: "Events", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
