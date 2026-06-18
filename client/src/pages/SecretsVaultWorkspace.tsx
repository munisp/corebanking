import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Lock } from "lucide-react";

const config: CrudConfig = {
  domainKey: "secrets-vault",
  title: "Secrets Vault Manager",
  subtitle: "HashiCorp Vault integration for secrets",
  icon: Lock,
  accentColor: "purple",
  apiBase: "/api/db/vault-secrets",
  idField: "id",
  statusField: "status",
  searchFields: ["path"],
  fields: [
    { key: "path", label: "Path", type: "text" },
    { key: "engine", label: "Engine", type: "text" },
    { key: "version", label: "Version", type: "number" },
    { key: "rotationDays", label: "Rotation Days", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "path", label: "Path" },
    { key: "engine", label: "Engine" },
    { key: "version", label: "Version" },
    { key: "rotationDays", label: "Rotation Days" },
    { key: "status", label: "Status" }
  ],
};

export default function SecretsVaultWorkspace() {
  return <CrudWorkspace config={config} />;
}
