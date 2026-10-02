import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileWarning } from "lucide-react";

/**
 * W12 A4-P1-A — Transaction monitoring cases & SAR filing.
 * Wires txn-monitoring-rules-rs GET /api/cases and POST /api/cases/{id}/file-sar
 * (previously orphaned; services/txn-monitoring-rules-rs/src/main.rs:304-305).
 */
const config: CrudConfig = {
  domainKey: "txn-monitoring-cases",
  title: "Transaction Monitoring Cases",
  subtitle: "Investigation cases from the monitoring rules engine — file SARs directly to close the loop",
  icon: FileWarning,
  accentColor: "orange",
  fields: [],
  columns: [
    { key: "id", label: "Case ID", sortable: true },
    { key: "customer_id", label: "Customer" },
    { key: "alert_id", label: "Alert" },
    { key: "status", label: "Status", sortable: true },
    { key: "sar_filed", label: "SAR Filed", render: (v) => (v ? "Yes" : "No") },
    { key: "assigned_to", label: "Assigned To" },
    { key: "outcome", label: "Outcome" },
    { key: "created_at", label: "Opened", sortable: true },
  ],
  idField: "id",
  statusField: "status",
  searchFields: ["id", "customer_id", "status", "assigned_to"],
  apiBase: "/txn-monitoring-rules/api/cases",
  actions: [
    {
      label: "File SAR",
      key: "file-sar",
      method: "POST",
      condition: (row) => row.sar_filed !== true && row.status !== "closed_sar_filed",
    },
  ],
  pageSize: 25,
};

export default function TxnMonitoringCasesWorkspace() {
  return <CrudWorkspace config={config} hideCreate />;
}
