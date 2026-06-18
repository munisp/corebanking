import CrudWorkspace from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

export default function TBPGReconciliationRulesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "tbpgreconciliationrules",
        title: "Reconciliation Rules",
        subtitle: "Automated reconciliation rules — balance parity, GL zero-sum, transaction count, settlement, nostro",
        icon: Shield,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "type",
        searchFields: ["id", "name", "type"],
        apiBase: "/api/db/tb-batch-configs",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "tolerance", label: "Tolerance" },
          { key: "frequency", label: "Frequency" },
          { key: "autoCorrect", label: "Auto-Fix" },
          { key: "escalateOnFail", label: "Escalate" },
        ],
        fields: [],
      }}
    />
  );
}
