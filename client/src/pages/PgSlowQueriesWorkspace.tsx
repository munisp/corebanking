import CrudWorkspace from "@/components/CrudWorkspace";
import { AlertTriangle } from "lucide-react";

export default function PgSlowQueriesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "pgslowqueries",
        title: "Slow Queries",
        subtitle: "Slow query detection — execution plans, buffer analysis, resolution tracking",
        icon: AlertTriangle,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "severity",
        searchFields: ["id", "table", "query"],
        apiBase: "/api/db/sql-queries",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "table", label: "Table", sortable: true },
          { key: "executionMs", label: "Exec ms", sortable: true },
          { key: "rowsExamined", label: "Rows", sortable: true },
          { key: "planType", label: "Plan", sortable: true },
          { key: "severity", label: "Severity", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
