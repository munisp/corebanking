import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";

const config: CrudConfig = {
  domainKey: "hpa-autoscaler",
  title: "HPA Autoscaler",
  subtitle: "CPU/memory/custom-metric pod autoscaling",
  icon: TrendingUp,
  accentColor: "blue",
  apiBase: "/api/db/hpa-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["deployment"],
  fields: [
    { key: "deployment", label: "Deployment", type: "text" },
    { key: "currentReplicas", label: "Replicas", type: "number" },
    { key: "cpuTargetPct", label: "CPU Target", type: "number" },
    { key: "customMetric", label: "Custom Metric", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "deployment", label: "Deployment" },
    { key: "currentReplicas", label: "Replicas" },
    { key: "cpuTargetPct", label: "CPU Target" },
    { key: "customMetric", label: "Custom Metric" },
    { key: "status", label: "Status" }
  ],
};

export default function HPAAutoscalerWorkspace() {
  return <CrudWorkspace config={config} />;
}
