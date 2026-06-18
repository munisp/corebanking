import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "waf-rules",
  title: "WAF Rules Engine",
  subtitle: "OpenAppSec WAF rule management",
  icon: Shield,
  accentColor: "red",
  apiBase: "/api/db/waf-rules",
  idField: "id",
  statusField: "status",
  searchFields: ["ruleId"],
  fields: [
    { key: "ruleId", label: "Rule ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "severity", label: "Severity", type: "text" },
    { key: "blocked24h", label: "Blocked 24h", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "ruleId", label: "Rule ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Category" },
    { key: "severity", label: "Severity" },
    { key: "blocked24h", label: "Blocked 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function WAFRulesEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
