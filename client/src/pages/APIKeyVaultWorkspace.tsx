import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Key } from "lucide-react";
const config: CrudConfig = {
  domainKey: "api-key-vault", title: "API Key Vault",
  subtitle: "API key lifecycle: scoping, IP whitelisting, rate limiting, expiry management, usage analytics.",
  icon: Key, accentColor: "indigo",
  fields: [
    { key: "name", label: "Key Name", type: "text", required: true },
    { key: "scopes", label: "Scopes", type: "text" },
    { key: "rateLimit", label: "Rate Limit", type: "text" },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "keyPrefix", label: "Prefix" },
    { key: "tenantId", label: "Tenant" },
    { key: "rateLimit", label: "Rate Limit" },
    { key: "status", label: "Status", sortable: true },
    { key: "usageCount", label: "Usage" },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/api-keys",
};
export default function APIKeyVaultWorkspace() { return <CrudWorkspace config={config} />; }
