import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { CheckCircle } from "lucide-react";
const config: CrudConfig = {
  domainKey: "request-validator", title: "Request Validator",
  subtitle: "Zod/JSON Schema validation on all POST/PUT endpoints with rejection analytics.",
  icon: CheckCircle, accentColor: "green",
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
export default function RequestValidatorWorkspace() { return <CrudWorkspace config={config} />; }
