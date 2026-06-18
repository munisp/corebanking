import CrudWorkspace from "@/components/CrudWorkspace";
import { BellRing } from "lucide-react";

export default function NotificationPreferencesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "notification-preferences",
        title: "Notification Preferences",
        subtitle: "Customer channel preferences — SMS, email, push, WhatsApp, in-app with quiet hours",
        icon: BellRing,
        accentColor: "text-pink-600",
        idField: "id",
        statusField: "language",
        searchFields: ["customerName", "customerId"],
        apiBase: "/api/db/customer-notifications",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "customerName", label: "Customer", sortable: true },
          { key: "customerId", label: "Customer ID" },
          { key: "language", label: "Language" },
          { key: "updatedAt", label: "Updated", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
