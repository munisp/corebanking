import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Users } from "lucide-react";
const config: CrudConfig = {
  domainKey: "pep-enhanced-dd", title: "PEP Enhanced Due Diligence",
  subtitle: "Politically Exposed Persons — Relatives & Close Associates (RCA) graph, source-of-wealth enforcement, senior management approval, lower transaction thresholds.",
  icon: Users, accentColor: "amber",
  fields: [
    { key: "name", label: "Rule Name", type: "text", required: true },
    { key: "pepCategory", label: "PEP Category", type: "select", options: ["tier1_domestic", "tier2_foreign", "all"] },
    { key: "enforcement", label: "Enforcement", type: "select", options: ["mandatory", "recommended", "automated"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "name", label: "Rule", sortable: true },
    { key: "pepCategory", label: "PEP Category" }, { key: "enforcement", label: "Enforcement" },
  ],
  idField: "id", statusField: "enforcement", searchFields: ["name", "pepCategory"],
  apiBase: "/api/db/accounts",
};
export default function PEPEnhancedDDWorkspace() { return <CrudWorkspace config={config} />; }
