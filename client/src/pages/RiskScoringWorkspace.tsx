import CrudWorkspace from "@/components/CrudWorkspace";
import { ShieldAlert } from "lucide-react";

export default function RiskScoringWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "risk-scoring",
        title: "Risk Scoring Engine",
        subtitle: "Credit risk PD/LGD/EAD, market risk, operational risk, Basel III RWA (Rust :8145)",
        icon: ShieldAlert,
        accentColor: "text-red-700",
        idField: "id",
        statusField: "status",
        searchFields: ["entity_name", "entity_type", "risk_type", "rating"],
        apiBase: "/api/db/risk-scores",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "entity_name", label: "Entity", sortable: true },
          { key: "entity_type", label: "Type", sortable: true },
          { key: "risk_type", label: "Risk", sortable: true },
          { key: "rating", label: "Rating", sortable: true },
          { key: "pd", label: "PD %", sortable: true, render: (v) => `${v}%` },
          { key: "lgd", label: "LGD %", render: (v) => `${v}%` },
          { key: "ead", label: "EAD", sortable: true, render: (v) => { const n = Number(v); return n >= 1e9 ? `₦${(n/1e9).toFixed(1)}B` : `₦${(n/1e6).toFixed(0)}M`; } },
          { key: "rwa", label: "RWA", render: (v) => { const n = Number(v); return n >= 1e9 ? `₦${(n/1e9).toFixed(1)}B` : `₦${(n/1e6).toFixed(0)}M`; } },
          { key: "ifrs9_stage", label: "IFRS9" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
