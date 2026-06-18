import { Calculator } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "loan-calculator",
  title: "Loan Calculator",
  subtitle: "Interactive loan calculator for mortgage, education, agriculture, and Islamic finance products",
  icon: Calculator,
  accentColor: "bg-emerald-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "loanType", "customerName"],
  apiBase: "/api/db/loans",
  fields: [
    { key: "loanType", label: "Loan Type", type: "select", options: ["mortgage", "education", "agriculture", "personal", "auto", "murabaha", "ijara"], required: true },
    { key: "customerName", label: "Customer Name", type: "text" },
    { key: "principal", label: "Principal Amount (₦)", type: "number", required: true },
    { key: "annualRate", label: "Annual Rate (%)", type: "number", required: true },
    { key: "tenorMonths", label: "Tenor (months)", type: "number", required: true },
    { key: "repaymentType", label: "Repayment Type", type: "select", options: ["equal_installment", "reducing_balance", "bullet", "balloon"], defaultValue: "equal_installment" },
  ],
  columns: [
    { key: "id", label: "Calc ID" },
    { key: "loanType", label: "Type" },
    { key: "principal", label: "Principal", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "annualRate", label: "Rate (%)" },
    { key: "tenorMonths", label: "Tenor" },
    { key: "monthlyPayment", label: "Monthly EMI", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "totalInterest", label: "Total Interest", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "totalRepayment", label: "Total Repayment", render: (v) => `₦${Number(v).toLocaleString()}` },
  ],
  actions: [],
};

export default function LoanCalculatorWorkspace() {
  return <CrudWorkspace config={config} />;
}
