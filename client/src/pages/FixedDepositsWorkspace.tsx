import CrudWorkspace from "@/components/CrudWorkspace";
import { Landmark } from "lucide-react";

export default function FixedDepositsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "fixed-deposits",
        title: "Fixed Deposits",
        subtitle: "Tenor-based deposits — auto-rollover, early liquidation, interest payout options",
        icon: Landmark,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["customerName", "accountNumber", "currency"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "customerName", label: "Customer", sortable: true },
          { key: "accountNumber", label: "Account No" },
          { key: "principal", label: "Principal", sortable: true, render: (v, row) => `${row.currency} ${Number(v).toLocaleString()}` },
          { key: "tenor", label: "Tenor (days)", sortable: true },
          { key: "interestRate", label: "Rate %", sortable: true, render: (v) => `${v}%` },
          { key: "interestType", label: "Payout" },
          { key: "maturityDate", label: "Maturity", sortable: true },
          { key: "autoRollover", label: "Auto-Roll", render: (v) => v ? "Yes" : "No" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [
          { key: "customerName", label: "Customer", type: "text", required: true },
          { key: "principal", label: "Principal", type: "number", required: true },
          { key: "tenor", label: "Tenor (days)", type: "number", required: true },
          { key: "interestRate", label: "Rate %", type: "number", required: true },
        ],
      }}
    />
  );
}
