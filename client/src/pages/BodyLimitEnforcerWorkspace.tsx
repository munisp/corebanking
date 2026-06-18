import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "body-limit",
  title: "Body Limit Enforcer",
  subtitle: "Request body size enforcement per route",
  icon: Shield,
  accentColor: "yellow",
  apiBase: "/api/db/body-limits",
  idField: "id",
  statusField: "status",
  searchFields: ["path"],
  fields: [
    { key: "path", label: "Path", type: "text" },
    { key: "method", label: "Method", type: "text" },
    { key: "maxBodyBytes", label: "Max Bytes", type: "number" },
    { key: "enforced", label: "Enforced", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "path", label: "Path" },
    { key: "method", label: "Method" },
    { key: "maxBodyBytes", label: "Max Bytes" },
    { key: "enforced", label: "Enforced" },
    { key: "status", label: "Status" }
  ],
};

export default function BodyLimitEnforcerWorkspace() {
  return <CrudWorkspace config={config} />;
}
