import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";
const config: CrudConfig = {
  domainKey: "txn-monitoring-rules", title: "Transaction Monitoring Rules Engine",
  subtitle: "60+ CBN-prescribed AML/CFT scenarios: structuring, rapid movement, dormant-then-active, round-tripping, PEP monitoring, trade-based ML, velocity spikes.",
  icon: Zap, accentColor: "orange",
  fields: [
    { key: "name", label: "Rule Name", type: "text", required: true },
    { key: "category", label: "Category", type: "select", options: ["structuring", "rapid_movement", "dormant_reactivation", "round_tripping", "pep_monitoring", "geographic", "trade_based_ml", "velocity"] },
    { key: "enabled", label: "Enabled", type: "select", options: ["true", "false"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "name", label: "Rule Name", sortable: true },
    { key: "category", label: "Category", sortable: true }, { key: "scenarioCode", label: "CBN Code" },
    { key: "riskScoreImpact", label: "Risk Impact" }, { key: "enabled", label: "Enabled" },
    { key: "cbnPrescribed", label: "CBN Prescribed" },
  ],
  idField: "id", statusField: "enabled", searchFields: ["name", "category", "scenarioCode"],
  apiBase: "/txn-monitoring-rules/api/rules",
  // W12 A4-P1-A: wire previously-orphaned GET /api/alerts and GET /api/cases.
  tabs: [
    {
      key: "alerts", label: "Alerts", apiBase: "/txn-monitoring-rules/api/alerts",
      columns: [
        { key: "id", label: "Alert ID", sortable: true },
        { key: "rule_id", label: "Rule" },
        { key: "customer_id", label: "Customer" },
        { key: "transaction_id", label: "Transaction" },
        { key: "severity", label: "Severity", sortable: true },
        { key: "status", label: "Status", sortable: true },
        { key: "created_at", label: "Raised", sortable: true },
      ],
    },
    {
      key: "cases", label: "Cases", apiBase: "/txn-monitoring-rules/api/cases",
      columns: [
        { key: "id", label: "Case ID", sortable: true },
        { key: "customer_id", label: "Customer" },
        { key: "status", label: "Status", sortable: true },
        { key: "sar_filed", label: "SAR Filed" },
        { key: "assigned_to", label: "Assigned To" },
        { key: "created_at", label: "Opened", sortable: true },
      ],
    },
  ],
};
export default function TxnMonitoringRulesWorkspace() { return <CrudWorkspace config={config} />; }
