import CrudWorkspace from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";

export default function ETDTradingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "etd-trading",
        title: "Exchange Traded Derivatives",
        subtitle: "Options, futures, margin, clearing, NGX/FMDQ (Rust :8175)",
        icon: TrendingUp,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["instrument", "exchange"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Position ID" },
          { key: "instrument", label: "Instrument", sortable: true },
          { key: "exchange", label: "Exchange", sortable: true },
          { key: "contract_type", label: "Type", sortable: true },
          { key: "underlying", label: "Underlying", sortable: true },
          { key: "quantity", label: "Qty", sortable: true },
          { key: "current_price", label: "Price", sortable: true },
          { key: "pnl", label: "P&L", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
