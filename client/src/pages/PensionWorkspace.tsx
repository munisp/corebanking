import CrudWorkspace from "@/components/CrudWorkspace";
import { Landmark } from "lucide-react";

export default function PensionWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "pension",
        title: "Pension Management",
        subtitle: "PFA integration, RSA management, employer/individual pensions (Python :8195)",
        icon: Landmark,
        accentColor: "text-indigo-800",
        idField: "id",
        statusField: "status",
        searchFields: ["customer_name", "account_type", "pfa"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Account ID" },
          { key: "customer_name", label: "Name", sortable: true },
          { key: "account_type", label: "Type", sortable: true },
          { key: "pfa", label: "PFA", sortable: true },
          { key: "rsa_number", label: "RSA #" },
          { key: "total_contributions", label: "Total", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
