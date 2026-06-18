import CrudWorkspace from "@/components/CrudWorkspace";
import { Building } from "lucide-react";

export default function FixedAssetsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "fixed-assets",
        title: "Fixed Assets",
        subtitle: "Asset register, depreciation, NBV tracking (Go :8191)",
        icon: Building,
        accentColor: "text-gray-700",
        idField: "id",
        statusField: "status",
        searchFields: ["asset_name", "category", "location"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Asset ID" },
          { key: "asset_name", label: "Asset", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "location", label: "Location", sortable: true },
          { key: "purchase_value", label: "Purchase Value", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "depreciation_method", label: "Depreciation" },
          { key: "net_book_value", label: "NBV", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
