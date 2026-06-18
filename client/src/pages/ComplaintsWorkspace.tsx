import CrudWorkspace from "@/components/CrudWorkspace";
import { MessageSquare } from "lucide-react";

export default function ComplaintsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "complaints",
        title: "Customer Complaints",
        subtitle: "CBN-mandated complaint resolution — SLA tracking, escalation, NPS scoring",
        icon: MessageSquare,
        accentColor: "text-rose-700",
        idField: "id",
        statusField: "status",
        searchFields: ["customerName", "subject", "category", "assignedTo"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "customerName", label: "Customer", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "subject", label: "Subject" },
          { key: "channel", label: "Channel" },
          { key: "priority", label: "Priority", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "assignedTo", label: "Assigned To" },
          { key: "slaHours", label: "SLA (h)" },
          { key: "hoursElapsed", label: "Elapsed (h)", sortable: true },
          { key: "slaBreach", label: "Breach", render: (v) => v ? "⚠ YES" : "No" },
        ],
        fields: [
          { key: "customerName", label: "Customer", type: "text", required: true },
          { key: "category", label: "Category", type: "select", options: ["transaction", "card", "loan", "account", "service", "fraud", "charges", "digital_channel"], required: true },
          { key: "subject", label: "Subject", type: "text", required: true },
          { key: "priority", label: "Priority", type: "select", options: ["low", "medium", "high", "critical"], required: true },
        ],
      }}
    />
  );
}
