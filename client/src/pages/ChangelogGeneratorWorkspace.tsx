import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";
const config: CrudConfig = {
  domainKey: "changelog-generator", title: "Changelog Generator",
  subtitle: "Conventional commits auto-changelog generation.",
  icon: FileText, accentColor: "gray",
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
export default function ChangelogGeneratorWorkspace() { return <CrudWorkspace config={config} />; }
