import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Network } from "lucide-react";

const config: CrudConfig = {
  domainKey: "mtls-mesh",
  title: "mTLS Service Mesh",
  subtitle: "Mutual TLS between microservices",
  icon: Network,
  accentColor: "teal",
  apiBase: "/api/db/mtls-nodes",
  idField: "id",
  statusField: "status",
  searchFields: ["service"],
  fields: [
    { key: "service", label: "Service", type: "text" },
    { key: "spiffeId", label: "SPIFFE ID", type: "text" },
    { key: "peerConnections", label: "Peers", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "service", label: "Service" },
    { key: "spiffeId", label: "SPIFFE ID" },
    { key: "peerConnections", label: "Peers" },
    { key: "status", label: "Status" }
  ],
};

export default function MTLSMeshWorkspace() {
  return <CrudWorkspace config={config} />;
}
