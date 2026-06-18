import CrudWorkspace from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

export default function WebhookDeliveriesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "webhook-deliveries",
        title: "Webhook Deliveries",
        subtitle: "Delivery log — status, HTTP codes, retry attempts, response times",
        icon: Zap,
        accentColor: "text-yellow-600",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "subscriptionId", "event"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "Delivery ID" },
          { key: "subscriptionId", label: "Subscription" },
          { key: "event", label: "Event", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "httpStatus", label: "HTTP", render: (v) => String(v || "—") },
          { key: "attempts", label: "Attempts" },
          { key: "durationMs", label: "Duration", render: (v) => v ? `${v}ms` : "—" },
          { key: "createdAt", label: "Created", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
