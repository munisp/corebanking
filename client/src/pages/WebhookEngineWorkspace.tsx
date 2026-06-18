import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Webhook } from "lucide-react";

const config: CrudConfig = {
  domainKey: "webhook-engine",
  title: "Webhook Engine",
  subtitle: "Tenant-configurable webhooks with retry, HMAC signing, delivery tracking, and payload filtering",
  icon: Webhook,
  accentColor: "blue",
  fields: [],
  columns: [
    { key: "id", label: "Endpoint ID", sortable: true },
    { key: "tenantId", label: "Tenant", sortable: true },
    { key: "url", label: "URL", sortable: true },
    { key: "active", label: "Active", sortable: true },
    { key: "version", label: "API Version", sortable: false },
    { key: "createdAt", label: "Created", sortable: true },
  ],
  idField: "id",
  searchFields: ["id", "tenantId", "url", "active"],
  apiBase: "/api/db/transfers",
  pageSize: 25,
};

export default function WebhookEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
