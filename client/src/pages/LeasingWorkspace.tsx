import CrudWorkspace from "@/components/CrudWorkspace";
import { Package } from "lucide-react";

export default function LeasingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "leasing",
        title: "Leasing",
        subtitle: "Finance lease, operating lease, sale-leaseback, asset mgmt (Go :8173)",
        icon: Package,
        accentColor: "text-amber-700",
        idField: "id",
        statusField: "status",
        searchFields: ["lessee", "lease_type"],
        apiBase: "/api/db/equipment-leasing",
        pageSize: 25,
        columns: [
          { key: "id", label: "Contract ID" },
          { key: "lease_type", label: "Type", sortable: true },
          { key: "lessee", label: "Lessee", sortable: true },
          { key: "asset_description", label: "Asset" },
          { key: "asset_value", label: "Value", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "monthly_rental", label: "Monthly", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "tenor_months", label: "Tenor (mo)", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
