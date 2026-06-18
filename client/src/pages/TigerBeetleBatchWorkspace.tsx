import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "tb-batch",
  title: "TigerBeetle Batch Engine",
  subtitle: "8190-transfer batches at 1M+ TPS",
  icon: Zap,
  accentColor: "yellow",
  apiBase: "/api/db/tb-batch-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["batchSize"],
  fields: [
    { key: "batchSize", label: "Batch Size", type: "number" },
    { key: "avgBatchLatencyMs", label: "Latency (ms)", type: "number" },
    { key: "throughputTps", label: "TPS", type: "number" },
    { key: "transfersProcessed24h", label: "Transfers 24h", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "batchSize", label: "Batch Size" },
    { key: "avgBatchLatencyMs", label: "Latency (ms)" },
    { key: "throughputTps", label: "TPS" },
    { key: "transfersProcessed24h", label: "Transfers 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function TigerBeetleBatchWorkspace() {
  return <CrudWorkspace config={config} />;
}
