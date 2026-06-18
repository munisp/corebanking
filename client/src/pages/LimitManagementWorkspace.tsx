import CrudWorkspace from "@/components/CrudWorkspace";
import { Gauge } from "lucide-react";

export default function LimitManagementWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "limit-management",
        title: "Transaction Limits",
        subtitle: "CBN-mandated daily/weekly/monthly limits by customer tier and channel",
        icon: Gauge,
        accentColor: "text-cyan-700",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "tier", "channel"],
        apiBase: "/api/db/settlements",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Limit Name", sortable: true },
          { key: "tier", label: "Tier", sortable: true },
          { key: "channel", label: "Channel", sortable: true },
          { key: "singleTransactionLimit", label: "Single Txn", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "dailyLimit", label: "Daily", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "weeklyLimit", label: "Weekly", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "monthlyLimit", label: "Monthly", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [
          { key: "name", label: "Limit Name", type: "text", required: true },
          { key: "tier", label: "Tier", type: "select", options: ["Tier 1", "Tier 2", "Tier 3", "Corporate", "Agent"], required: true },
          { key: "channel", label: "Channel", type: "select", options: ["mobile", "internet", "ussd", "pos", "atm", "branch", "api"], required: true },
        ],
      }}
    />
  );
}
