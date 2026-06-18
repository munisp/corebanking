import CrudWorkspace from "@/components/CrudWorkspace";
import { AlertTriangle } from "lucide-react";

export default function ContingentLiabilitiesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "contingent-liabilities",
        title: "Contingent Liabilities",
        subtitle: "LCs, guarantees, commitments, litigation, off-balance sheet (Rust :8174)",
        icon: AlertTriangle,
        accentColor: "text-red-700",
        idField: "id",
        statusField: "status",
        searchFields: ["counterparty", "liability_type"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "liability_type", label: "Type", sortable: true },
          { key: "counterparty", label: "Counterparty", sortable: true },
          { key: "max_exposure", label: "Exposure", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "probability", label: "Probability", sortable: true },
          { key: "expected_loss", label: "Expected Loss", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "expiry_date", label: "Expiry", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
