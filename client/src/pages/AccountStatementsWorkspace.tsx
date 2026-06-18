import CrudWorkspace from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

export default function AccountStatementsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "account-statements",
        title: "Account Statements",
        subtitle: "Generate account statements with transaction history, balance trends, and category breakdowns",
        icon: FileText,
        accentColor: "text-blue-600",
        idField: "accountNumber",
        statusField: "status",
        searchFields: ["accountNumber", "accountName", "branchCode"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "accountNumber", label: "Account No.", sortable: true },
          { key: "accountName", label: "Name", sortable: true },
          { key: "accountType", label: "Type", sortable: true },
          { key: "currency", label: "Currency" },
          { key: "currentBalance", label: "Balance", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "availableBalance", label: "Available", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status" },
          { key: "branchCode", label: "Branch" },
        ],
        fields: [
          { key: "accountNumber", label: "Account Number", type: "text", required: true },
          { key: "accountName", label: "Account Name", type: "text", required: true },
          { key: "accountType", label: "Type", type: "select", options: ["savings", "current", "domiciliary"], required: true },
          { key: "currency", label: "Currency", type: "select", options: ["NGN", "USD", "GBP", "EUR"], required: true },
          { key: "branchCode", label: "Branch Code", type: "text" },
        ],
      }}
    />
  );
}
