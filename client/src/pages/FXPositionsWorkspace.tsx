import CrudWorkspace from "@/components/CrudWorkspace";
import { Coins } from "lucide-react";

export default function FXPositionsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "fx-positions",
        title: "FX Positions",
        subtitle: "Open position monitoring — net exposure, unrealized P&L, limit utilization",
        icon: Coins,
        accentColor: "text-amber-700",
        idField: "pair",
        statusField: "pair",
        searchFields: ["pair"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "pair", label: "Pair", sortable: true },
          { key: "longAmount", label: "Long", render: (v) => Number(v).toLocaleString() },
          { key: "shortAmount", label: "Short", render: (v) => Number(v).toLocaleString() },
          { key: "netPosition", label: "Net", sortable: true, render: (v) => Number(v).toLocaleString() },
          { key: "averageRate", label: "Avg Rate" },
          { key: "currentRate", label: "Current" },
          { key: "unrealizedPnl", label: "Unrealized P&L", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "utilizationPct", label: "Utilization %", sortable: true, render: (v) => `${v}%` },
        ],
        fields: [],
      }}
    />
  );
}
