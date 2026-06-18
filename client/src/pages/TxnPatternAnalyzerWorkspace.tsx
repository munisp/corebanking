import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";

const config: CrudConfig = {
  domainKey: "txn-pattern-analyzer",
  title: "Transaction Pattern Analyzer",
  subtitle: "ML-based anomaly detection with σ-deviation scoring",
  icon: Activity,
  accentColor: "purple",
  apiBase: "/api/db/txn-pattern-analyses",
  idField: "id",
  statusField: "status",
  searchFields: ["customerId"],
  fields: [
    { key: "customerId", label: "Customer ID", type: "text" },
    { key: "customerName", label: "Customer", type: "text" },
    { key: "anomalyScore", label: "Anomaly Score", type: "number" },
    { key: "baselineDeviation", label: "Deviation", type: "text" },
    { key: "recommendation", label: "Action", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "customerId", label: "Customer ID" },
    { key: "customerName", label: "Customer" },
    { key: "anomalyScore", label: "Anomaly Score" },
    { key: "baselineDeviation", label: "Deviation" },
    { key: "recommendation", label: "Action" },
    { key: "status", label: "Status" }
  ],
};

export default function TxnPatternAnalyzerWorkspace() {
  return <CrudWorkspace config={config} />;
}
