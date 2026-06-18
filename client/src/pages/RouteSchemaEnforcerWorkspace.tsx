import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileCheck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "route-schema-enforcer",
  title: "Route Schema Enforcer",
  subtitle: "OpenAPI spec enforcement for all routes",
  icon: FileCheck,
  accentColor: "blue",
  apiBase: "/api/db/route-schemas",
  idField: "id",
  statusField: "status",
  searchFields: ["path"],
  fields: [
    { key: "path", label: "Path", type: "text" },
    { key: "method", label: "Method", type: "text" },
    { key: "schemaName", label: "Schema", type: "text" },
    { key: "passRate", label: "Pass Rate", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "path", label: "Path" },
    { key: "method", label: "Method" },
    { key: "schemaName", label: "Schema" },
    { key: "passRate", label: "Pass Rate" },
    { key: "status", label: "Status" }
  ],
};

export default function RouteSchemaEnforcerWorkspace() {
  return <CrudWorkspace config={config} />;
}
