import CrudWorkspace from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";

export default function TBPGSyncEventsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "tbpgsyncevents",
        title: "TB ↔ PG Sync Events",
        subtitle: "Recent sync events between TigerBeetle and Postgres — transfers, account creations, GL postings",
        icon: Activity,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "eventType", "sourceEntity", "targetEntity"],
        apiBase: "/api/db/tb-batch-configs",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "direction", label: "Direction", sortable: true },
          { key: "eventType", label: "Type", sortable: true },
          { key: "sourceEntity", label: "Source" },
          { key: "targetEntity", label: "Target" },
          { key: "status", label: "Status", sortable: true },
          { key: "latencyMs", label: "Latency ms", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
