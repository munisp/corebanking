import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileSearch } from "lucide-react";
const config: CrudConfig = {
  domainKey: "security-audit-logger", title: "Security Audit Logger",
  subtitle: "Centralized security event logging: auth, authz, data access, admin actions, compliance. SIEM export, immutable hash chain, 7-year retention.",
  icon: FileSearch, accentColor: "slate",
  fields: [
    { key: "eventType", label: "Event Type", type: "select", options: ["authentication", "authorization", "data_access", "transaction", "admin_action", "compliance"], required: true },
    { key: "actor", label: "Actor", type: "text", required: true },
    { key: "severity", label: "Severity", type: "select", options: ["info", "notice", "warning", "critical"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "eventType", label: "Type", sortable: true },
    { key: "subType", label: "Sub-Type" },
    { key: "actor", label: "Actor", sortable: true },
    { key: "channel", label: "Channel" },
    { key: "severity", label: "Severity", sortable: true },
    { key: "riskScore", label: "Risk" },
    { key: "timestamp", label: "Time", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/security-events",
};
export default function SecurityAuditLoggerWorkspace() { return <CrudWorkspace config={config} />; }
