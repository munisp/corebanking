import CrudWorkspace from "@/components/CrudWorkspace";
import { Settings } from "lucide-react";

export default function PgTuningParamsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "pgtuningparams",
        title: "Tuning Parameters",
        subtitle: "Postgres configuration optimization — memory, WAL, checkpoint, planner, autovacuum settings",
        icon: Settings,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "parameter",
        searchFields: ["id", "parameter", "category"],
        apiBase: "/api/db/prepared-statements",
        pageSize: 25,
        columns: [
          { key: "parameter", label: "Parameter", sortable: true },
          { key: "currentValue", label: "Current", sortable: true },
          { key: "recommendedValue", label: "Recommended", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "impact", label: "Impact", sortable: true },
          { key: "requiresRestart", label: "Restart?" },
        ],
        fields: [],
      }}
    />
  );
}
