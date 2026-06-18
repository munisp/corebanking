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
        apiBase: "/api/db/transfers",
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
        fields: [],
      }}
    />
  );
}
