import CrudWorkspace from "@/components/CrudWorkspace";
import { Landmark } from "lucide-react";

export default function TreasuryInvestmentsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "treasury-investments",
        title: "Treasury Investments",
        subtitle: "T-bills, FGN bonds, eurobonds, placements — maturity, yield, mark-to-market",
        icon: Landmark,
        accentColor: "text-purple-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "issuer", "type", "portfolio"],
        apiBase: "/api/db/fx-trades",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "type", label: "Type", sortable: true },
          { key: "issuer", label: "Issuer", sortable: true },
          { key: "faceValue", label: "Face Value", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "currentValue", label: "Current", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "couponRate", label: "Coupon %", sortable: true },
          { key: "yieldToMaturity", label: "YTM %", sortable: true },
          { key: "tenor", label: "Tenor" },
          { key: "portfolio", label: "Portfolio" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
