import CrudWorkspace from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

export default function PgConnectionPoolsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "pgconnectionpools",
        title: "Connection Pools",
        subtitle: "PgBouncer connection pool monitoring — transaction/session mode, active/idle connections",
        icon: Layers,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name", "poolMode"],
        apiBase: "/api/db/pgbouncer-pools",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "poolMode", label: "Mode", sortable: true },
          { key: "activeConnections", label: "Active", sortable: true },
          { key: "idleConnections", label: "Idle", sortable: true },
          { key: "totalQueriesPerSec", label: "QPS", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
