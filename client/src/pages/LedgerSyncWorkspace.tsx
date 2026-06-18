import { Scale } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "ledger-reconciliation",
  title: "Reconciliation Runs",
  subtitle: "GL assertion, discrepancy detection, and automated matching",
  icon: Scale,
  accentColor: "bg-amber-700",
  idField: "id",
  statusField: "status",
  searchFields: ["runId", "runType", "status"],
  apiBase: "/api/db/reconciliation-runs",
  fields: [
    { key: "runType", label: "Run Type", type: "select", options: ["daily", "weekly", "monthly", "ad_hoc"], required: true },
    { key: "sourceLedger", label: "Source Ledger", type: "text", placeholder: "e.g. core_banking_gl" },
    { key: "targetLedger", label: "Target Ledger", type: "text", placeholder: "e.g. payment_gateway_gl" },
  ],
  columns: [
    { key: "runId", label: "Run ID" },
    { key: "runType", label: "Type" },
    { key: "totalRecords", label: "Total" },
    { key: "matchedRecords", label: "Matched" },
    { key: "unmatchedRecords", label: "Unmatched" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Retry", key: "retry", condition: (r) => r.status === "failed" },
  ],
};

export default function LedgerSyncWorkspace() {
  return <CrudWorkspace config={config} />;
}
