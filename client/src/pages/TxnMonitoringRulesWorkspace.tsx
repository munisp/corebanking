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
  apiBase: "/api/db/accounts",
};
export default function TxnMonitoringRulesWorkspace() { return <CrudWorkspace config={config} />; }
