import CrudWorkspace from "@/components/CrudWorkspace";
import { Smartphone } from "lucide-react";

export default function POSTerminalWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "pos-terminal",
        title: "POS Terminal Management",
        subtitle: "Merchant terminals — transaction volumes, card schemes, commissions (Go :8153)",
        icon: Smartphone,
        accentColor: "text-teal-700",
        idField: "id",
        statusField: "status",
        searchFields: ["merchantName", "terminalId", "location", "state"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "terminalId", label: "Terminal" },
          { key: "merchantName", label: "Merchant", sortable: true },
          { key: "location", label: "Location" },
          { key: "state", label: "State", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "model", label: "Model" },
          { key: "status", label: "Status", sortable: true },
          { key: "dailyTransactionCount", label: "Daily Txns", sortable: true },
          { key: "dailyVolume", label: "Daily Vol", sortable: true, render: (v) => `₦${(Number(v)/1e6).toFixed(1)}M` },
          { key: "commissionRate", label: "Commission %", render: (v) => `${v}%` },
        ],
        fields: [],
      }}
    />
  );
}
