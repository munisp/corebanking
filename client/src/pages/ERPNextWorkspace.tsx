import { RefreshCw } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "erpnext-sync",
  title: "ERPNext Sync Jobs",
  subtitle: "Journal entries, payment sync, invoice reconciliation with ERPNext",
  icon: RefreshCw,
  accentColor: "bg-slate-700",
  idField: "id",
  statusField: "status",
  searchFields: ["jobId", "syncType", "status"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "syncType", label: "Sync Type", type: "select", options: ["journal_entry", "payment_entry", "invoice", "customer_sync"], required: true },
    { key: "entities", label: "Entity Filter (JSON)", type: "textarea", placeholder: '["JV-001","JV-002"]' },
  ],
  columns: [
    { key: "jobId", label: "Job ID" },
    { key: "syncType", label: "Type", render: (v) => String(v).replace(/_/g, " ") },
    { key: "recordsProcessed", label: "Processed" },
    { key: "recordsFailed", label: "Failed" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Retry", key: "retry", condition: (r) => r.status === "failed" },
  ],
};

export default function ERPNextWorkspace() {
  return <CrudWorkspace config={config} />;
}
