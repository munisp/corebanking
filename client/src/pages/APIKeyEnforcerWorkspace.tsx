import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Key } from "lucide-react";

const config: CrudConfig = {
  domainKey: "api-key-enforcer",
  title: "API Key Enforcer",
  subtitle: "API key policy enforcement",
  icon: Key,
  accentColor: "blue",
  apiBase: "/api/db/api-key-policies",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "prefix", label: "Prefix", type: "text" },
    { key: "rateLimit", label: "Rate Limit", type: "number" },
    { key: "activeKeys", label: "Active Keys", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "prefix", label: "Prefix" },
    { key: "rateLimit", label: "Rate Limit" },
    { key: "activeKeys", label: "Active Keys" },
    { key: "status", label: "Status" }
  ],
};

export default function APIKeyEnforcerWorkspace() {
  return <CrudWorkspace config={config} />;
}
