import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Building2 } from "lucide-react";
const config: CrudConfig = {
  domainKey: "ubo-ownership-graph", title: "UBO Ownership Graph",
  subtitle: "Multi-level ownership traversal, 25% threshold detection, circular ownership detection, nominee director identification, D3.js visualization.",
  icon: Building2, accentColor: "cyan",
  fields: [
    { key: "name", label: "Entity Name", type: "text", required: true },
    { key: "entityType", label: "Entity Type", type: "select", options: ["company", "individual"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "name", label: "Entity", sortable: true },
    { key: "entityType", label: "Type", sortable: true }, { key: "nationality", label: "Nationality" },
    { key: "riskLevel", label: "Risk Level", sortable: true },
  ],
  idField: "id", statusField: "riskLevel", searchFields: ["name", "entityType", "nationality"],
  apiBase: "/api/db/accounts",
};
export default function UBOOwnershipGraphWorkspace() { return <CrudWorkspace config={config} />; }
