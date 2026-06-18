import CrudWorkspace from "@/components/CrudWorkspace";
import { BookOpen } from "lucide-react";

export default function ChartOfAccountsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "chart-of-accounts",
        title: "Chart of Accounts",
        subtitle: "GL account hierarchy — assets, liabilities, equity, revenue, expenses",
        icon: BookOpen,
        accentColor: "text-blue-700",
        idField: "code",
        statusField: "status",
        searchFields: ["code", "name", "type"],
        apiBase: "/api/db/gl-accounts",
        pageSize: 50,
        columns: [
          { key: "code", label: "Code", sortable: true },
          { key: "name", label: "Account Name", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "parent", label: "Parent" },
          { key: "balance", label: "Balance (₦)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "currency", label: "Currency" },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "code", label: "Account Code", type: "text", required: true },
          { key: "name", label: "Account Name", type: "text", required: true },
          { key: "type", label: "Type", type: "select", options: ["asset", "liability", "equity", "revenue", "expense"], required: true },
          { key: "currency", label: "Currency", type: "select", options: ["NGN", "USD", "GBP", "EUR"] },
        ],
      }}
    />
  );
}
