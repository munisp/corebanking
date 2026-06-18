import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Database } from "lucide-react";
const config: CrudConfig = {
  domainKey: "cocoindex-pipeline", title: "CocoIndex Pipelines",
  subtitle: "Real-time incremental data indexing: CDC from Postgres/Kafka into vector + graph indexes with sub-second freshness.",
  icon: Database, accentColor: "cyan",
  fields: [
    { key: "name", label: "Pipeline Name", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["running", "paused", "error"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "name", label: "Pipeline", sortable: true },
    { key: "source", label: "Source" }, { key: "sink", label: "Sink" },
    { key: "status", label: "Status", sortable: true }, { key: "indexedDocs", label: "Indexed" },
    { key: "avgLatencyMs", label: "Latency (ms)" },
  ],
  idField: "id", statusField: "status", searchFields: ["name", "source", "sink", "status"],
  apiBase: "/api/db/anomaly-models",
};
export default function CocoIndexPipelineWorkspace() { return <CrudWorkspace config={config} />; }
