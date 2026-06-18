import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Code } from "lucide-react";

const config: CrudConfig = {
  domainKey: "output-encoder",
  title: "Output Encoder",
  subtitle: "XSS prevention via output encoding",
  icon: Code,
  accentColor: "orange",
  apiBase: "/api/db/output-encoding",
  idField: "id",
  statusField: "status",
  searchFields: ["context"],
  fields: [
    { key: "context", label: "Context", type: "text" },
    { key: "encoder", label: "Encoder", type: "text" },
    { key: "applied24h", label: "Applied 24h", type: "number" },
    { key: "xssBlocked", label: "XSS Blocked", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "context", label: "Context" },
    { key: "encoder", label: "Encoder" },
    { key: "applied24h", label: "Applied 24h" },
    { key: "xssBlocked", label: "XSS Blocked" },
    { key: "status", label: "Status" }
  ],
};

export default function OutputEncoderWorkspace() {
  return <CrudWorkspace config={config} />;
}
