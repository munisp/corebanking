import CrudWorkspace from "@/components/CrudWorkspace";
import { GitBranch } from "lucide-react";

export default function LakehouseLineageNodesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "lakehouselineagenodes",
        title: "Data Lineage Nodes",
        subtitle: "Full dependency graph — services, Kafka topics, bronze/silver/gold tables, materialized views, dashboards",
        icon: GitBranch,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "type",
        searchFields: ["id", "name", "type", "domain"],
        apiBase: "/api/db/avro-schemas",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID", sortable: true },
          { key: "name", label: "Name", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "domain", label: "Domain", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
