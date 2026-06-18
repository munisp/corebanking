import CrudWorkspace from "@/components/CrudWorkspace";
import { Scale } from "lucide-react";

export default function BaselEngineWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "basel-engine",
        title: "Basel III/IV Engine",
        subtitle: "RWA computation, capital ratios (CET1/Tier1/CAR), LCR, NSFR, Pillar 3 disclosure (Rust :8163)",
        icon: Scale,
        accentColor: "text-amber-600",
        idField: "id",
        statusField: "asset_class",
        searchFields: ["counterparty", "asset_class", "exposure_type"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Exposure ID" },
          { key: "counterparty", label: "Counterparty", sortable: true },
          { key: "asset_class", label: "Asset Class", sortable: true },
          { key: "exposure_type", label: "Type", sortable: true },
          { key: "ead", label: "EAD (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "risk_weight", label: "Risk Weight %", sortable: true },
          { key: "rwa", label: "RWA (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "pd", label: "PD %", sortable: true },
          { key: "lgd", label: "LGD %", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
