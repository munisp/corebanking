import CrudWorkspace from "@/components/CrudWorkspace";
import { Wallet } from "lucide-react";

export default function SalaryProcessingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "salary-processing",
        title: "Salary Processing",
        subtitle: "Payroll batches, PAYE tax, pension, NHF — NIBSS bulk disbursement (Go :8150)",
        icon: Wallet,
        accentColor: "text-green-700",
        idField: "id",
        statusField: "status",
        searchFields: ["companyName", "payrollMonth", "status"],
        apiBase: "/salary/v1/salary/batches",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "companyName", label: "Company", sortable: true },
          { key: "payrollMonth", label: "Month", sortable: true },
          { key: "employeeCount", label: "Employees", sortable: true },
          { key: "grossPay", label: "Gross Pay", sortable: true, render: (v) => `₦${(Number(v)/1e6).toFixed(0)}M` },
          { key: "netPay", label: "Net Pay", sortable: true, render: (v) => `₦${(Number(v)/1e6).toFixed(0)}M` },
          { key: "tax", label: "PAYE Tax", render: (v) => `₦${(Number(v)/1e6).toFixed(0)}M` },
          { key: "status", label: "Status", sortable: true },
          { key: "successCount", label: "Success" },
          { key: "failedCount", label: "Failed" },
        ],
        fields: [
          {
            key: "companyName",
            label: "Company Name",
            type: "text",
            required: true,
            placeholder: "e.g. Pinnacle Holdings Ltd",
          },
          {
            key: "companyId",
            label: "Company ID",
            type: "text",
            required: true,
            placeholder: "e.g. COMP-001",
          },
          {
            key: "payrollMonth",
            label: "Payroll Month",
            type: "text",
            required: true,
            placeholder: "YYYY-MM (e.g. 2026-05)",
            pattern: "^\\d{4}-\\d{2}$",
            validate: (v) => {
              if (!v) return null;
              return /^\d{4}-\d{2}$/.test(String(v)) ? null : "Format must be YYYY-MM";
            },
          },
          {
            key: "valueDate",
            label: "Value Date",
            type: "date",
            required: true,
          },
          {
            key: "employeeCount",
            label: "Employee Count",
            type: "number",
            required: true,
            min: 1,
            placeholder: "Number of employees",
          },
          {
            key: "grossPay",
            label: "Gross Pay (₦)",
            type: "number",
            required: true,
            min: 1,
            placeholder: "Total gross payroll amount",
          },
          {
            key: "deductions",
            label: "Total Deductions (₦)",
            type: "number",
            min: 0,
            defaultValue: 0,
            placeholder: "Total deductions",
          },
          {
            key: "netPay",
            label: "Net Pay (₦)",
            type: "number",
            required: true,
            min: 1,
            placeholder: "Total net disbursement amount",
          },
          {
            key: "tax",
            label: "PAYE Tax (₦)",
            type: "number",
            min: 0,
            defaultValue: 0,
            placeholder: "Total PAYE tax",
          },
          {
            key: "pension",
            label: "Pension (₦)",
            type: "number",
            min: 0,
            defaultValue: 0,
            placeholder: "Total pension contributions",
          },
          {
            key: "nhf",
            label: "NHF (₦)",
            type: "number",
            min: 0,
            defaultValue: 0,
            placeholder: "National Housing Fund contributions",
          },
        ],
        actions: [
          {
            label: "Approve",
            key: "approve",
            condition: (r) => r.status === "pending_approval",
          },
          {
            label: "Reprocess",
            key: "reprocess",
            condition: (r) => r.status === "failed",
          },
        ],
        tabs: [
          {
            key: "instructions",
            label: "Instructions",
            apiBase: "/salary/v1/salary/instructions",
            subPath: "batchId",
            columns: [
              { key: "id", label: "ID" },
              { key: "employeeName", label: "Employee", sortable: true },
              { key: "accountNo", label: "Account No" },
              { key: "bankCode", label: "Bank" },
              { key: "grossPay", label: "Gross", render: (v) => `₦${Number(v).toLocaleString()}` },
              { key: "netPay", label: "Net", render: (v) => `₦${Number(v).toLocaleString()}` },
              { key: "tax", label: "Tax", render: (v) => `₦${Number(v).toLocaleString()}` },
              { key: "status", label: "Status" },
              { key: "failReason", label: "Fail Reason" },
            ],
          },
        ],
      }}
    />
  );
}
