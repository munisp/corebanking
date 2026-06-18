import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";
const config: CrudConfig = {
  domainKey: "helm-validator", title: "Helm Validator",
  subtitle: "Helm chart lint and template validation for 219-service deployment.",
  icon: Shield, accentColor: "lime",
  fields: [
    { key: "id", label: "ID", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["active", "inactive", "pending"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/anomaly-models",
};
export default function HelmValidatorWorkspace() { return <CrudWorkspace config={config} />; }
