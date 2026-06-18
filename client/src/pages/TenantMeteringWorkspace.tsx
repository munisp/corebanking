import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BarChart3 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "tenant-metering",
  title: "Tenant Metering & Billing",
  subtitle: "Usage metering per tenant: API calls, transactions, storage, bandwidth, and compute minutes",
  icon: BarChart3,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "tenantId", label: "Tenant", sortable: true },
    { key: "period", label: "Period", sortable: true },
    { key: "apiCallsCount", label: "API Calls", sortable: true },
    { key: "transactionsCount", label: "Transactions", sortable: true },
    { key: "storageMB", label: "Storage (MB)", sortable: true },
    { key: "activeUsers", label: "Active Users", sortable: true },
    { key: "bandwidthMB", label: "Bandwidth (MB)", sortable: true },
  ],
  idField: "tenantId",
  searchFields: ["tenantId", "period", "apiCallsCount", "transactionsCount"],
  apiBase: "/api/db/tenants",
  pageSize: 25,
};

export default function TenantMeteringWorkspace() {
  return <CrudWorkspace config={config} />;
}
