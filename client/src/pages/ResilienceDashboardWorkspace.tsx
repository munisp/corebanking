import CrudWorkspace from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";

export default function ResilienceDashboardWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "resilience-dashboard",
        title: "Resilience Dashboard",
        subtitle: "Unified view of all channels: web, mobile, USSD, SMS, agent POS",
        icon: Activity,
        accentColor: "text-teal-700",
        idField: "channel",
        statusField: "status",
        searchFields: ["channel"],
        apiBase: "/api/db/incidents",
        pageSize: 25,
        columns: [
          { key: "channel", label: "Channel", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "users", label: "Users", sortable: true },
          { key: "latency", label: "Latency", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
