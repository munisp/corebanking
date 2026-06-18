import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "path-validator",
  title: "Path Validator",
  subtitle: "URL path traversal prevention",
  icon: Shield,
  accentColor: "red",
  apiBase: "/api/db/path-validations",
  idField: "id",
  statusField: "status",
  searchFields: ["pattern"],
  fields: [
    { key: "pattern", label: "Pattern", type: "text" },
    { key: "regex", label: "Regex", type: "text" },
    { key: "blocked24h", label: "Blocked 24h", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "pattern", label: "Pattern" },
    { key: "regex", label: "Regex" },
    { key: "blocked24h", label: "Blocked 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function PathValidatorWorkspace() {
  return <CrudWorkspace config={config} />;
}
