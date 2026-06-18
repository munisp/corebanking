import CrudWorkspace from "@/components/CrudWorkspace";
import { Link } from "lucide-react";

export default function SupplyChainFinanceWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "supply-chain-finance",
        title: "Supply Chain Finance",
        subtitle: "Invoice financing, reverse factoring, payables finance, supplier programs (Go :8158)",
        icon: Link,
        accentColor: "text-orange-600",
        idField: "id",
        statusField: "status",
        searchFields: ["buyer", "supplier", "program_name"],
        apiBase: "/api/db/billing-invoices",
        pageSize: 25,
        columns: [
          { key: "id", label: "Invoice ID" },
          { key: "buyer", label: "Buyer", sortable: true },
          { key: "supplier", label: "Supplier", sortable: true },
          { key: "amount", label: "Amount (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "discount_rate", label: "Discount %", sortable: true },
          { key: "due_date", label: "Due Date", sortable: true },
          { key: "program_name", label: "Program", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
