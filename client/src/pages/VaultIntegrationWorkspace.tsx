import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Lock } from "lucide-react";

const config: CrudConfig = {
  domainKey: "vault-integration",
  title: "Vault Integration",
  subtitle: "HashiCorp Vault engine management",
  icon: Lock,
  accentColor: "purple",
  apiBase: "/api/db/vault-engines",
  idField: "id",
  statusField: "status",
  searchFields: ["path"],
  fields: [
    { key: "path", label: "Path", type: "text" },
    { key: "type", label: "Type", type: "text" },
    { key: "leases", label: "Leases", type: "number" },
    { key: "rotationsCompleted", label: "Rotations", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "path", label: "Path" },
    { key: "type", label: "Type" },
    { key: "leases", label: "Leases" },
    { key: "rotationsCompleted", label: "Rotations" },
    { key: "status", label: "Status" }
  ],
};

export default function VaultIntegrationWorkspace() {
  return <CrudWorkspace config={config} />;
}
