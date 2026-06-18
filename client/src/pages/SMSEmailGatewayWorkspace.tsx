import CrudWorkspace from "@/components/CrudWorkspace";
import { Mail } from "lucide-react";

export default function SMSEmailGatewayWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "sms-email-gateway",
        title: "Messaging Gateway",
        subtitle: "SMS, email, WhatsApp, push — delivery tracking, templates, retry (Go :8144)",
        icon: Mail,
        accentColor: "text-blue-600",
        idField: "id",
        statusField: "status",
        searchFields: ["recipient", "channel", "templateId"],
        apiBase: "/api/db/sms-alert-notification",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "channel", label: "Channel", sortable: true },
          { key: "recipient", label: "Recipient" },
          { key: "templateId", label: "Template" },
          { key: "status", label: "Status", sortable: true },
          { key: "retryCount", label: "Retries" },
          { key: "cost", label: "Cost (₦)", sortable: true },
          { key: "sentAt", label: "Sent", sortable: true },
          { key: "deliveredAt", label: "Delivered" },
          { key: "failReason", label: "Fail Reason" },
        ],
        fields: [],
      }}
    />
  );
}
