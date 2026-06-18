import { Layers } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "batch-processing",
  title: "Batch Processing",
  subtitle: "EOD processing, interest accrual, statement generation, dormancy checks, GL reconciliation",
  icon: Layers,
  accentColor: "bg-orange-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "job_type", "status", "created_by"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "job_type", label: "Job Type", type: "select", options: ["eod_processing", "interest_accrual", "statement_generation", "dormancy_check", "gl_reconciliation", "regulatory_return"], required: true },
    { key: "created_by", label: "Created By", type: "text", defaultValue: "admin" },
  ],
  columns: [
    { key: "id", label: "Job ID" },
    { key: "job_type", label: "Type" },
    { key: "status", label: "Status" },
    { key: "records_processed", label: "Processed" },
    { key: "records_failed", label: "Failed" },
    { key: "total_records", label: "Total" },
    { key: "duration_seconds", label: "Duration (s)" },
    { key: "completed_at", label: "Completed" },
  ],
  actions: [
    { label: "Retry", key: "retry", condition: (r) => r.status === "failed" },
    { label: "Cancel", key: "cancel", condition: (r) => r.status === "running" },
  ],
};

export default function BatchProcessingWorkspace() {
  return <CrudWorkspace config={config} />;
}
