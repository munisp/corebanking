import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { XCircle } from "lucide-react";
const config: CrudConfig = {
  domainKey: "account-closure", title: "Account Closure",
  subtitle: "Regulated account closure workflow with balance sweep and regulatory notification.",
  icon: XCircle, accentColor: "slate",
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
export default function AccountClosureWorkspace() { return <CrudWorkspace config={config} />; }
