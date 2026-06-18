import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";
const config: CrudConfig = {
  domainKey: "connection-pooler", title: "Connection Pooler",
  subtitle: "PgBouncer transaction pooling (10K max), Redis cluster (6 nodes), Kafka producer pools.",
  icon: Zap, accentColor: "emerald",
  fields: [
    { key: "id", label: "ID", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["active", "inactive", "pending"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/anomaly-models",
};
export default function ConnectionPoolerWorkspace() { return <CrudWorkspace config={config} />; }
