import CrudWorkspace from "@/components/CrudWorkspace";
import { FileBarChart } from "lucide-react";

export default function LoanOriginationWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "loan-origination",
        title: "Loan Origination",
        subtitle: "End-to-end loan lifecycle — application intake, credit scoring, multi-level approval, disbursement, and amortization",
        icon: FileBarChart,
        accentColor: "text-green-600",
        idField: "id",
        statusField: "status",
        searchFields: ["customerName", "productType", "id"],
        apiBase: "/api/db/loans",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID", sortable: true },
          { key: "customerName", label: "Customer", sortable: true },
          { key: "productType", label: "Product", sortable: true },
          { key: "requestedAmount", label: "Requested", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "approvedAmount", label: "Approved", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "tenorMonths", label: "Tenor (mo)" },
          { key: "creditScore", label: "Score", sortable: true },
          { key: "creditGrade", label: "Grade" },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "customerId", label: "Customer ID", type: "text", required: true },
          { key: "customerName", label: "Customer Name", type: "text", required: true },
          { key: "productType", label: "Product Type", type: "select", options: ["personal_loan", "sme_loan", "mortgage", "auto_loan", "education_loan"], required: true },
          { key: "amount", label: "Amount (₦)", type: "number", required: true, min: 1 },
          { key: "tenorMonths", label: "Tenor (months)", type: "number", required: true, min: 1, max: 360 },
          { key: "purpose", label: "Purpose", type: "text", required: true },
          { key: "interestRate", label: "Interest Rate (%)", type: "number", min: 0, max: 100 },
          { key: "collateralValue", label: "Collateral Value (₦)", type: "number" },
          { key: "collateralType", label: "Collateral Type", type: "select", options: ["property", "equipment", "vehicle", "cash_deposit", "none"] },
        ],
      }}
    />
  );
}
