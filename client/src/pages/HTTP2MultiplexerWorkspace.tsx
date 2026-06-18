import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

const config: CrudConfig = {
  domainKey: "http2-multiplexer",
  title: "HTTP/2 Multiplexer",
  subtitle: "HTTP/2 multiplexing with server push",
  icon: Globe,
  accentColor: "orange",
  apiBase: "/api/db/http2-connections",
  idField: "id",
  statusField: "status",
  searchFields: ["clientIp"],
  fields: [
    { key: "clientIp", label: "Client IP", type: "text" },
    { key: "streams", label: "Streams", type: "number" },
    { key: "maxConcurrentStreams", label: "Max Streams", type: "number" },
    { key: "latencyReductionPct", label: "Reduction", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "clientIp", label: "Client IP" },
    { key: "streams", label: "Streams" },
    { key: "maxConcurrentStreams", label: "Max Streams" },
    { key: "latencyReductionPct", label: "Reduction" },
    { key: "status", label: "Status" }
  ],
};

export default function HTTP2MultiplexerWorkspace() {
  return <CrudWorkspace config={config} />;
}
