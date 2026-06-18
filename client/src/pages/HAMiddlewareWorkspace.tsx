import CrudWorkspace from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

export default function HAMiddlewareWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "hamiddleware",
        title: "HA Middleware",
        subtitle: "Postgres, Redis, Kafka, TigerBeetle, OpenSearch, Keycloak, Temporal, APISIX replication and failover",
        icon: Database,
        accentColor: "text-blue-700",
        idField: "name",
        statusField: "status",
        searchFields: ["name", "type", "mode"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "replicas", label: "Replicas" },
          { key: "mode", label: "Mode", sortable: true },
          { key: "failoverTimeMs", label: "Failover ms" },
          { key: "rpo", label: "RPO" },
          { key: "rto", label: "RTO" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
