import CrudWorkspace from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

export default function BulkPaymentsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "bulk-payments",
        title: "Bulk Payments",
        subtitle: "Batch payment processing — salary runs, vendor payments, dividends, pension, and tax remittances via NIBSS",
        icon: Layers,
        accentColor: "text-orange-600",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "originator", "batch_type"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Batch ID", sortable: true },
          { key: "batch_type", label: "Type", sortable: true },
          { key: "originator", label: "Originator", sortable: true },
          { key: "total_amount", label: "Total Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "total_items", label: "Items", sortable: true },
          { key: "successful_count", label: "Success" },
          { key: "failed_count", label: "Failed" },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "batch_type", label: "Batch Type", type: "select", options: ["salary", "vendor_payment", "dividend", "pension", "tax_remittance"], required: true },
          { key: "originator", label: "Originator", type: "text", required: true },
          { key: "originator_account", label: "Originator Account", type: "text", required: true },
        ],
      }}
    />
  );
}
