import CrudWorkspace from "@/components/CrudWorkspace";
import { Sigma } from "lucide-react";

export default function OtcDerivativesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "otc-derivatives",
        title: "OTC Derivatives",
        subtitle: "Interest rate swaps, FX options, CCS, FRA, caps, floors — Black-Scholes pricing & Greeks (Rust :8161)",
        icon: Sigma,
        accentColor: "text-red-600",
        idField: "id",
        statusField: "status",
        searchFields: ["counterparty", "derivative_type", "underlying"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Trade ID" },
          { key: "derivative_type", label: "Type", sortable: true },
          { key: "counterparty", label: "Counterparty", sortable: true },
          { key: "notional", label: "Notional", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "underlying", label: "Underlying", sortable: true },
          { key: "trade_date", label: "Trade Date", sortable: true },
          { key: "maturity_date", label: "Maturity", sortable: true },
          { key: "mtm_value", label: "MTM Value", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
