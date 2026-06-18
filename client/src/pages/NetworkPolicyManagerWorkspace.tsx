import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Network } from "lucide-react";

const config: CrudConfig = {
  domainKey: "network-policy",
  title: "Network Policy Manager",
  subtitle: "Kubernetes NetworkPolicy management",
  icon: Network,
  accentColor: "teal",
  apiBase: "/api/db/network-policies",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "namespace", label: "Namespace", type: "text" },
    { key: "appliedPods", label: "Applied Pods", type: "number" },
    { key: "deniedConnections24h", label: "Denied 24h", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "appliedPods", label: "Applied Pods" },
    { key: "deniedConnections24h", label: "Denied 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function NetworkPolicyManagerWorkspace() {
  return <CrudWorkspace config={config} />;
}
