import CrudWorkspace from "@/components/CrudWorkspace";
import { Scale } from "lucide-react";

export default function CollateralValuationWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "collateral-valuation",
        title: "Collateral Valuation",
        subtitle: "Property, vehicle, securities — FSV, haircuts, insurance, lien status (Rust :8154)",
        icon: Scale,
        accentColor: "text-stone-700",
        idField: "id",
        statusField: "status",
        searchFields: ["description", "owner", "collateral_type", "valuer"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "owner", label: "Owner", sortable: true },
          { key: "collateral_type", label: "Type", sortable: true },
          { key: "description", label: "Description" },
          { key: "market_value", label: "Market Value", sortable: true, render: (v) => { const n = Number(v); return n >= 1e9 ? `₦${(n/1e9).toFixed(1)}B` : `₦${(n/1e6).toFixed(0)}M`; } },
          { key: "haircut_pct", label: "Haircut %", render: (v) => `${v}%` },
          { key: "forced_sale_value", label: "FSV", sortable: true, render: (v) => { const n = Number(v); return n >= 1e9 ? `₦${(n/1e9).toFixed(1)}B` : `₦${(n/1e6).toFixed(0)}M`; } },
          { key: "lien_status", label: "Lien" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
