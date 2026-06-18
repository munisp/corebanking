import CrudWorkspace from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

export default function ComplianceChecksWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "compliance-checks",
        title: "Compliance Checks",
        subtitle: "CBN, NDIC, FIRS, Basel III, AML, PCI-DSS — automated scoring with evidence",
        icon: Shield,
        accentColor: "text-green-700",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "category", "status", "evidence"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "category", label: "Regulator", sortable: true },
          { key: "name", label: "Requirement", sortable: true },
          { key: "score", label: "Score", sortable: true, render: (v, row) => `${v}/${row.maxScore}` },
          { key: "status", label: "Status", sortable: true },
          { key: "lastAssessed", label: "Last Assessed" },
          { key: "nextDue", label: "Next Due", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
