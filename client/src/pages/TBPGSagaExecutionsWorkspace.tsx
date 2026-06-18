import CrudWorkspace from "@/components/CrudWorkspace";
import { Play } from "lucide-react";

export default function TBPGSagaExecutionsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "tbpgsagaexecutions",
        title: "Saga Executions",
        subtitle: "Recent saga executions — completed, compensating, running, with correlation tracking",
        icon: Play,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "sagaName", "tenantId", "status"],
        apiBase: "/api/db/tb-batch-configs",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "sagaName", label: "Saga", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "currentStep", label: "Step" },
          { key: "totalSteps", label: "Total" },
          { key: "tenantId", label: "Tenant", sortable: true },
          { key: "durationMs", label: "Duration ms", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
