import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ArrowUpRight } from "lucide-react";

const config: CrudConfig = {
  domainKey: "kafka-batch-producer",
  title: "Kafka Batch Producer",
  subtitle: "High-throughput batch producing with LZ4",
  icon: ArrowUpRight,
  accentColor: "red",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["topic"],
  fields: [
    { key: "topic", label: "Topic", type: "text" },
    { key: "lingerMs", label: "Linger (ms)", type: "number" },
    { key: "throughputMps", label: "Throughput MPS", type: "number" },
    { key: "compressionType", label: "Compression", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "topic", label: "Topic" },
    { key: "lingerMs", label: "Linger (ms)" },
    { key: "throughputMps", label: "Throughput MPS" },
    { key: "compressionType", label: "Compression" },
    { key: "status", label: "Status" }
  ],
};

export default function KafkaBatchProducerWorkspace() {
  return <CrudWorkspace config={config} />;
}
