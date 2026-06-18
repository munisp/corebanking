import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";

const config: CrudConfig = {
  domainKey: "keda-scaler",
  title: "KEDA Event Scaler",
  subtitle: "Event-driven scaling (Kafka lag, Redis queue, cron)",
  icon: TrendingUp,
  accentColor: "orange",
  apiBase: "/api/db/keda-scale-triggers",
  idField: "id",
  statusField: "status",
  searchFields: ["scaleObject"],
  fields: [
    { key: "scaleObject", label: "Object", type: "text" },
    { key: "trigger", label: "Trigger", type: "text" },
    { key: "metric", label: "Metric", type: "text" },
    { key: "currentReplicas", label: "Replicas", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "scaleObject", label: "Object" },
    { key: "trigger", label: "Trigger" },
    { key: "metric", label: "Metric" },
    { key: "currentReplicas", label: "Replicas" },
    { key: "status", label: "Status" }
  ],
};

export default function KEDAScalerWorkspace() {
  return <CrudWorkspace config={config} />;
}
