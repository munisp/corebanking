import CrudWorkspace from "@/components/CrudWorkspace";
import { Fingerprint } from "lucide-react";

export default function IdempotencyDashboardWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "idempotencydashboard",
        title: "Idempotency Dashboard",
        subtitle: "Request deduplication, SHA-256 fingerprinting, per-tenant TTL, duplicate prevention (Go :8261)",
        icon: Fingerprint,
        accentColor: "text-blue-700",
        idField: "key",
        statusField: "method",
        searchFields: ["key", "endpoint", "tenantId"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "key", label: "Key", sortable: true },
          { key: "method", label: "Method" },
          { key: "endpoint", label: "Endpoint", sortable: true },
          { key: "tenantId", label: "Tenant", sortable: true },
          { key: "statusCode", label: "Status" },
          { key: "hitCount", label: "Hits", sortable: true },
          { key: "createdAt", label: "Created" },
          { key: "expiresAt", label: "Expires" },
        ],
        fields: [],
      }}
    />
  );
}
