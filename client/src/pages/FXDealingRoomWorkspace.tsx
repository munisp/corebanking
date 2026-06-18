import CrudWorkspace from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";

export default function FXDealingRoomWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "fx-dealing-room",
        title: "FX Dealing Room",
        subtitle: "Live rates (CBN, NAFEM, interbank), deal execution, position management, P&L",
        icon: TrendingUp,
        accentColor: "text-emerald-600",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "pair", "counterparty", "dealer"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Deal ID" },
          { key: "dealType", label: "Type", sortable: true },
          { key: "pair", label: "Pair", sortable: true },
          { key: "side", label: "Side" },
          { key: "amount", label: "Amount", sortable: true, render: (v) => Number(v).toLocaleString() },
          { key: "rate", label: "Rate" },
          { key: "counterparty", label: "Counterparty" },
          { key: "status", label: "Status", sortable: true },
          { key: "valueDate", label: "Value Date", sortable: true },
          { key: "pnl", label: "P&L", render: (v) => v ? `₦${Number(v).toLocaleString()}` : "—" },
        ],
        fields: [
          { key: "pair", label: "Currency Pair", type: "select", options: ["USD/NGN", "EUR/NGN", "GBP/NGN", "CHF/NGN", "CNY/NGN"], required: true },
          { key: "dealType", label: "Deal Type", type: "select", options: ["spot", "forward", "swap"], required: true },
          { key: "side", label: "Side", type: "select", options: ["buy", "sell"], required: true },
          { key: "amount", label: "Amount", type: "number", required: true },
        ],
      }}
    />
  );
}
