import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Database } from "lucide-react";
const config: CrudConfig = {
  domainKey: "db-migration-manager", title: "DB Migration Manager",
  subtitle: "Drizzle migration tracking — 9 applied, 6 pending covering 35 new domain tables.",
  icon: Database, accentColor: "cyan",
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
export default function DBMigrationManagerWorkspace() { return <CrudWorkspace config={config} />; }
