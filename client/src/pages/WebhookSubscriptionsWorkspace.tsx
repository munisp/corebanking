import CrudWorkspace from "@/components/CrudWorkspace";
import { Radio } from "lucide-react";

export default function WebhookSubscriptionsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "webhook-subscriptions",
        title: "Webhook Subscriptions",
        subtitle: "Event-driven integrations — HMAC signed delivery with retry and backoff",
        icon: Radio,
        accentColor: "text-indigo-600",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "url", "events"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "url", label: "URL" },
          { key: "events", label: "Events", render: (v) => Array.isArray(v) ? v.length + " events" : "" },
          { key: "successCount", label: "Delivered", sortable: true, render: (v) => Number(v).toLocaleString() },
          { key: "failureCount", label: "Failed", sortable: true },
          { key: "status", label: "Status" },
          { key: "lastDeliveryAt", label: "Last Delivery" },
        ],
        fields: [
          { key: "name", label: "Name", type: "text", required: true },
          { key: "url", label: "Webhook URL", type: "text", required: true },
        ],
      }}
    />
  );
}
