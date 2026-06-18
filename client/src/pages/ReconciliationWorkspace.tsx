import CrudWorkspace from "@/components/CrudWorkspace";
import { GitCompare } from "lucide-react";

export default function ReconciliationWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "reconciliation",
        title: "Reconciliation",
        subtitle: "GL, nostro, card settlement, inter-branch — automated matching with exceptions",
        icon: GitCompare,
        accentColor: "text-orange-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name", "type", "sourceSystem", "targetSystem"],
        apiBase: "/api/db/reconciliation-runs",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Run Name", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "totalRecords", label: "Records", sortable: true, render: (v) => Number(v).toLocaleString() },
          { key: "matchedRecords", label: "Matched", render: (v) => Number(v).toLocaleString() },
          { key: "unmatchedRecords", label: "Unmatched", sortable: true },
          { key: "matchRate", label: "Match %", sortable: true, render: (v) => `${v}%` },
          { key: "status", label: "Status", sortable: true },
          { key: "startedAt", label: "Started", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
