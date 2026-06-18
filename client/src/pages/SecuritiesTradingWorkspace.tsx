import CrudWorkspace from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";

export default function SecuritiesTradingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "securities-trading",
        title: "Securities Trading",
        subtitle: "Equities, bonds, order management, holdings, corporate actions (Rust :8157)",
        icon: TrendingUp,
        accentColor: "text-blue-600",
        idField: "id",
        statusField: "status",
        searchFields: ["symbol", "issuer", "security_type", "exchange"],
        apiBase: "/api/db/fx-trades",
        pageSize: 25,
        columns: [
          { key: "id", label: "Security ID" },
          { key: "symbol", label: "Symbol", sortable: true },
          { key: "security_type", label: "Type", sortable: true },
          { key: "issuer", label: "Issuer", sortable: true },
          { key: "exchange", label: "Exchange", sortable: true },
          { key: "last_price", label: "Last Price", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "quantity", label: "Qty", sortable: true },
          { key: "market_value", label: "Market Value", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
