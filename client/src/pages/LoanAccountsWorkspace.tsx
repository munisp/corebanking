import CrudWorkspace from "@/components/CrudWorkspace";
import { Receipt } from "lucide-react";

export default function LoanAccountsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "loan-accounts",
        title: "Loan Accounts",
        subtitle: "Active loan portfolio — repayment tracking, NPL classification, collateral",
        icon: Receipt,
        accentColor: "text-red-600",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "customerName", "classification"],
        apiBase: "/api/db/loans",
        pageSize: 25,
        columns: [
          { key: "id", label: "Loan ID", sortable: true },
          { key: "customerName", label: "Customer", sortable: true },
          { key: "principalAmount", label: "Principal (₦)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "outstandingBalance", label: "Outstanding (₦)", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "interestRate", label: "Rate %", render: (v) => `${v}%` },
          { key: "daysInArrears", label: "Days Arrears", sortable: true },
          { key: "classification", label: "Classification", sortable: true },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "customerId", label: "Customer ID", type: "text", required: true },
          { key: "productId", label: "Product ID", type: "text", required: true },
          { key: "principalAmount", label: "Principal Amount", type: "number", required: true },
          { key: "tenorMonths", label: "Tenor (months)", type: "number", required: true },
        ],
      }}
    />
  );
}
