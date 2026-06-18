import CrudWorkspace from "@/components/CrudWorkspace";
import { Scale } from "lucide-react";

export default function TBPGReconciliationRunsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "tbpgreconciliationruns",
        title: "Reconciliation Runs",
        subtitle: "Automated EOD/intraday reconciliation — TigerBeetle vs Postgres balance parity checks",
        icon: Scale,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "type", "scope", "status"],
        apiBase: "/api/db/tb-batch-configs",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "type", label: "Type", sortable: true },
          { key: "scope", label: "Scope" },
          { key: "status", label: "Status", sortable: true },
          { key: "accountsChecked", label: "Accounts", sortable: true },
          { key: "mismatchedAccounts", label: "Mismatches", sortable: true },
          { key: "variance", label: "Variance", sortable: true },
          { key: "durationMs", label: "Duration ms", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
