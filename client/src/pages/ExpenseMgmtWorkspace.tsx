import CrudWorkspace from "@/components/CrudWorkspace";
import { Wallet } from "lucide-react";

export default function ExpenseMgmtWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "expense-mgmt",
        title: "Expense Management",
        subtitle: "OPEX tracking, approvals, department budgets (Go :8192)",
        icon: Wallet,
        accentColor: "text-red-800",
        idField: "id",
        statusField: "status",
        searchFields: ["category", "department"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Expense ID" },
          { key: "category", label: "Category", sortable: true },
          { key: "department", label: "Department", sortable: true },
          { key: "description", label: "Description" },
          { key: "amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "approved_by", label: "Approved By" },
          { key: "date", label: "Date", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
