import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Code } from "lucide-react";
const config: CrudConfig = {
  domainKey: "developer-portal", title: "Developer Portal",
  subtitle: "API documentation, sandbox keys, SDK downloads, and webhook management.",
  icon: Code, accentColor: "sky",
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
export default function DeveloperPortalWorkspace() { return <CrudWorkspace config={config} />; }
