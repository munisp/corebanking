import CrudWorkspace from "@/components/CrudWorkspace";
import { Users } from "lucide-react";

export default function SyndicatedLoansWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "syndicated-loans",
        title: "Syndicated Loans",
        subtitle: "Facility management, participants, drawdowns (Go :8171)",
        icon: Users,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "status",
        searchFields: ["facility_name", "borrower"],
        apiBase: "/api/db/loans",
        pageSize: 25,
        columns: [
          { key: "id", label: "Facility ID" },
          { key: "facility_name", label: "Facility", sortable: true },
          { key: "borrower", label: "Borrower", sortable: true },
          { key: "total_amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "lead_arranger", label: "Arranger", sortable: true },
          { key: "participant_count", label: "Participants", sortable: true },
          { key: "interest_rate", label: "Rate %", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
