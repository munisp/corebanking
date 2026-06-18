import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { AlertTriangle } from "lucide-react";

const config: CrudConfig = {
  domainKey: "incident-responder",
  title: "Incident Responder",
  subtitle: "Security incident response automation",
  icon: AlertTriangle,
  accentColor: "red",
  apiBase: "/api/db/incidents",
  idField: "id",
  statusField: "status",
  searchFields: ["title"],
  fields: [
    { key: "title", label: "Title", type: "text" },
    { key: "severity", label: "Severity", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "escalationLevel", label: "Escalation", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "title", label: "Title" },
    { key: "severity", label: "Severity" },
    { key: "category", label: "Category" },
    { key: "escalationLevel", label: "Escalation" },
    { key: "status", label: "Status" }
  ],
};

export default function IncidentResponderWorkspace() {
  return <CrudWorkspace config={config} />;
}
