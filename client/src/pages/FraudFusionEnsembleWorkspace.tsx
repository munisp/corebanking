import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";
const config: CrudConfig = {
  domainKey: "fraudfusion-ensemble", title: "FraudFusion Ensemble",
  subtitle: "Multi-model ensemble fraud detection: XGBoost + GNN + BiLSTM + VAE + IsolationForest — stacking meta-learner with 0.993 AUC-ROC.",
  icon: Layers, accentColor: "orange",
  fields: [
    { key: "fraudType", label: "Fraud Type", type: "select", options: ["account_takeover", "synthetic_identity", "card_not_present"], required: true },
    { key: "status", label: "Status", type: "select", options: ["confirmed", "investigating", "blocked", "cleared"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "ensembleScore", label: "Score", sortable: true },
    { key: "fraudType", label: "Fraud Type", sortable: true }, { key: "amountNgn", label: "Amount (₦)" },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["fraudType", "status"],
  apiBase: "/api/db/aml-alerts",
};
export default function FraudFusionEnsembleWorkspace() { return <CrudWorkspace config={config} />; }
