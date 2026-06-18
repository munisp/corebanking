import CrudWorkspace from "@/components/CrudWorkspace";
import { GitBranch } from "lucide-react";

export default function TBPGSagaDefinitionsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "tbpgsagadefinitions",
        title: "Saga Definitions",
        subtitle: "Dual-write prevention sagas — account opening, loan disbursement, NIP transfer, fee charge, EOD, FX trade",
        icon: GitBranch,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name"],
        apiBase: "/api/db/tb-batch-configs",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "totalExecutions", label: "Executions", sortable: true },
          { key: "successRate", label: "Success %", sortable: true },
          { key: "avgDurationMs", label: "Avg ms", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
