import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "ddos-shield",
  title: "DDoS Shield",
  subtitle: "L3/L4/L7 DDoS mitigation",
  icon: Zap,
  accentColor: "yellow",
  apiBase: "/api/db/ddos-rules",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "layer", label: "Layer", type: "text" },
    { key: "threshold", label: "Threshold", type: "text" },
    { key: "mitigated24h", label: "Mitigated 24h", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "layer", label: "Layer" },
    { key: "threshold", label: "Threshold" },
    { key: "mitigated24h", label: "Mitigated 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function DDoSShieldWorkspace() {
  return <CrudWorkspace config={config} />;
}
