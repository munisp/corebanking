import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Rocket } from "lucide-react";

const config: CrudConfig = {
  domainKey: "tenant-provisioning",
  title: "Tenant Provisioning",
  subtitle: "Automated tenant environment setup with 12-step pipeline",
  icon: Rocket,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "Job ID", sortable: true },
    { key: "tenantId", label: "Tenant ID", sortable: true },
    { key: "tenantName", label: "Tenant Name", sortable: true },
    { key: "plan", label: "Plan", sortable: true },
    { key: "region", label: "Region", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "totalDuration", label: "Duration", sortable: true },
  ],
  idField: "id",
  searchFields: ["id", "tenantId", "tenantName", "plan"],
  apiBase: "/api/db/tenants",
  pageSize: 25,
};

export default function TenantProvisioningWorkspace() {
  return <CrudWorkspace config={config} />;
}
