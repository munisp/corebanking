import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Eye } from "lucide-react";
const config: CrudConfig = {
  domainKey: "accessibility-auditor", title: "Accessibility Auditor",
  subtitle: "WCAG 2.1 AA compliance audit across 355 PWA pages.",
  icon: Eye, accentColor: "pink",
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
export default function AccessibilityAuditorWorkspace() { return <CrudWorkspace config={config} />; }
