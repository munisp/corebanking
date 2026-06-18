import CrudWorkspace from "@/components/CrudWorkspace";
import { Search } from "lucide-react";

export default function LakehouseQueryFederationWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "lakehousequeryfederation",
        title: "Query Federation",
        subtitle: "Cross-service analytics queries — services read back from lakehouse gold/silver tables",
        icon: Search,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "consumingService",
        searchFields: ["id", "name", "sourceTable", "consumingService"],
        apiBase: "/api/db/query-cache-entries",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "sourceTable", label: "Source Table", sortable: true },
          { key: "consumingService", label: "Consumer", sortable: true },
          { key: "executionFrequency", label: "Frequency" },
          { key: "avgExecutionMs", label: "Avg ms", sortable: true },
          { key: "rowsReturned", label: "Rows", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
