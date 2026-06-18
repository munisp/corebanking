import CrudWorkspace from "@/components/CrudWorkspace";
import { Calculator } from "lucide-react";

export default function IFRS9EngineWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "ifrs9-engine",
        title: "IFRS 9 Engine",
        subtitle: "ECL computation, staging (1/2/3), transition matrix, SICR detection, impairment provisioning (Rust :8164)",
        icon: Calculator,
        accentColor: "text-rose-600",
        idField: "id",
        statusField: "stage",
        searchFields: ["counterparty", "product_type", "stage"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Exposure ID" },
          { key: "counterparty", label: "Counterparty", sortable: true },
          { key: "product_type", label: "Product", sortable: true },
          { key: "outstanding", label: "Outstanding (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "stage", label: "Stage", sortable: true },
          { key: "pd_12m", label: "PD 12M %", sortable: true },
          { key: "lgd", label: "LGD %", sortable: true },
          { key: "ecl", label: "ECL (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "rating", label: "Rating", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
