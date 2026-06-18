import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Beaker } from "lucide-react";
const config: CrudConfig = {
  domainKey: "regulatory-sandbox", title: "Regulatory Sandbox",
  subtitle: "CBN sandbox environment for testing new financial products.",
  icon: Beaker, accentColor: "cyan",
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
export default function RegulatorySandboxWorkspace() { return <CrudWorkspace config={config} />; }
