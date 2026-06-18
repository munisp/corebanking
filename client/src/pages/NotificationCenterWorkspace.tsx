import CrudWorkspace from "@/components/CrudWorkspace";
import { Bell } from "lucide-react";

export default function NotificationCenterWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "notificationcenter",
        title: "Notification Center",
        subtitle: "Push, in-app, SMS, email, WhatsApp, USSD notifications with severity routing (Python :8262)",
        icon: Bell,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "severity",
        searchFields: ["type", "channel", "title"],
        apiBase: "/api/db/customer-notifications",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "type", label: "Type", sortable: true },
          { key: "channel", label: "Channel", sortable: true },
          { key: "title", label: "Title" },
          { key: "severity", label: "Severity", sortable: true },
          { key: "sentAt", label: "Sent" },
          { key: "read", label: "Read" },
        ],
        fields: [],
      }}
    />
  );
}
