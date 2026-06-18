import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ArrowUpRight } from "lucide-react";

const config: CrudConfig = {
  domainKey: "stream-response",
  title: "Response Streamer",
  subtitle: "Large payload streaming for memory reduction",
  icon: ArrowUpRight,
  accentColor: "green",
  apiBase: "/api/db/stream-response-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["endpoint"],
  fields: [
    { key: "endpoint", label: "Endpoint", type: "text" },
    { key: "thresholdBytes", label: "Threshold", type: "number" },
    { key: "bytesStreamed24h", label: "Streamed 24h", type: "text" },
    { key: "memoryReductionPct", label: "Reduction", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "endpoint", label: "Endpoint" },
    { key: "thresholdBytes", label: "Threshold" },
    { key: "bytesStreamed24h", label: "Streamed 24h" },
    { key: "memoryReductionPct", label: "Reduction" },
    { key: "status", label: "Status" }
  ],
};

export default function StreamResponseWorkspace() {
  return <CrudWorkspace config={config} />;
}
