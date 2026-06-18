import { Database } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "db-admin",
  title: "Database Administration",
  subtitle: "PostgreSQL persistence — migrations, table schemas, connection pool management",
  icon: Database,
  accentColor: "slate",
  fields: [
    { key: "id", label: "Migration ID", type: "readonly" },
    { key: "version", label: "Version", type: "readonly" },
    { key: "name", label: "Migration Name", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "Migration ID" },
    { key: "version", label: "Version" },
    { key: "name", label: "Migration Name" },
    { key: "service", label: "Service" },
    { key: "status", label: "Status" },
    { key: "appliedAt", label: "Applied At" },
    { key: "durationMs", label: "Duration (ms)" },
  ],
  idField: "id",
  searchFields: ["id", "name", "service"],
  apiBase: "/api/db/accounts",
};

export default function DBAdminWorkspace() {
  return <CrudWorkspace config={config} />;
}
