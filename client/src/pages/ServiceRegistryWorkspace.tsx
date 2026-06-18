import CrudWorkspace from "@/components/CrudWorkspace";
import { Server } from "lucide-react";

export default function ServiceRegistryWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "serviceregistry",
        title: "Service Registry",
        subtitle: "Live service mesh — 186 microservices health, circuit breaker states, response times",
        icon: Server,
        accentColor: "text-emerald-700",
        idField: "name",
        statusField: "status",
        searchFields: ["name", "language"],
        apiBase: "/api/db/grpc-services",
        pageSize: 25,
        columns: [
          { key: "name", label: "Service", sortable: true },
          { key: "language", label: "Lang", sortable: true },
          { key: "port", label: "Port" },
          { key: "status", label: "Status", sortable: true },
          { key: "responseTimeMs", label: "Response ms", sortable: true },
          { key: "circuitState", label: "Circuit", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
