import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

const config: CrudConfig = {
  domainKey: "pgbouncer",
  title: "PgBouncer Pool Manager",
  subtitle: "Connection pooling with transaction mode",
  icon: Database,
  accentColor: "green",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["database"],
  fields: [
    { key: "database", label: "Database", type: "text" },
    { key: "poolMode", label: "Pool Mode", type: "text" },
    { key: "activeConnections", label: "Active", type: "number" },
    { key: "avgQueryMs", label: "Avg Query (ms)", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "database", label: "Database" },
    { key: "poolMode", label: "Pool Mode" },
    { key: "activeConnections", label: "Active" },
    { key: "avgQueryMs", label: "Avg Query (ms)" },
    { key: "status", label: "Status" }
  ],
};

export default function PgBouncerManagerWorkspace() {
  return <CrudWorkspace config={config} />;
}
