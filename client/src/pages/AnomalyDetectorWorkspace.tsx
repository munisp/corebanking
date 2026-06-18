import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { AlertTriangle } from "lucide-react";

const config: CrudConfig = {
  domainKey: "anomaly-detector",
  title: "Auth Anomaly Detector",
  subtitle: "ML-based auth anomaly detection",
  icon: AlertTriangle,
  accentColor: "red",
  apiBase: "/api/db/anomaly-models",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "type", label: "Type", type: "text" },
    { key: "accuracy", label: "Accuracy", type: "number" },
    { key: "anomalies24h", label: "Anomalies 24h", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "accuracy", label: "Accuracy" },
    { key: "anomalies24h", label: "Anomalies 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function AnomalyDetectorWorkspace() {
  return <CrudWorkspace config={config} />;
}
