import { Shield } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "permify-authz",
  title: "Authorization Engine",
  subtitle: "Permify fine-grained RBAC/ABAC/ReBAC — roles, policies, permission checks",
  icon: Shield,
  accentColor: "bg-red-700",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "name", "description"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "name", label: "Role Name", type: "text", required: true },
    { key: "description", label: "Description", type: "text" },
    { key: "priority", label: "Priority", type: "number", defaultValue: 50 },
  ],
  columns: [
    { key: "id", label: "Role ID" },
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    { key: "priority", label: "Priority" },
    { key: "permissions", label: "Permissions", render: (v) => Array.isArray(v) ? v.length.toString() : "0" },
  ],
  actions: [],
};

export default function PermifyWorkspace() {
  return <CrudWorkspace config={config} />;
}
