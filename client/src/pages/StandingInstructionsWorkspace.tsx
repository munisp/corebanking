import CrudWorkspace from "@/components/CrudWorkspace";
import { Clock } from "lucide-react";

export default function StandingInstructionsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "standing-instructions",
        title: "Standing Instructions",
        subtitle: "Scheduled payments, recurring transfers, sweeps, auto-savings, salary payments",
        icon: Clock,
        accentColor: "text-orange-700",
        idField: "id",
        statusField: "status",
        searchFields: ["customerName", "type", "description"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "customerName", label: "Customer", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "description", label: "Description" },
          { key: "amount", label: "Amount", sortable: true, render: (v) => Number(v) > 0 ? `₦${Number(v).toLocaleString()}` : "Sweep" },
          { key: "frequency", label: "Frequency", sortable: true },
          { key: "nextExecutionDate", label: "Next Run", sortable: true },
          { key: "executionCount", label: "Runs" },
          { key: "totalExecuted", label: "Total Executed", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [
          { key: "customerName", label: "Customer", type: "text", required: true },
          { key: "type", label: "Type", type: "select", options: ["recurring_transfer", "bill_payment", "loan_repayment", "sweep", "auto_savings", "salary_payment"], required: true },
          { key: "amount", label: "Amount", type: "number", required: true },
          { key: "frequency", label: "Frequency", type: "select", options: ["daily", "weekly", "biweekly", "monthly", "quarterly", "annually"], required: true },
        ],
      }}
    />
  );
}
