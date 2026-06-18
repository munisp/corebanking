import CrudWorkspace from "@/components/CrudWorkspace";
import { ListChecks } from "lucide-react";

export default function StandingChargesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "standing-charges",
        title: "Standing Charges",
        subtitle: "Maintenance fees, SMS charges, COT, dormancy fees (Go :8197)",
        icon: ListChecks,
        accentColor: "text-teal-800",
        idField: "id",
        statusField: "status",
        searchFields: ["charge_name", "charge_type", "account_type"],
        apiBase: "/api/db/billing-invoices",
        pageSize: 25,
        columns: [
          { key: "id", label: "Charge ID" },
          { key: "charge_name", label: "Charge", sortable: true },
          { key: "charge_type", label: "Type", sortable: true },
          { key: "account_type", label: "Account Type", sortable: true },
          { key: "amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "frequency", label: "Frequency", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
