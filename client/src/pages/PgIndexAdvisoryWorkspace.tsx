import CrudWorkspace from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

export default function PgIndexAdvisoryWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "pgindexadvisory",
        title: "Index Advisory",
        subtitle: "Automated index recommendations — BTREE, BRIN, GIN, partial indexes with estimated speedup",
        icon: Zap,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "table", "createStatement"],
        apiBase: "/api/db/table-partitions",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "table", label: "Table", sortable: true },
          { key: "columns", label: "Columns" },
          { key: "indexType", label: "Type", sortable: true },
          { key: "estimatedSpeedup", label: "Speedup", sortable: true },
          { key: "priority", label: "Priority", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
