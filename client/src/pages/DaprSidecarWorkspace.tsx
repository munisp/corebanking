import { Layers } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "dapr-sidecar",
  title: "Dapr Service Mesh",
  subtitle: "Service invocation, pub/sub, state management, bindings, secrets",
  icon: Layers,
  accentColor: "bg-indigo-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "appId", "protocol", "status"],
  apiBase: "/api/db/accounts",
  fields: [],
  columns: [
    { key: "id", label: "App ID" },
    { key: "appId", label: "Service Name" },
    { key: "appPort", label: "App Port" },
    { key: "sidecarPort", label: "Sidecar Port" },
    { key: "protocol", label: "Protocol" },
    { key: "status", label: "Status" },
    { key: "components", label: "Components", render: (v) => Array.isArray(v) ? v.length.toString() : "0" },
  ],
  actions: [],
};

export default function DaprSidecarWorkspace() {
  return <CrudWorkspace config={config} />;
}
