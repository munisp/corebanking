import CrudWorkspace from "@/components/CrudWorkspace";
import { Archive } from "lucide-react";

export default function InventoryWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "inventory",
        title: "Inventory Management",
        subtitle: "Bank supplies, cards, cheque books, equipment tracking (Python :8193)",
        icon: Archive,
        accentColor: "text-amber-800",
        idField: "id",
        statusField: "status",
        searchFields: ["item_name", "category", "warehouse"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Item ID" },
          { key: "item_name", label: "Item", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "warehouse", label: "Warehouse", sortable: true },
          { key: "quantity", label: "Qty", sortable: true },
          { key: "unit_cost", label: "Unit Cost", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "total_value", label: "Total", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "reorder_level", label: "Reorder At", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
