import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "grpc-hot-path",
  title: "gRPC Hot Path Gateway",
  subtitle: "Protobuf-based inter-service hot paths",
  icon: Zap,
  accentColor: "purple",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["service"],
  fields: [
    { key: "service", label: "Service", type: "text" },
    { key: "avgLatencyMs", label: "Latency (ms)", type: "number" },
    { key: "throughputRps", label: "Throughput RPS", type: "number" },
    { key: "compressionRatio", label: "Compression", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "service", label: "Service" },
    { key: "avgLatencyMs", label: "Latency (ms)" },
    { key: "throughputRps", label: "Throughput RPS" },
    { key: "compressionRatio", label: "Compression" },
    { key: "status", label: "Status" }
  ],
};

export default function GRPCHotPathWorkspace() {
  return <CrudWorkspace config={config} />;
}
