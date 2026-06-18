import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Cpu } from "lucide-react";

const config: CrudConfig = {
  domainKey: "fluvio-wasm",
  title: "Fluvio WASM Transform",
  subtitle: "Zero-copy WASM inline stream transforms",
  icon: Cpu,
  accentColor: "orange",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "moduleType", label: "Type", type: "text" },
    { key: "avgLatencyUs", label: "Latency (μs)", type: "number" },
    { key: "throughputEps", label: "Events/s", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "moduleType", label: "Type" },
    { key: "avgLatencyUs", label: "Latency (μs)" },
    { key: "throughputEps", label: "Events/s" },
    { key: "status", label: "Status" }
  ],
};

export default function FluvioWASMTransformWorkspace() {
  return <CrudWorkspace config={config} />;
}
