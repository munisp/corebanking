import CrudWorkspace from "@/components/CrudWorkspace";
import { Heart } from "lucide-react";

export default function MicrofinanceWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "microfinance",
        title: "Microfinance",
        subtitle: "Group lending, savings circles, field officers, mobile money (Python :8182)",
        icon: Heart,
        accentColor: "text-rose-700",
        idField: "id",
        statusField: "status",
        searchFields: ["group_name", "location"],
        apiBase: "/api/db/lending-groups",
        pageSize: 25,
        columns: [
          { key: "id", label: "Group ID" },
          { key: "group_name", label: "Group", sortable: true },
          { key: "location", label: "Location", sortable: true },
          { key: "members", label: "Members", sortable: true },
          { key: "total_savings", label: "Savings", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "total_loans_outstanding", label: "Loans", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "repayment_rate", label: "Repayment %", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
