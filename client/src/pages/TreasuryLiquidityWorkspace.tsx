import CrudWorkspace from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";

export default function TreasuryLiquidityWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "treasury-liquidity",
        title: "Treasury & Liquidity",
        subtitle: "FX positions, money market deals, LCR/NSFR computation, HQLA tracking, and ALM management",
        icon: TrendingUp,
        accentColor: "text-purple-600",
        idField: "id",
        statusField: "status",
        searchFields: ["currency_pair", "counterparty", "deal_type"],
        apiBase: "/api/db/fx-trades",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID", sortable: true },
          { key: "currency_pair", label: "Pair", sortable: true },
          { key: "position_type", label: "Type" },
          { key: "notional_amount", label: "Notional", sortable: true, render: (v) => `$${Number(v).toLocaleString()}` },
          { key: "entry_rate", label: "Entry Rate" },
          { key: "current_rate", label: "Current Rate" },
          { key: "pnl", label: "P&L", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "currency_pair", label: "Currency Pair", type: "select", options: ["USD/NGN", "GBP/NGN", "EUR/NGN", "CHF/NGN", "CAD/NGN", "AED/NGN"], required: true },
          { key: "position_type", label: "Position Type", type: "select", options: ["long", "short"], required: true },
          { key: "notional_amount", label: "Notional Amount", type: "number", required: true, min: 1 },
          { key: "entry_rate", label: "Entry Rate", type: "number", required: true, min: 0 },
        ],
      }}
    />
  );
}
