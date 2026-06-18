import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { GitBranch } from "lucide-react";
const config: CrudConfig = {
  domainKey: "falkordb-graph", title: "FalkorDB Graph Analytics",
  subtitle: "Ultra-fast Redis-based graph database for fraud ring detection, UBO ownership chains, and compliance knowledge graphs. Cypher query language.",
  icon: GitBranch, accentColor: "rose",
  fields: [
    { key: "name", label: "Query Name", type: "text", required: true },
    { key: "cypher", label: "Cypher Query", type: "text" },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "name", label: "Query", sortable: true },
    { key: "cypher", label: "Cypher" }, { key: "avgMs", label: "Avg (ms)", sortable: true },
  ],
  idField: "id", searchFields: ["name", "cypher"],
  apiBase: "/api/db/sql-queries",
};
export default function FalkorDBGraphWorkspace() { return <CrudWorkspace config={config} />; }
