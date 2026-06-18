import CrudWorkspace from "@/components/CrudWorkspace";
import { ArrowLeftRight } from "lucide-react";

export default function InterbankSettlementWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "interbank-settlement",
        title: "Interbank Settlement",
        subtitle: "NIBSS clearing — NIP, NEFT, RTGS, card switch, cheque clearing, direct debit",
        icon: ArrowLeftRight,
        accentColor: "text-blue-800",
        idField: "id",
        statusField: "status",
        searchFields: ["type", "window", "settlementDate"],
        apiBase: "/api/db/settlements",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "type", label: "Type", sortable: true },
          { key: "settlementDate", label: "Date", sortable: true },
          { key: "window", label: "Window" },
          { key: "totalInbound", label: "Inbound", sortable: true, render: (v) => `₦${(Number(v) / 1e9).toFixed(1)}B` },
          { key: "totalOutbound", label: "Outbound", render: (v) => `₦${(Number(v) / 1e9).toFixed(1)}B` },
          { key: "netPosition", label: "Net", sortable: true, render: (v) => { const n = Number(v); return `${n >= 0 ? "+" : ""}₦${(n / 1e9).toFixed(1)}B`; } },
          { key: "positionType", label: "Position" },
          { key: "transactionCount", label: "Txns", sortable: true, render: (v) => Number(v).toLocaleString() },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
