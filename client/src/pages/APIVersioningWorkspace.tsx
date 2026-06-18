import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { GitBranch } from "lucide-react";
const config: CrudConfig = {
  domainKey: "api-versioning", title: "API Versioning",
  subtitle: "URL-prefix versioning (v1/v2) with deprecation tracking and migration guides.",
  icon: GitBranch, accentColor: "purple",
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
export default function APIVersioningWorkspace() { return <CrudWorkspace config={config} />; }
