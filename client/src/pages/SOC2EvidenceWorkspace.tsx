import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Clipboard } from "lucide-react";

const config: CrudConfig = {
  domainKey: "soc2-evidence",
  title: "SOC 2 Evidence Collector",
  subtitle: "Automated SOC 2 Type II evidence",
  icon: Clipboard,
  accentColor: "green",
  apiBase: "/api/db/soc2-evidence",
  idField: "id",
  statusField: "status",
  searchFields: ["controlId"],
  fields: [
    { key: "controlId", label: "Control ID", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "result", label: "Result", type: "text" },
    { key: "auditor", label: "Auditor", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "controlId", label: "Control ID" },
    { key: "category", label: "Category" },
    { key: "result", label: "Result" },
    { key: "auditor", label: "Auditor" },
    { key: "status", label: "Status" }
  ],
};

export default function SOC2EvidenceWorkspace() {
  return <CrudWorkspace config={config} />;
}
