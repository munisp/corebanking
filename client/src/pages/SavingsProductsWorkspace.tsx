import CrudWorkspace from "@/components/CrudWorkspace";
import { PiggyBank } from "lucide-react";

export default function SavingsProductsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "savings-products",
        title: "Savings Products",
        subtitle: "Fixed deposits, target savings, junior savings — interest computation, early withdrawal, and auto-renewal",
        icon: PiggyBank,
        accentColor: "text-emerald-600",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "type", "currency"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Product ID", sortable: true },
          { key: "name", label: "Product Name", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "minAmount", label: "Min Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "interestRate", label: "Interest Rate", sortable: true, render: (v) => `${Number(v).toFixed(1)}%` },
          { key: "penaltyRate", label: "Penalty (%)" },
          { key: "currency", label: "Currency" },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "name", label: "Product Name", type: "text", required: true },
          { key: "type", label: "Type", type: "select", options: ["fixed_deposit", "target_savings", "junior_savings"], required: true },
          { key: "minAmount", label: "Minimum Amount", type: "number", required: true, min: 0 },
          { key: "interestRate", label: "Interest Rate (%)", type: "number", required: true, min: 0, max: 100 },
          { key: "currency", label: "Currency", type: "select", options: ["NGN", "USD", "GBP", "EUR"], required: true },
        ],
      }}
    />
  );
}
