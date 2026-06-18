import CrudWorkspace from "@/components/CrudWorkspace";
import { ArrowLeftRight } from "lucide-react";

export default function InterbankLendingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "interbank-lending",
        title: "Interbank Lending",
        subtitle: "Call placements, overnight, term deposits, repos, NIBSS settlement (Rust :8166)",
        icon: ArrowLeftRight,
        accentColor: "text-green-600",
        idField: "id",
        statusField: "status",
        searchFields: ["counterparty_bank", "deal_type", "direction"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Deal ID" },
          { key: "deal_type", label: "Type", sortable: true },
          { key: "counterparty_bank", label: "Counterparty", sortable: true },
          { key: "direction", label: "Direction", sortable: true },
          { key: "principal", label: "Principal (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "rate", label: "Rate %", sortable: true },
          { key: "tenor_days", label: "Tenor", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
