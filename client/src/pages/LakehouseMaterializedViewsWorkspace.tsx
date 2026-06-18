import CrudWorkspace from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

export default function LakehouseMaterializedViewsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "lakehousematerializedviews",
        title: "Materialized Views",
        subtitle: "Pre-computed aggregations — Customer 360, PAR analysis, fraud model performance, regulatory KPIs, FX positions",
        icon: Layers,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name", "sourceTable"],
        apiBase: "/api/db/materialized-views-perf",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "sourceTable", label: "Source", sortable: true },
          { key: "refreshSchedule", label: "Schedule" },
          { key: "rowCount", label: "Rows", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "ttlHours", label: "TTL hrs" },
        ],
        fields: [],
      }}
    />
  );
}
