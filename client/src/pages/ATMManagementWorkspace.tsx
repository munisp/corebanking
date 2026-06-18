import CrudWorkspace from "@/components/CrudWorkspace";
import { CreditCard } from "lucide-react";

export default function ATMManagementWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "atm-management",
        title: "ATM Management",
        subtitle: "Cash levels, uptime, fault tracking, replenishment scheduling (Go :8147)",
        icon: CreditCard,
        accentColor: "text-slate-700",
        idField: "id",
        statusField: "status",
        searchFields: ["terminalId", "location", "branch", "state"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "terminalId", label: "Terminal", sortable: true },
          { key: "location", label: "Location" },
          { key: "branch", label: "Branch", sortable: true },
          { key: "state", label: "State", sortable: true },
          { key: "type", label: "Type" },
          { key: "status", label: "Status", sortable: true },
          { key: "cashLevel", label: "Cash %", sortable: true, render: (v) => `${v}%` },
          { key: "cashBalance", label: "Cash", render: (v) => `₦${(Number(v)/1e6).toFixed(1)}M` },
          { key: "dailyTransactions", label: "Txns", sortable: true },
          { key: "uptime30d", label: "Uptime %", sortable: true, render: (v) => `${v}%` },
        ],
        fields: [],
      }}
    />
  );
}
