import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

const config: CrudConfig = {
  domainKey: "read-replica",
  title: "Read Replica Router",
  subtitle: "Query routing to PostgreSQL read replicas",
  icon: Database,
  accentColor: "purple",
  apiBase: "/api/db/read-replica-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["replicaHost"],
  fields: [
    { key: "replicaHost", label: "Replica", type: "text" },
    { key: "lagMs", label: "Lag (ms)", type: "number" },
    { key: "queriesRouted24h", label: "Queries 24h", type: "number" },
    { key: "loadPct", label: "Load %", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "replicaHost", label: "Replica" },
    { key: "lagMs", label: "Lag (ms)" },
    { key: "queriesRouted24h", label: "Queries 24h" },
    { key: "loadPct", label: "Load %" },
    { key: "status", label: "Status" }
  ],
};

export default function ReadReplicaRouterWorkspace() {
  return <CrudWorkspace config={config} />;
}
