import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";
const config: CrudConfig = {
  domainKey: "gnn-fraud-detection", title: "GNN Fraud Detection",
  subtitle: "Graph Neural Networks (GraphSAGE, GAT, TemporalGAT) for transaction fraud detection with Neo4j/FalkorDB graph storage and GNN explainability.",
  icon: Shield, accentColor: "red",
  fields: [
    { key: "model", label: "Model", type: "select", options: ["GraphSAGE-Fraud", "GAT-AML", "TempGAT-Realtime"], required: true },
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "prediction", label: "Prediction", type: "select", options: ["fraudulent", "legitimate", "money_laundering"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "model", label: "Model", sortable: true },
    { key: "customerId", label: "Customer", sortable: true }, { key: "prediction", label: "Prediction", sortable: true },
    { key: "confidence", label: "Confidence" }, { key: "riskScore", label: "Risk Score" },
  ],
  idField: "id", statusField: "prediction", searchFields: ["customerId", "model", "prediction"],
  apiBase: "/api/db/anomaly-models",
};
export default function GNNFraudDetectionWorkspace() { return <CrudWorkspace config={config} />; }
