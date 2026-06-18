import CrudWorkspace from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

export default function PgQueryProfilesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "pgqueryprofiles",
        title: "Query Profiles",
        subtitle: "Postgres query performance analysis — execution time, buffer hits, index usage, row scans",
        icon: Database,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "table", "query"],
        apiBase: "/api/db/prepared-statements",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "table", label: "Table", sortable: true },
          { key: "avgExecutionMs", label: "Avg ms", sortable: true },
          { key: "p99ExecutionMs", label: "P99 ms", sortable: true },
          { key: "callsPerMinute", label: "Calls/min", sortable: true },
          { key: "hitRatio", label: "Hit Ratio", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
