import CrudWorkspace from "@/components/CrudWorkspace";
import { BookOpen } from "lucide-react";

export default function GLAccountsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "gl-accounts",
        title: "General Ledger",
        subtitle: "Chart of accounts, trial balance, balance sheet — 20 GL codes with full hierarchy",
        icon: BookOpen,
        accentColor: "text-violet-700",
        idField: "id",
        statusField: "status",
        searchFields: ["accountCode", "accountName", "category", "subcategory"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "accountCode", label: "Code", sortable: true },
          { key: "accountName", label: "Account Name", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "subcategory", label: "Subcategory" },
          { key: "debitBalance", label: "Debit", sortable: true, render: (v) => Number(v) > 0 ? `₦${(Number(v) / 1e9).toFixed(1)}B` : "—" },
          { key: "creditBalance", label: "Credit", sortable: true, render: (v) => Number(v) > 0 ? `₦${(Number(v) / 1e9).toFixed(1)}B` : "—" },
          { key: "level", label: "Level" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [
          { key: "accountCode", label: "GL Code", type: "text", required: true },
          { key: "accountName", label: "Account Name", type: "text", required: true },
          { key: "category", label: "Category", type: "select", options: ["asset", "liability", "equity", "revenue", "expense"], required: true },
        ],
      }}
    />
  );
}
