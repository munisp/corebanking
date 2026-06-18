import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "fast-json",
  title: "Fast JSON Serializer",
  subtitle: "Pre-compiled JSON schema serialization",
  icon: Zap,
  accentColor: "yellow",
  apiBase: "/api/db/fast-json-schemas",
  idField: "id",
  statusField: "status",
  searchFields: ["schemaName"],
  fields: [
    { key: "schemaName", label: "Schema", type: "text" },
    { key: "serializationsPerSec", label: "Ser/sec", type: "number" },
    { key: "avgSerializeNs", label: "Avg (ns)", type: "number" },
    { key: "speedup", label: "Speedup", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "schemaName", label: "Schema" },
    { key: "serializationsPerSec", label: "Ser/sec" },
    { key: "avgSerializeNs", label: "Avg (ns)" },
    { key: "speedup", label: "Speedup" },
    { key: "status", label: "Status" }
  ],
};

export default function FastJSONSerializerWorkspace() {
  return <CrudWorkspace config={config} />;
}
