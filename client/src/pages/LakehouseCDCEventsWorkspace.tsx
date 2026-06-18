import CrudWorkspace from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";

export default function LakehouseCDCEventsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "lakehousecdcevents",
        title: "Lakehouse CDC Events",
        subtitle: "Real-time CDC event stream from all banking domain services to lakehouse bronze tables",
        icon: Activity,
        accentColor: "text-emerald-700",
        idField: "eventId",
        statusField: "domain",
        searchFields: ["eventId", "eventType", "domain", "service"],
        apiBase: "/api/db/event-dedup-configs",
        pageSize: 25,
        columns: [
          { key: "eventId", label: "Event ID" },
          { key: "eventType", label: "Type", sortable: true },
          { key: "domain", label: "Domain", sortable: true },
          { key: "service", label: "Service", sortable: true },
          { key: "table", label: "Table" },
          { key: "schema", label: "Schema", sortable: true },
          { key: "kafkaTopic", label: "Kafka Topic" },
        ],
        fields: [],
      }}
    />
  );
}
