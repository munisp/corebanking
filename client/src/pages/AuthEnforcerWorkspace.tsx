import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Lock } from "lucide-react";
const config: CrudConfig = {
  domainKey: "auth-enforcer", title: "Auth Enforcer",
  subtitle: "JWT + RBAC enforcement across 805 routes with MFA, session management, and device fingerprinting.",
  icon: Lock, accentColor: "blue",
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
export default function AuthEnforcerWorkspace() { return <CrudWorkspace config={config} />; }
