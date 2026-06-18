import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Key } from "lucide-react";
const config: CrudConfig = {
  domainKey: "secrets-rotation", title: "Secrets Rotation",
  subtitle: "HashiCorp Vault integration with automated key rotation for DB, API, JWT, and TLS.",
  icon: Key, accentColor: "slate",
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
export default function SecretsRotationWorkspace() { return <CrudWorkspace config={config} />; }
