import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileCheck } from "lucide-react";
const config: CrudConfig = {
  domainKey: "contract-test", title: "Contract Test Engine",
  subtitle: "Pact framework — 89 contracts between PWA, Flutter, Express, and microservices.",
  icon: FileCheck, accentColor: "rose",
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
export default function ContractTestWorkspace() { return <CrudWorkspace config={config} />; }
