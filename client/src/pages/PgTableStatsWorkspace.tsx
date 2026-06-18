import CrudWorkspace from "@/components/CrudWorkspace";
import { BarChart3 } from "lucide-react";

export default function PgTableStatsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "pgtablestats",
        title: "Table Statistics",
        subtitle: "Table health monitoring — bloat detection, dead tuples, vacuum scheduling, autovacuum tuning",
        icon: BarChart3,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "table", "schema"],
        apiBase: "/api/db/table-partitions",
        pageSize: 25,
        columns: [
          { key: "table", label: "Table", sortable: true },
          { key: "estimatedRows", label: "Rows", sortable: true },
          { key: "bloatPct", label: "Bloat %", sortable: true },
          { key: "deadRows", label: "Dead", sortable: true },
          { key: "seqScans", label: "Seq Scans", sortable: true },
          { key: "indexScans", label: "Idx Scans", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
