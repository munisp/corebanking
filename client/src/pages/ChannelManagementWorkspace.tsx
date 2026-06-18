import CrudWorkspace from "@/components/CrudWorkspace";
import { Radio } from "lucide-react";

export default function ChannelManagementWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "channel-management",
        title: "Channel Management",
        subtitle: "Mobile, internet, USSD, ATM, POS, branch, agent — real-time status & volumes",
        icon: Radio,
        accentColor: "text-fuchsia-700",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "type", "status"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Channel", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "uptime30d", label: "Uptime %", sortable: true, render: (v) => `${v}%` },
          { key: "currentTPS", label: "TPS", sortable: true },
          { key: "dailyTransactions", label: "Daily Txns", sortable: true, render: (v) => Number(v).toLocaleString() },
          { key: "dailyVolume", label: "Daily Vol", sortable: true, render: (v) => `₦${(Number(v) / 1e9).toFixed(1)}B` },
          { key: "activeUsers", label: "Active Users", sortable: true, render: (v) => Number(v).toLocaleString() },
        ],
        fields: [],
      }}
    />
  );
}
