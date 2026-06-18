import { GraduationCap } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "education-loans",
  title: "Education Loans",
  subtitle: "Student financing with grace periods, institution verification, and repayment scheduling",
  icon: GraduationCap,
  accentColor: "bg-purple-600",
  idField: "id",
  statusField: "status",
  searchFields: ["studentName", "institutionName", "loanId", "programName"],
  apiBase: "/api/db/loans",
  fields: [
    { key: "studentName", label: "Student Name", type: "text", required: true },
    { key: "institutionName", label: "Institution", type: "text", required: true, placeholder: "University name" },
    { key: "programName", label: "Program", type: "text", required: true },
    { key: "loanAmount", label: "Loan Amount (₦)", type: "number", required: true },
    { key: "interestRate", label: "Interest Rate (%)", type: "number", required: true, defaultValue: 9.0 },
    { key: "termMonths", label: "Term (Months)", type: "number", required: true, defaultValue: 48 },
    { key: "gracePeriodMonths", label: "Grace Period (Months)", type: "number", defaultValue: 6 },
  ],
  columns: [
    { key: "loanId", label: "Loan ID" },
    { key: "studentName", label: "Student" },
    { key: "institutionName", label: "Institution" },
    { key: "loanAmount", label: "Amount", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "termMonths", label: "Term", render: (v) => `${v} mo` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Approve", key: "approve", condition: (r) => r.status === "pending" },
    { label: "Disburse", key: "disburse", condition: (r) => r.status === "approved" },
  ],
};

export default function EducationLoansWorkspace() {
  return <CrudWorkspace config={config} />;
}
