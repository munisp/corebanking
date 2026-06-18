import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Server } from "lucide-react";

const config: CrudConfig = {
  domainKey: "tenant-isolation",
  title: "Tenant Data Isolation",
  subtitle: "PostgreSQL row-level security policies, per-tenant schemas, and cross-tenant violation detection",
  icon: Server,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "Policy ID", sortable: true },
    { key: "tableName", label: "Table", sortable: true },
    { key: "policyName", label: "Policy Name", sortable: true },
    { key: "policyType", label: "Type", sortable: true },
    { key: "command", label: "Command", sortable: true },
    { key: "tenantCol", label: "Tenant Column", sortable: false },
    { key: "enabled", label: "Enabled", sortable: true },
  ],
  idField: "id",
  searchFields: ["id", "tableName", "policyName", "policyType"],
  apiBase: "/api/db/tenants",
  pageSize: 25,
};

export default function TenantIsolationWorkspace() {
  return <CrudWorkspace config={config} />;
}
