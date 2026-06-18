import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Clock } from "lucide-react";

const config: CrudConfig = {
  domainKey: "temporal-memoizer",
  title: "Temporal Memoizer",
  subtitle: "Deterministic activity memoization for fast replay",
  icon: Clock,
  accentColor: "purple",
  apiBase: "/api/db/temporal-memoized-activities",
  idField: "id",
  statusField: "status",
  searchFields: ["workflow"],
  fields: [
    { key: "workflow", label: "Workflow", type: "text" },
    { key: "activity", label: "Activity", type: "text" },
    { key: "replaySpeedup", label: "Speedup", type: "text" },
    { key: "cacheHitRate", label: "Hit Rate", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "workflow", label: "Workflow" },
    { key: "activity", label: "Activity" },
    { key: "replaySpeedup", label: "Speedup" },
    { key: "cacheHitRate", label: "Hit Rate" },
    { key: "status", label: "Status" }
  ],
};

export default function TemporalMemoizerWorkspace() {
  return <CrudWorkspace config={config} />;
}
