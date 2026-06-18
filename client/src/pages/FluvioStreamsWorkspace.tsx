import { Zap } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "fluvio-streams",
  title: "Stream Processing",
  subtitle: "Fluvio real-time stream processing — topics, SmartModules, connectors",
  icon: Zap,
  accentColor: "bg-purple-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "name", "compression"],
  apiBase: "/api/db/kafka-consumer-groups",
  fields: [
    { key: "name", label: "Topic Name", type: "text", required: true },
    { key: "partitions", label: "Partitions", type: "number", defaultValue: 3 },
    { key: "compression", label: "Compression", type: "select", options: ["lz4", "gzip", "snappy", "none"], defaultValue: "lz4" },
  ],
  columns: [
    { key: "id", label: "Topic ID" },
    { key: "name", label: "Name" },
    { key: "partitions", label: "Partitions" },
    { key: "message_count", label: "Messages", render: (v) => Number(v).toLocaleString() },
    { key: "bytes_in", label: "Bytes In", render: (v) => `${(Number(v) / 1048576).toFixed(1)} MB` },
    { key: "status", label: "Status" },
  ],
  actions: [],
};

export default function FluvioStreamsWorkspace() {
  return <CrudWorkspace config={config} />;
}
