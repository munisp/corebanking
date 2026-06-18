import CrudWorkspace from "@/components/CrudWorkspace";
import { Receipt } from "lucide-react";

export default function FactoringWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "factoring",
        title: "Factoring",
        subtitle: "Recourse, non-recourse, reverse, export factoring (Go :8170)",
        icon: Receipt,
        accentColor: "text-orange-700",
        idField: "id",
        statusField: "status",
        searchFields: ["seller", "buyer"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Deal ID" },
          { key: "deal_type", label: "Type", sortable: true },
          { key: "seller", label: "Seller", sortable: true },
          { key: "buyer", label: "Buyer", sortable: true },
          { key: "invoice_amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "advance_rate", label: "Advance %", sortable: true },
          { key: "discount_rate", label: "Discount %", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
