import { Building2 } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "mortgage-servicing",
  title: "Mortgage Applications",
  subtitle: "Property-backed lending operations — origination, underwriting, collateral controls",
  icon: Building2,
  accentColor: "bg-indigo-600",
  idField: "id",
  statusField: "status",
  searchFields: ["applicantName", "applicationId", "status"],
  apiBase: "/api/db/mortgage-applications",
  fields: [
    { key: "applicantName", label: "Applicant Name", type: "text", required: true, placeholder: "Full legal name" },
    { key: "propertyValue", label: "Property Value (₦)", type: "number", required: true },
    { key: "loanAmount", label: "Loan Amount (₦)", type: "number", required: true },
    { key: "interestRate", label: "Interest Rate (%)", type: "number", required: true, defaultValue: 12.5 },
    { key: "termYears", label: "Term (Years)", type: "number", required: true, defaultValue: 20 },
    { key: "monthlyIncome", label: "Monthly Income (₦)", type: "number", required: true },
  ],
  columns: [
    { key: "applicationId", label: "Application ID" },
    { key: "applicantName", label: "Applicant" },
    { key: "loanAmount", label: "Loan Amount", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "ltvRatio", label: "LTV", render: (v) => `${Number(v).toFixed(1)}%` },
    { key: "interestRate", label: "Rate", render: (v) => `${v}%` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Approve", key: "approve", condition: (r) => r.status === "pending" },
    { label: "Disburse", key: "disburse", condition: (r) => r.status === "approved" },
  ],
};

export default function MortgageWorkspace() {
  return <CrudWorkspace config={config} />;
}
