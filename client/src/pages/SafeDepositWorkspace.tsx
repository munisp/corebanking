import CrudWorkspace from "@/components/CrudWorkspace";
import { Box } from "lucide-react";

export default function SafeDepositWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "safe-deposit",
        title: "Safe Deposit Box",
        subtitle: "Physical safe deposit box rental, access tracking (Go :8190)",
        icon: Box,
        accentColor: "text-stone-700",
        idField: "id",
        statusField: "status",
        searchFields: ["customer_name", "branch", "box_size"],
        apiBase: "/api/db/vault-operations",
        pageSize: 25,
        columns: [
          { key: "id", label: "Box ID" },
          { key: "box_size", label: "Size", sortable: true },
          { key: "customer_name", label: "Customer", sortable: true },
          { key: "branch", label: "Branch", sortable: true },
          { key: "annual_rent", label: "Rent (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "renewal_date", label: "Renewal", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
