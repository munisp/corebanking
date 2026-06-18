import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";

const config: CrudConfig = {
  domainKey: "keepalive-tuner",
  title: "Keep-Alive Tuner",
  subtitle: "HTTP connection reuse optimization",
  icon: Activity,
  accentColor: "green",
  apiBase: "/api/db/keepalive-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["service"],
  fields: [
    { key: "service", label: "Service", type: "text" },
    { key: "keepAliveTimeout", label: "Timeout (s)", type: "number" },
    { key: "reuseRate", label: "Reuse Rate", type: "text" },
    { key: "tcpHandshakesSaved24h", label: "Handshakes Saved", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "service", label: "Service" },
    { key: "keepAliveTimeout", label: "Timeout (s)" },
    { key: "reuseRate", label: "Reuse Rate" },
    { key: "tcpHandshakesSaved24h", label: "Handshakes Saved" },
    { key: "status", label: "Status" }
  ],
};

export default function KeepaliveTunerWorkspace() {
  return <CrudWorkspace config={config} />;
}
