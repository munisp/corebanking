import CrudWorkspace from "@/components/CrudWorkspace";
import { Gauge } from "lucide-react";

export default function StressTestingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "stress-testing",
        title: "Stress Testing",
        subtitle: "CBN scenarios, adverse/severe shocks, capital impact, post-stress CAR (Rust :8177)",
        icon: Gauge,
        accentColor: "text-red-600",
        idField: "id",
        statusField: "result",
        searchFields: ["scenario_name", "scenario_type"],
        apiBase: "/api/db/anomaly-models",
        pageSize: 25,
        columns: [
          { key: "id", label: "Scenario ID" },
          { key: "scenario_name", label: "Scenario", sortable: true },
          { key: "scenario_type", label: "Type", sortable: true },
          { key: "gdp_shock", label: "GDP %", sortable: true },
          { key: "fx_shock", label: "FX %", sortable: true },
          { key: "capital_impact", label: "Impact", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "car_post_stress", label: "CAR %", sortable: true },
          { key: "result", label: "Result", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
